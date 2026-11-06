import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { payService } from "../src/buy.js";
import { SERVICES } from "../src/services.js";
import { USDT } from "../src/settings.js";

test("the buy client signs one payment and keeps the settlement hash", async () => {
  const server = createServer((request, response) => {
    if (!request.headers["x-payment"]) {
      const body = {
        x402Version: 1,
        error: "payment_required",
        accepts: [
          {
            scheme: "exact",
            network: "celo",
            maxAmountRequired: SERVICES.xSearch.quotedAtomic,
            resource: request.url,
            description: "Search X posts through buy-gateway",
            mimeType: "application/json",
            payTo: "0x20faAca5F980E29639A0FCC6dcA6988E18ed333B",
            maxTimeoutSeconds: 60,
            asset: USDT.asset,
            extra: { name: USDT.name, version: USDT.version },
          },
        ],
      };
      response.writeHead(402, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
      return;
    }
    const proof = Buffer.from(
      JSON.stringify({
        success: true,
        transaction: `0x${"ab".repeat(32)}`,
        network: "celo",
      }),
    ).toString("base64");
    response.writeHead(200, { "content-type": "application/json", "x-payment-response": proof });
    response.end(JSON.stringify({ posts: [{ text: "ok" }] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  try {
    const paid = await payService({
      account: privateKeyToAccount(generatePrivateKey()),
      service: { ...SERVICES.xSearch, url: `http://127.0.0.1:${address.port}/v1/social/x/posts/search` },
      body: { query: "bags scam", type: "latest" },
      token: "USDT",
      fetchImpl: fetch,
      readBalance: false,
    });
    assert.equal(paid.ok, true);
    assert.equal(paid.receipt.outcome, "confirmed");
    assert.equal(paid.receipt.txHash, `0x${"ab".repeat(32)}`);
    assert.equal(paid.receipt.token, "USDT");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
