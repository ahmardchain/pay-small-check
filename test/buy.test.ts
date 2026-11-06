import assert from "node:assert/strict";
import test from "node:test";
import { createBuyPayer } from "../src/lib/buy.js";
import { CHECK_PLAN } from "../src/lib/capabilities.js";
import { TOKENS } from "../src/lib/tokens.js";
import { encodeHeader } from "../public/x402.js";

const KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const PLAN = CHECK_PLAN[0];

function challenge(amount = "5000") {
  return {
    x402Version: 2,
    resource: { url: PLAN.documentedUrl, description: PLAN.title, mimeType: "application/json" },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:42220",
        amount,
        asset: TOKENS.USDT.address,
        payTo: "0x20faAca5F980E29639A0FCC6dcA6988E18ed333B",
        maxTimeoutSeconds: 300,
        extra: { name: "Tether USD", version: "1", gateway: { capability: PLAN.id } },
      },
      {
        scheme: "exact",
        network: "eip155:11142220",
        amount,
        asset: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
        payTo: "0x20faAca5F980E29639A0FCC6dcA6988E18ed333B",
        maxTimeoutSeconds: 300,
        extra: { name: "USDC", version: "2" },
      },
    ],
  };
}

test("the agent signs a mainnet USDT payment and keeps the settlement hash", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    calls += 1;
    const request = input instanceof Request ? input : new Request(input, init);
    if (calls === 1) {
      return new Response("{}", { status: 402, headers: { "PAYMENT-REQUIRED": encodeHeader(challenge()) } });
    }
    assert.ok(request.headers.get("payment-signature"));
    return new Response(JSON.stringify({ output: { legacy: { screen_name: "ada", followers_count: 3 } }, correlationId: "corr-1" }), {
      status: 200,
      headers: {
        "PAYMENT-RESPONSE": encodeHeader({
          success: true,
          transaction: `0x${"cd".repeat(32)}`,
          network: "eip155:42220",
          payer: "0x0000000000000000000000000000000000000001",
        }),
      },
    });
  };
  const payer = createBuyPayer({
    privateKey: KEY,
    rpcUrl: "https://forno.celo.org",
    tokenAddress: TOKENS.USDT.address,
    tokenSymbol: "USDT",
    maxAtomic: 20_000n,
    fetchImpl,
  });
  const result = await payer.pay({
    plan: PLAN,
    capability: { id: PLAN.id },
    url: PLAN.documentedUrl,
    method: "POST",
    body: PLAN.buildBody("ada"),
    indicativeAtomic: "5000",
  });
  assert.equal(result.ok, true);
  assert.equal(result.txHash, `0x${"cd".repeat(32)}`);
  assert.equal(result.correlationId, "corr-1");
  assert.equal(calls, 2);
});

test("a quote above the cap is refused before a payment header is sent", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return new Response("{}", { status: 402, headers: { "PAYMENT-REQUIRED": encodeHeader(challenge("999999")) } });
  };
  const payer = createBuyPayer({
    privateKey: KEY,
    rpcUrl: "https://forno.celo.org",
    tokenAddress: TOKENS.USDT.address,
    tokenSymbol: "USDT",
    maxAtomic: 20_000n,
    fetchImpl,
  });
  const result = await payer.pay({
    plan: PLAN,
    capability: { id: PLAN.id },
    url: PLAN.documentedUrl,
    method: "POST",
    body: PLAN.buildBody("ada"),
  });
  assert.equal(result.ok, false);
  assert.equal(result.settled, false);
  assert.match(result.error ?? "", /cap|spendControls|exceeds/i);
  assert.equal(calls, 1);
});
