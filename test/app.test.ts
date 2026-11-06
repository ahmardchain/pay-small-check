import assert from "node:assert/strict";
import test from "node:test";
import { encodeAbiParameters, encodeEventTopics, type Hex } from "viem";
import { createApp } from "../src/app.js";
import { taggedTransferData } from "../src/lib/attribution.js";
import { CHECK_PLAN } from "../src/lib/capabilities.js";
import { memoryStore } from "../src/lib/receipts.js";
import type { ChainReader } from "../src/lib/payments.js";
import { TOKENS } from "../src/lib/tokens.js";
import { decodeHeader } from "../public/x402.js";

const payer = `0x${"11".repeat(32)}`;
const payTo = "0x1111111111111111111111111111111111111111";

async function bodyOf(response: Response): Promise<Record<string, any>> {
  return response.json() as Promise<Record<string, any>>;
}

function liveEnv() {
  return {
    DRY_RUN: "false",
    PAY_TO: payTo,
    AGENT_PRIVATE_KEY: payer,
    CHECK_PRICE_USD: "0.08",
    ATTRIBUTION_CODE: "celo_aac08e9358f3",
    BUY_TOKEN: "USDT",
  };
}

test("agent.json publishes the issued code and the public agent wallet", async () => {
  const app = createApp({ store: memoryStore() });
  const response = await app.request("http://localhost/agent.json", {}, { DRY_RUN: "true" });
  assert.equal(response.status, 200);
  const body = await bodyOf(response);
  assert.match(body.description, /celo_aac08e9358f3/);
  assert.match(body.description, /Instagram/);
  assert.match(body.description, /Facebook is not built/);
  const wallet = body.services.find((service: { name: string }) => service.name === "agentWallet");
  assert.equal(wallet.endpoint, "eip155:42220:0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08");
});

test("practice mode returns a verdict without payment and stores a receipt", async () => {
  const store = memoryStore();
  const app = createApp({ store });
  const response = await app.request(
    "http://localhost/api/checks",
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ handle: "@riskyvendor" }),
    },
    { DRY_RUN: "true" },
  );
  assert.equal(response.status, 200);
  const body = await bodyOf(response);
  assert.equal(body.verdict, "risky");
  assert.equal(body.dryRun, true);
  assert.equal(body.buyCalls.length, 6);
  const listed = await app.request("http://localhost/api/receipts", {}, { DRY_RUN: "true" });
  const list = await bodyOf(listed);
  assert.equal(list.receipts.length, 1);
  assert.equal(list.receipts[0].id, body.id);
});

test("whatsapp is an unsupported channel and is not scored", async () => {
  let called = false;
  const app = createApp({
    store: memoryStore(),
    fetchImpl: async () => {
      called = true;
      throw new Error("whatsapp must not call the network");
    },
  });
  const response = await app.request(
    "http://localhost/api/checks",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "whatsapp", handle: "08030000000" }),
    },
    { DRY_RUN: "false", PAY_TO: payTo, AGENT_PRIVATE_KEY: payer },
  );
  assert.equal(response.status, 400);
  const body = await bodyOf(response);
  assert.equal(body.error, "unsupported_channel");
  assert.equal(body.message, "Unsupported channel.");
  assert.equal(called, false);
});

test("a live check without a payment returns a real x402 challenge for USDT", async () => {
  const app = createApp({ store: memoryStore() });
  const response = await app.request(
    "http://localhost/api/checks",
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ handle: "shopname" }),
    },
    liveEnv(),
  );
  assert.equal(response.status, 402);
  const header = response.headers.get("payment-required");
  assert.ok(header);
  const required = decodeHeader(header);
  const usdt = required.accepts.find((item: { asset: string }) => item.asset.toLowerCase() === TOKENS.USDT.address.toLowerCase());
  assert.equal(usdt.network, "eip155:42220");
  assert.equal(usdt.amount, "80000");
  assert.equal(usdt.extra.name, "Tether USD");
  assert.equal(usdt.payTo.toLowerCase(), payTo.toLowerCase());
  const body = await bodyOf(response);
  assert.equal(body.transfer.tokens.some((token: { symbol: string }) => token.symbol === "cUSD"), true);
  assert.match(body.transfer.note, /does not settle cUSD/);
});

test("a confirmed USDT transfer is consumed once and the receipt keeps the hash", async () => {
  const store = memoryStore();
  const amount = 80_000n;
  const buyer = "0x2222222222222222222222222222222222222222" as const;
  const hash = `0x${"ab".repeat(32)}` as Hex;
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
  const reader: ChainReader = {
    getChainId: async () => 42220,
    getTransaction: async () => ({
      to: TOKENS.USDT.address,
      input: taggedTransferData(payTo, amount, "celo_aac08e9358f3"),
    }),
    getTransactionReceipt: async () => ({
      status: "success",
      logs: [
        {
          address: TOKENS.USDT.address,
          data: encodeAbiParameters([{ type: "uint256" }], [amount]),
          topics,
        },
      ],
    }),
  };
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
  const app = createApp({ store, reader, fetchImpl });
  const send = () =>
    app.request(
      "http://localhost/api/checks",
      {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ handle: "shopname", paymentTx: hash, token: "USDT" }),
      },
      liveEnv(),
    );
  const first = await send();
  const paid = await bodyOf(first);
  assert.equal(first.status, 200, JSON.stringify(paid));
  assert.equal(paid.userPayment.txHash, hash);
  assert.equal(paid.userPayment.attribution, "erc8021");
  assert.equal(paid.buyCalls.length, 6);
  const second = await send();
  assert.equal(second.status, 409);
});

test("live mode refuses to start when the PayTo wallet is still the placeholder", async () => {
  const app = createApp({ store: memoryStore() });
  const response = await app.request(
    "http://localhost/api/checks",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: "shopname" }),
    },
    { DRY_RUN: "false", PAY_TO: "0x0000000000000000000000000000000000000000" },
  );
  assert.equal(response.status, 503);
});
