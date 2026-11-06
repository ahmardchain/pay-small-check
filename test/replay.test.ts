import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { encodeAbiParameters, encodeEventTopics, type Hex } from "viem";
import { createApp, x402ClaimKey, type AppOptions } from "../src/app.js";
import { taggedTransferData } from "../src/lib/attribution.js";
import { CHECK_PLAN } from "../src/lib/capabilities.js";
import type { ChainReader } from "../src/lib/payments.js";
import { memoryStore } from "../src/lib/receipts.js";
import { TOKENS } from "../src/lib/tokens.js";

const payTo = "0x1111111111111111111111111111111111111111";
const buyer = "0x2222222222222222222222222222222222222222" as const;

function liveEnv(extra: Record<string, string> = {}) {
  return {
    DRY_RUN: "false",
    PAY_TO: payTo,
    AGENT_PRIVATE_KEY: `0x${"11".repeat(32)}`,
    CHECK_PRICE_USD: "0.08",
    ATTRIBUTION_CODE: "celo_aac08e9358f3",
    BUY_TOKEN: "USDT",
    ...extra,
  };
}

function transferReader(amount = 80_000n): ChainReader {
  const topics = encodeEventTopics({
    abi: [
      {
        type: "event",
        name: "Transfer",
        inputs: [
          { name: "from", type: "address", indexed: true },
          { name: "to", type: "address", indexed: true },
          { name: "value", type: "uint256", indexed: false },
        ],
      },
    ],
    eventName: "Transfer",
    args: { from: buyer, to: payTo },
  }) as [Hex, Hex, Hex];
  return {
    getChainId: async () => 42220,
    getTransaction: async () => ({ to: TOKENS.USDT.address, input: taggedTransferData(payTo, amount, "celo_aac08e9358f3") }),
    getTransactionReceipt: async () => ({
      status: "success",
      logs: [{ address: TOKENS.USDT.address, data: encodeAbiParameters([{ type: "uint256" }], [amount]), topics }],
    }),
  };
}

/** A fake buy gateway that counts every settled data call and answers slowly. */
function gateway() {
  const state = { paidCalls: 0, down: false };
  const catalog = {
    capabilities: CHECK_PLAN.map((plan) => ({
      id: plan.id,
      available: true,
      method: "POST",
      url: plan.documentedUrl,
      price: { atomic: "5000" },
    })),
  };
  const fetchImpl: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/v1/catalog")) return new Response(JSON.stringify(catalog), { status: 200 });
    if (state.down) {
      // The gateway refused before settling, so nothing was paid.
      return new Response(JSON.stringify({ error: "upstream_unavailable", paymentSettled: false }), { status: 400 });
    }
    state.paidCalls += 1;
    await sleep(5);
    return new Response(
      JSON.stringify({
        output: {
          legacy: {
            screen_name: "shopname",
            followers_count: 10,
            friends_count: 2,
            statuses_count: 4,
            created_at: "Wed Oct 10 20:19:24 +0000 2018",
            description: "shop",
          },
        },
      }),
      { status: 200 },
    );
  };
  return { state, fetchImpl };
}

function post(app: ReturnType<typeof createApp>, body: unknown, env: Record<string, string>, headers: Record<string, string> = {}) {
  return app.request(
    "http://localhost/api/checks",
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...headers },
      body: JSON.stringify(body),
    },
    env,
  );
}

test("parallel replays of one transfer hash run the paid calls only once", async () => {
  const { state, fetchImpl } = gateway();
  const app = createApp({ store: memoryStore(), reader: transferReader(), fetchImpl });
  const hash = `0x${"cd".repeat(32)}`;
  const responses = await Promise.all(
    Array.from({ length: 5 }, () => post(app, { handle: "shopname", paymentTx: hash, token: "USDT" }, liveEnv())),
  );
  const statuses = responses.map((response) => response.status).sort();
  assert.deepEqual(statuses, [200, 409, 409, 409, 409]);
  assert.equal(state.paidCalls, 6, "one check's worth of buy calls, not five");
});

test("a transfer whose check charged nothing can be retried", async () => {
  const { state, fetchImpl } = gateway();
  const app = createApp({ store: memoryStore(), reader: transferReader(), fetchImpl });
  const hash = `0x${"ef".repeat(32)}`;
  state.down = true;
  const failed = await post(app, { handle: "shopname", paymentTx: hash, token: "USDT" }, liveEnv());
  assert.equal(failed.status, 502);
  assert.equal(state.paidCalls, 0);
  state.down = false;
  const retried = await post(app, { handle: "shopname", paymentTx: hash, token: "USDT" }, liveEnv());
  assert.equal(retried.status, 200);
  assert.equal(state.paidCalls, 6);
});

function fakeSeller(nonce: string) {
  const counts = { settled: 0 };
  const seller = {
    processHTTPRequest: async () => ({
      type: "payment-verified",
      paymentPayload: { x402Version: 2, payload: { authorization: { from: buyer, nonce } } },
      paymentRequirements: { asset: TOKENS.USDT.address, amount: "80000" },
      declaredExtensions: {},
    }),
    processSettlement: async () => {
      counts.settled += 1;
      return { success: true, headers: {} };
    },
  } as unknown as NonNullable<AppOptions["seller"]>;
  return { seller, counts };
}

test("parallel requests carrying one x402 authorization run the paid calls only once", async () => {
  const { state, fetchImpl } = gateway();
  const { seller, counts } = fakeSeller(`0x${"aa".repeat(32)}`);
  const app = createApp({ store: memoryStore(), fetchImpl, seller });
  const env = liveEnv({ X402_API_KEY: "test-key" });
  const responses = await Promise.all(
    Array.from({ length: 5 }, () => post(app, { handle: "shopname" }, env, { "payment-signature": "signed" })),
  );
  const statuses = responses.map((response) => response.status).sort();
  assert.deepEqual(statuses, [200, 409, 409, 409, 409]);
  assert.equal(state.paidCalls, 6);
  assert.equal(counts.settled, 1);
});

test("an x402 authorization whose check charged nothing can be retried", async () => {
  const { state, fetchImpl } = gateway();
  const { seller } = fakeSeller(`0x${"bb".repeat(32)}`);
  const app = createApp({ store: memoryStore(), fetchImpl, seller });
  const env = liveEnv({ X402_API_KEY: "test-key" });
  state.down = true;
  const failed = await post(app, { handle: "shopname" }, env, { "payment-signature": "signed" });
  assert.equal(failed.status, 502);
  state.down = false;
  const retried = await post(app, { handle: "shopname" }, env, { "payment-signature": "signed" });
  assert.equal(retried.status, 200);
});

test("the x402 claim key is the payer and nonce, case-insensitive", () => {
  const request = new Request("http://localhost/api/checks");
  const upper = x402ClaimKey({ payload: { authorization: { from: buyer.toUpperCase(), nonce: "0xABC" } } }, request);
  const lower = x402ClaimKey({ payload: { authorization: { from: buyer, nonce: "0xabc" } } }, request);
  assert.equal(upper, lower);
});
