import assert from "node:assert/strict";
import test from "node:test";
import { encodeAbiParameters, encodeEventTopics, type Hex } from "viem";
import { createApp } from "../src/app.js";
import { taggedTransferData } from "../src/lib/attribution.js";
import {
  INSTAGRAM_COMMENTS,
  INSTAGRAM_PLAN,
  quotedAtomicTotal,
  resolvePlan,
} from "../src/lib/capabilities.js";
import { parseInstagramHandle } from "../src/lib/handles.js";
import { findInstagramShortcode, parseProviderPayload } from "../src/lib/normalize.js";
import type { ChainReader } from "../src/lib/payments.js";
import { memoryStore } from "../src/lib/receipts.js";
import { TOKENS } from "../src/lib/tokens.js";

const payer = `0x${"11".repeat(32)}`;
const payTo = "0x1111111111111111111111111111111111111111";

function liveEnv() {
  return {
    DRY_RUN: "false",
    PAY_TO: payTo,
    AGENT_PRIVATE_KEY: payer,
    CHECK_PRICE_USD: "0.08",
    ATTRIBUTION_CODE: "celo_aac08e9358f3",
    BUY_TOKEN: "USDT",
  };
}

function readerFor(hash: Hex): ChainReader {
  const buyer = "0x2222222222222222222222222222222222222222" as const;
  const amount = 80_000n;
  const topics = encodeEventTopics({
    abi: [
      {
        type: "event",
        name: "Transfer",
        inputs: [
          { name: "from", type: "address", indexed: true },
          { name: "to", type: "address", indexed: true },
          { name: "value", type: "uint256", indexed: false },
        ],
      },
    ],
    eventName: "Transfer",
    args: { from: buyer, to: payTo },
  }) as [Hex, Hex, Hex];
  return {
    getChainId: async () => 42220,
    getTransaction: async () => ({
      to: TOKENS.USDT.address,
      input: taggedTransferData(payTo, amount, "celo_aac08e9358f3"),
    }),
    getTransactionReceipt: async () => ({
      status: "success",
      logs: [
        {
          address: TOKENS.USDT.address,
          data: encodeAbiParameters([{ type: "uint256" }], [amount]),
          topics,
        },
      ],
    }),
  };
}

function instagramCatalog() {
  return {
    capabilities: [...INSTAGRAM_PLAN, INSTAGRAM_COMMENTS].map((plan) => ({
      id: plan.id,
      available: true,
      method: "POST",
      url: plan.documentedUrl,
      price: { atomic: plan.quotedAtomic, usd: plan.quotedAtomic === "5000" ? "0.005" : "0.007" },
    })),
  };
}

function providerBody(url: string, withShortcode: boolean) {
  if (url.endsWith("/v1/social/instagram/profile")) {
    return {
      username: "shopname",
      full_name: "Shop Name",
      biography: "Lagos shop. Delivery after confirmation.",
      follower_count: 2400,
      following_count: 300,
      media_count: 40,
      is_verified: false,
      pk: "1784140001",
    };
  }
  if (url.includes("fetch-user-info-by-username")) {
    return { user: { username: "shopname", follower_count: 2400, following_count: 300, media_count: 40, biography: "Lagos shop." } };
  }
  if (url.includes("fetch-user-posts")) {
    const posts = [
      { caption: { text: "New ankara in stock. Pickup in Yaba." }, like_count: 12, user: { username: "shopname" }, ...(withShortcode ? { code: "Abcde12345" } : {}) },
      { caption: { text: "Closed on Sunday. Orders ship Monday." }, like_count: 8, user: { username: "shopname" }, ...(withShortcode ? { code: "Bbcde12345" } : {}) },
      { caption: { text: "Size guide is in the pinned post." }, like_count: 5, user: { username: "shopname" }, ...(withShortcode ? { code: "Cbcde12345" } : {}) },
    ];
    return { items: posts };
  }
  if (url.includes("fetch-user-followers")) {
    return {
      users: Array.from({ length: 8 }, (_, index) => ({
        username: `reader${index}`,
        follower_count: 80 + index,
        following_count: 40,
        media_count: 20,
      })),
    };
  }
  if (url.includes("general-search")) return { posts: [] };
  if (url.includes("fetch-post-comments")) {
    return { comments: [{ text: "The fabric looks right.", user: { username: "ada" } }] };
  }
  return { unexpected: true };
}

