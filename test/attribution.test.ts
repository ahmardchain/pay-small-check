import assert from "node:assert/strict";
import test from "node:test";
import { fromDataSuffix, toDataSuffix } from "@celo/attribution-tags";
import { DEFAULT_ATTRIBUTION_CODE } from "../src/attribution.js";
import { buildRegistrationCall } from "../src/identity.js";

test("the registration call ends with this app's ERC-8021 code", () => {
  const suffix = toDataSuffix(DEFAULT_ATTRIBUTION_CODE);
  const data = buildRegistrationCall("data:application/json,{}", DEFAULT_ATTRIBUTION_CODE);
  assert.equal(data.toLowerCase().endsWith(suffix.slice(2).toLowerCase()), true);
  const decoded = fromDataSuffix(data) ?? fromDataSuffix(suffix);
  assert.ok(decoded);
  assert.equal(decoded.codes.includes(DEFAULT_ATTRIBUTION_CODE), true);
  assert.equal(DEFAULT_ATTRIBUTION_CODE.startsWith("celo_"), true);
});
