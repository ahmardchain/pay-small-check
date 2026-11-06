import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { runCheck } from "../src/check.js";
import { parseQuery } from "../src/parse.js";
import { settingsFromEnv } from "../src/settings.js";

const settings = settingsFromEnv({ BUY_MODE: "mock", PAYMENT_MODE: "open" });

test("mock checks score the three demo vendors and never attach a tx hash", async () => {
  const low = await runCheck(parseQuery("@trusted_shop"), settings);
  const high = await runCheck(parseQuery("@scam_shop"), settings);
  const mid = await runCheck(parseQuery("@random_shop"), settings);
  assert.equal(low.risk, "low");
  assert.equal(high.risk, "high");
  assert.equal(mid.risk, "medium");
  for (const report of [low, high, mid]) {
    assert.equal(report.mode, "mock");
    assert.ok(report.receipts.length >= 5);
    assert.ok(report.receipts.length <= 8);
    assert.equal(new Set(report.receipts.map((receipt) => receipt.capability)).size, report.receipts.length);
    for (const receipt of report.receipts) {
      assert.equal(receipt.outcome, "mock");
      assert.equal(receipt.txHash, null);
    }
  }
});

test("the http demo accepts a check without a wallet", async () => {
  const app = createApp(settings);
  const response = await app.request("/api/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "@trusted_shop" }),
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as { risk: string; mode: string };
  assert.equal(body.mode, "mock");
  assert.equal(body.risk, "low");
  const status = await app.request("/api/status");
  const statusBody = (await status.json()) as { chainId: number; services: unknown[] };
  assert.equal(statusBody.chainId, 42220);
  assert.ok(statusBody.services.length >= 8);
});