test("instagram catalog quotes stay under the $0.08 fee", () => {
  assert.equal(quotedAtomicTotal(INSTAGRAM_PLAN), 31_000n);
  assert.equal(quotedAtomicTotal([...INSTAGRAM_PLAN, INSTAGRAM_COMMENTS]), 38_000n);
  assert.ok(quotedAtomicTotal([...INSTAGRAM_PLAN, INSTAGRAM_COMMENTS]) < 80_000n);
  for (const plan of [...INSTAGRAM_PLAN, INSTAGRAM_COMMENTS]) {
    assert.ok(BigInt(plan.quotedAtomic) <= 20_000n);
  }
});

test("instagram plan bodies use the catalog schemas", () => {
  const { calls, missing } = resolvePlan(instagramCatalog(), "Shop.Name", INSTAGRAM_PLAN);
  assert.deepEqual(missing, []);
  assert.equal(calls.length, 5);
  assert.deepEqual(calls.find((call) => call.plan.key === "profile")?.body, { username: "Shop.Name" });
  const details = calls.find((call) => call.plan.key === "about")?.body.queryParams as { username?: string };
  assert.equal(details?.username, "Shop.Name");
  const search = calls.find((call) => call.plan.key === "mentions")?.body.queryParams as { keyword?: string };
  assert.equal(search?.keyword, "Shop.Name scam");
  const comments = resolvePlan(instagramCatalog(), "Abcde12345", [INSTAGRAM_COMMENTS]);
  assert.deepEqual(comments.calls[0]?.body, { queryParams: { code_or_url: "Abcde12345", sort_by: "recent" } });
});

test("instagram usernames are parsed and X-only handles stay separate", () => {
  assert.equal(parseInstagramHandle(" @Shop.Name "), "shop.name");
  assert.equal(parseInstagramHandle("shop..name"), null);
  assert.equal(parseInstagramHandle(".shop"), null);
  assert.equal(parseInstagramHandle("a".repeat(31)), null);
});

test("instagram profile and caption payloads are readable", () => {
  const parsed = parseProviderPayload({
    output: {
      username: "shopname",
      biography: "Bags",
      edge_followed_by: { count: 2400 },
      edge_follow: { count: 10 },
      edge_owner_to_timeline_media: { count: 4 },
      items: [
        {
          code: "Abcde12345",
          caption: { text: "New stock today" },
          like_count: 3,
          taken_at: 1_700_000_000,
          user: { username: "shopname" },
        },
      ],
    },
  });
  const account = parsed.accounts.find((item) => item.handle === "shopname");
  assert.equal(account?.followers, 2400);
  assert.equal(account?.following, 10);
  assert.equal(account?.postsCount, 4);
  assert.equal(account?.bio, "Bags");
  assert.equal(parsed.posts.length, 1);
  assert.equal(parsed.posts[0]?.text, "New stock today");
  assert.equal(parsed.posts[0]?.handle, "shopname");
  assert.equal(parsed.posts[0]?.url, "https://www.instagram.com/p/Abcde12345/");
  assert.equal(findInstagramShortcode({ items: [{ code: "Abcde12345", caption: { text: "New stock today" } }] }), "Abcde12345");
});

test("facebook is coming soon and does not call buy", async () => {
  let called = false;
  const app = createApp({
    store: memoryStore(),
    fetchImpl: async () => {
      called = true;
      throw new Error("facebook must not call the network");
    },
  });
  const response = await app.request(
    "http://localhost/api/checks",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "facebook", handle: "shopname" }),
    },
    liveEnv(),
  );
  assert.equal(response.status, 501);
  const body = (await response.json()) as { error: string; message: string };
  assert.equal(body.error, "not_built");
  assert.match(body.message, /not built/);
  assert.equal(called, false);
});

