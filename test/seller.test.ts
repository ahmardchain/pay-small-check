import assert from "node:assert/strict";
import test from "node:test";
import type { RouteConfig } from "@x402/core/server";
import { checkRoutes } from "../src/seller.js";
import { CNGN, USDT, settingsFromEnv } from "../src/settings.js";

test("the seller offers cNGN via Permit2 and USD₮ via EIP-3009 names", () => {
  const routes = checkRoutes(settingsFromEnv({ PAY_TO: "0x1111111111111111111111111111111111111111" })) as Record<
    string,
    RouteConfig
  >;
  const route = routes["POST /api/check"];
  if (!route) throw new Error("missing route");
  const accepts = Array.isArray(route.accepts) ? route.accepts : [route.accepts];
  const usdt = accepts.find((item) => item.price && typeof item.price === "object" && item.price.asset === USDT.asset);
  const cngn = accepts.find((item) => item.price && typeof item.price === "object" && item.price.asset === CNGN.asset);
  assert.ok(usdt && typeof usdt.price === "object");
  assert.ok(cngn && typeof cngn.price === "object");
  assert.equal(usdt.price.extra?.name, "Tether USD");
  assert.equal(usdt.price.extra?.version, "1");
  assert.equal(cngn.price.extra?.assetTransferMethod, "permit2");
  assert.equal(cngn.price.extra?.name, "cNGN");
  assert.equal(usdt.network, "eip155:42220");
});
