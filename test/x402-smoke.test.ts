import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { CNGN, USDT, settingsFromEnv } from "../src/settings.js";

test("an unpaid check is a 402 that offers cNGN and USD₮", async () => {
  const app = createApp(
    settingsFromEnv({
      PAYMENT_MODE: "x402",
      PAY_TO: "0x1111111111111111111111111111111111111111",
      BUY_MODE: "mock",
    }),
  );
  const response = await app.request("/api/check", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query: "@trusted_shop" }),
  });
  assert.equal(response.status, 402);
  const header = response.headers.get("payment-required");
  assert.ok(header);
  const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as {
    accepts?: { asset?: string; amount?: string; extra?: { assetTransferMethod?: string; name?: string } }[];
  };
  const assets = new Map((decoded.accepts ?? []).map((item) => [item.asset?.toLowerCase(), item]));
  const usdt = assets.get(USDT.asset.toLowerCase());
  const cngn = assets.get(CNGN.asset.toLowerCase());
  assert.equal(usdt?.amount, "80000");
  assert.equal(usdt?.extra?.name, "Tether USD");
  assert.equal(cngn?.amount, "120000000");
  assert.equal(cngn?.extra?.assetTransferMethod, "permit2");
});