test("a paid instagram check buys the catalog calls and scores the returned record", async () => {
  await assertInstagramCheck(true, 6, "0x" + "cd".repeat(32));
});

test("instagram comments are skipped when the posts payload has no shortcode", async () => {
  await assertInstagramCheck(false, 5, "0x" + "ef".repeat(32));
});

async function assertInstagramCheck(withShortcode: boolean, expectedCalls: number, hash: string) {
  const requests: { url: string; body: unknown }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = request.url;
    if (url.includes("/v1/catalog")) {
      return new Response(JSON.stringify(instagramCatalog()), { status: 200 });
    }
    const text = await request.text();
    requests.push({ url, body: text ? JSON.parse(text) : null });
    return new Response(JSON.stringify({ output: providerBody(url, withShortcode) }), { status: 200 });
  };
  const app = createApp({ store: memoryStore(), reader: readerFor(hash as Hex), fetchImpl });
  const response = await app.request(
    "http://localhost/api/checks",
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ channel: "instagram", handle: "@ShopName", paymentTx: hash, token: "USDT" }),
    },
    liveEnv(),
  );
  const paid = (await response.json()) as {
    channel: string;
    verdict: string;
    signals: { title: string }[];
    evidence: { label: string; url?: string }[];
    buyCalls: { capability: string; url: string }[];
    warnings: string[];
  };
  assert.equal(response.status, 200, JSON.stringify(paid));
  assert.equal(paid.channel, "instagram");
  assert.equal(paid.verdict, "caution");
  assert.ok(paid.signals.some((signal) => signal.title === "Account age is unknown"));
  assert.equal(paid.evidence[0]?.label, "@shopname on Instagram");
  assert.equal(paid.evidence[0]?.url, "https://www.instagram.com/shopname/");
  assert.equal(paid.buyCalls.length, expectedCalls);
  assert.ok(paid.buyCalls.every((call) => call.capability.includes("instagram")));
  assert.equal(requests.some((call) => call.url.includes("/social/x/")), false);
  const profile = requests.find((call) => call.url.endsWith("/v1/social/instagram/profile"));
  assert.deepEqual(profile?.body, { username: "shopname" });
  const comments = requests.find((call) => call.url.includes("fetch-post-comments"));
  if (withShortcode) {
    assert.deepEqual(comments?.body, { queryParams: { code_or_url: "Abcde12345", sort_by: "recent" } });
  } else {
    assert.equal(comments, undefined);
    assert.ok(paid.warnings.some((warning) => warning.includes("no shortcode")));
  }
}

test("practice mode can run the instagram sample without a network call", async () => {
  let called = false;
  const app = createApp({
    store: memoryStore(),
    fetchImpl: async () => {
      called = true;
      throw new Error("practice mode must not call buy");
    },
  });
  const response = await app.request(
    "http://localhost/api/checks",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "instagram", handle: "@riskyvendor" }),
    },
    { DRY_RUN: "true" },
  );
  const body = (await response.json()) as {
    channel: string;
    verdict: string;
    dryRun: boolean;
    evidence: { label: string; url?: string }[];
    buyCalls: { simulated: boolean }[];
  };
  assert.equal(response.status, 200);
  assert.equal(body.channel, "instagram");
  assert.equal(body.verdict, "risky");
  assert.equal(body.evidence[0]?.label, "@riskyvendor on Instagram");
  assert.equal(body.evidence[0]?.url, "https://www.instagram.com/riskyvendor/");
  assert.equal(body.dryRun, true);
  assert.equal(body.buyCalls.length, INSTAGRAM_PLAN.length);
  assert.ok(body.buyCalls.every((call) => call.simulated));
  assert.equal(called, false);
});
