import assert from "node:assert/strict";
import test from "node:test";
import { analyzeVendor, isComplaint } from "../src/lib/analyze.js";
import { fixtureFor } from "../src/lib/fixtures.js";

const now = new Date("2026-11-06T12:00:00Z");

test("practice fixtures land on the three verdicts", () => {
  assert.equal(analyzeVendor("safevendor", fixtureFor("safevendor").snapshot, now).verdict, "safe");
  assert.equal(analyzeVendor("cautionvendor", fixtureFor("cautionvendor").snapshot, now).verdict, "caution");
  assert.equal(analyzeVendor("riskyvendor", fixtureFor("riskyvendor").snapshot, now).verdict, "risky");
});

test("a missing profile is caution, not safe", () => {
  const result = analyzeVendor("missing", {
    profile: null,
    posts: [],
    replies: [],
    mentions: [],
    followers: [],
    gaps: { profile: true, posts: true, replies: true, followers: true, mentions: true },
  });
  assert.equal(result.verdict, "caution");
});

test("a clean account is not safe when the complaint search was not read", () => {
  const snapshot = structuredClone(fixtureFor("safevendor").snapshot);
  snapshot.gaps.mentions = true;
  snapshot.mentions = [];
  assert.equal(analyzeVendor("safevendor", snapshot, now).verdict, "caution");
});

test("complaint words match scam language and not nearby words", () => {
  assert.equal(isComplaint("this vendor scammed me"), true);
  assert.equal(isComplaint("didn't deliver the shoes"), true);
  assert.equal(isComplaint("a scamper through the market"), false);
  assert.equal(isComplaint("Got my order yesterday"), false);
});
