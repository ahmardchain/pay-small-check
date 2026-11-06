import assert from "node:assert/strict";
import test from "node:test";
import { CHECK_PLAN, resolvePlan } from "../src/lib/capabilities.js";
import { usdToAtomic } from "../src/lib/money.js";
import { tagCalldata, taggedTransferData } from "../src/lib/attribution.js";
import { ERC_8021_MARKER, fromDataSuffix } from "@celo/attribution-tags";
import { encodeFunctionData } from "viem";
import { ERC20_TRANSFER_ABI } from "../src/lib/attribution.js";
import { buildAuthorization, buildPaymentPayload, selectRequirement, typedDataFor } from "../public/x402.js";

test("usd amounts stay in integer atomic units", () => {
  assert.equal(usdToAtomic("0.08", 6), 80_000n);
  assert.equal(usdToAtomic("0.08", 18), 80_000_000_000_000_000n);
  assert.throws(() => usdToAtomic("0.0800001", 6));
});

test("the check plan resolves only available catalog rows and keeps the documented bodies", () => {
  const catalog = {
    capabilities: CHECK_PLAN.map((plan) => ({
      id: plan.id,
      available: plan.key !== "about",
      method: "POST",
      url: plan.documentedUrl,
      price: { atomic: "5000" },
    })),
  };
  const { calls, missing } = resolvePlan(catalog, "Shop_Name");
  assert.deepEqual(missing, ["monid.x.tikhub.api-v1-twitter-web-fetch-user-about"]);
  const mentions = calls.find((call) => call.plan.key === "mentions");
  assert.equal(mentions?.body.type, "latest");
  assert.match(String(mentions?.body.query), /@Shop_Name/);
  const profileBody = calls.find((call) => call.plan.key === "profile")?.body.queryParams as { screen_name?: string };
  assert.equal(profileBody?.screen_name, "Shop_Name");
});

test("ERC-8021 suffix survives on a transfer and decodes back to the builder code", () => {
  const data = taggedTransferData("0x1111111111111111111111111111111111111111", 80_000n, "celo_aac08e9358f3");
  const decoded = fromDataSuffix(data);
  assert.equal(decoded?.schemaId, 0);
  assert.deepEqual(decoded?.codes, ["celo_aac08e9358f3"]);
  assert.ok(data.endsWith(ERC_8021_MARKER.slice(2)));
  const plain = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: ["0x1111111111111111111111111111111111111111", 1n],
  });
  assert.equal(fromDataSuffix(tagCalldata(plain, "celo_aac08e9358f3"))?.codes[0], "celo_aac08e9358f3");
});

test("browser x402 payload matches the v2 exact authorization shape", () => {
  const required = {
    x402Version: 2,
    resource: { url: "https://example.com/api/checks", description: "check", mimeType: "application/json" },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:42220",
        amount: "80000",
        asset: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
        payTo: "0x2222222222222222222222222222222222222222",
        maxTimeoutSeconds: 300,
        extra: { name: "Tether USD", version: "1" },
      },
    ],
  };
  const requirement = selectRequirement(required, required.accepts[0].asset);
  const authorization = buildAuthorization(
    "0x3333333333333333333333333333333333333333",
    requirement,
    1_700_000_000,
    "0x" + "ab".repeat(32),
  );
  const typed = typedDataFor(requirement, authorization);
  assert.equal(typed.primaryType, "TransferWithAuthorization");
  assert.equal(typed.domain.name, "Tether USD");
  assert.equal(typed.domain.version, "1");
  assert.equal(typed.message.value, "80000");
  assert.equal(typed.message.validAfter, "0");
  const payload = buildPaymentPayload(required, requirement, authorization, "0xsig");
  assert.equal(payload.x402Version, 2);
  assert.equal(payload.accepted.amount, "80000");
  assert.equal(payload.payload.signature, "0xsig");
  assert.equal(payload.resource.url, required.resource.url);
});
