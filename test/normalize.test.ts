import assert from "node:assert/strict";
import test from "node:test";
import { parseProviderPayload, snowflakeDate } from "../src/lib/normalize.js";

test("reads a nested X profile and a tweet with its author", () => {
  const parsed = parseProviderPayload({
    output: {
      data: {
        user: {
          result: {
            rest_id: "1050123456789012345",
            legacy: {
              name: "Ada Market",
              screen_name: "adamarket",
              description: "I sell bags",
              followers_count: 2400,
              friends_count: 300,
              statuses_count: 400,
              created_at: "Wed Oct 10 20:19:24 +0000 2018",
              default_profile_image: false,
            },
          },
        },
        tweets: [
          {
            rest_id: "111",
            legacy: {
              full_text: "New stock today",
              favorite_count: 12,
              retweet_count: 1,
              reply_count: 2,
              created_at: "Mon Nov 02 10:00:00 +0000 2026",
              id_str: "111",
            },
            core: { user_results: { result: { legacy: { screen_name: "adamarket" } } } },
          },
        ],
      },
    },
  });
  assert.equal(parsed.accounts.some((account) => account.handle === "adamarket" && account.followers === 2400), true);
  assert.equal(parsed.posts[0]?.text, "New stock today");
  assert.equal(parsed.posts[0]?.handle, "adamarket");
  assert.equal(parsed.recognized, true);
});

test("an empty object is not treated as a successful empty search", () => {
  const parsed = parseProviderPayload({ unexpected: true });
  assert.equal(parsed.recognized, false);
});

test("snowflake ids decode to a date", () => {
  const date = snowflakeDate("1050123456789012345");
  assert.ok(date);
  assert.ok(date!.getUTCFullYear() >= 2018);
});
