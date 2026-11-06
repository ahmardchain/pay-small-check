import assert from "node:assert/strict";
import test from "node:test";
import { parseQuery } from "../src/parse.js";
import { planCalls } from "../src/plan.js";
import { MAX_PAID_CALLS, SERVICE_LIST } from "../src/services.js";

test("an instagram handle plus a shop link stays inside 5 to 8 distinct calls", () => {
  const plan = planCalls(parseQuery("https://bags.example.ng"));
  const ids = plan.before.map((call) => call.service.id);
  assert.ok(ids.includes("browser.session"));
  assert.ok(ids.includes("instagram.search"));
  assert.equal(new Set(ids).size, ids.length);
  const withFollowup = plan.before.length + Number(plan.followups.redditComments) + 1;
  assert.ok(withFollowup >= 5 && withFollowup <= MAX_PAID_CALLS);
});

test("an instagram profile check does not also buy the cheap search duplicate", () => {
  const plan = planCalls(parseQuery("@yaba_bags"));
  const ids = plan.before.map((call) => call.service.id);
  assert.deepEqual(ids.slice(0, 2), ["instagram.profile", "instagram.posts"]);
  assert.equal(ids.includes("instagram.search"), false);
  assert.equal(ids.includes("reddit.apify"), false);
  assert.equal(plan.followups.instagramComments, true);
  const ceiling = plan.before.length + 1 + 1;
  assert.ok(ceiling <= MAX_PAID_CALLS);
  assert.ok(plan.before.length + 1 >= 5);
});

test("every planned url is one this build quoted", () => {
  const known = new Map<string, string>(SERVICE_LIST.map((service) => [service.url, service.catalogId]));
  const plan = planCalls(parseQuery("@yaba_bags"));
  for (const call of plan.before) {
    assert.equal(known.get(call.service.url), call.service.catalogId);
    assert.equal(call.service.url.startsWith("https://gateway.usebuy.ai/"), true);
  }
});
