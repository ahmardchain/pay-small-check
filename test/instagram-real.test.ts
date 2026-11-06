import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { BuyCallResult } from "../src/lib/buy.js";
import { parseProviderPayload } from "../src/lib/normalize.js";
import { analysisFromCalls, snapshotFromCalls } from "../src/lib/snapshot.js";

interface RealFixture {
  profile: unknown;
  about: unknown;
  posts: { data: { items: { code?: string; caption?: { text?: string }; carousel_media?: { caption?: { text?: string } }[] }[] } };
  followers: { data: { items: unknown[] } };
  mentions: unknown;
  replies: {
    data: {
      additional_data?: { caption?: { text?: string } };
      items: { text?: string; comment_like_count?: number; preview_child_comments?: { text?: string }[] }[];
    };
  };
}

function loadFixture(handle: string): RealFixture {
  const path = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "instagram", `${handle}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as RealFixture;
}

function call(key: string, output: unknown): BuyCallResult {
  return {
    key,
    capability: key,
    title: key,
    why: key,
    url: "https://gateway.usebuy.ai/fixture",
    txHash: null,
    amount: null,
    asset: null,
    token: "USDT",
    correlationId: null,
    ok: true,
    simulated: false,
    settled: true,
    retryable: null,
    output,
    error: null,
  };
}

function analyzeFixture(handle: string) {
  const fixture = loadFixture(handle);
  return {
    fixture,
    result: analysisFromCalls(
      handle,
      [
        call("profile", fixture.profile),
        call("about", fixture.about),
        call("posts", fixture.posts),
        call("followers", fixture.followers),
        call("mentions", fixture.mentions),
        call("replies", fixture.replies),
      ],
      new Date("2026-11-06T00:00:00Z"),
      "instagram",
    ),
  };
}

for (const handle of ["nike", "minasclosetluxe"] as const) {
  test(`${handle} real buy payloads are not Risky from unrelated search hits`, () => {
    const { fixture, result } = analyzeFixture(handle);
    const calls = [
      call("profile", fixture.profile),
      call("about", fixture.about),
      call("posts", fixture.posts),
      call("followers", fixture.followers),
      call("mentions", fixture.mentions),
      call("replies", fixture.replies),
    ];
    const snapshot = snapshotFromCalls(handle, calls, "instagram");
    const posts = parseProviderPayload(fixture.posts, "posts");
    const followers = parseProviderPayload(fixture.followers, "followers");
    const replies = parseProviderPayload(fixture.replies, "replies");
    const ownerCaption = fixture.replies.data.additional_data?.caption?.text ?? "";
    const childTexts = fixture.replies.data.items.flatMap((item) => item.preview_child_comments ?? []).map((child) => child.text);
    assert.equal(posts.posts.length, fixture.posts.data.items.length);
    const parentTexts = new Set(fixture.posts.data.items.map((item) => item.caption?.text).filter(Boolean));
    const slideTexts = fixture.posts.data.items.flatMap((item) => item.carousel_media ?? []).map((slide) => slide.caption?.text).filter((text): text is string => Boolean(text) && !parentTexts.has(text));
    assert.ok(slideTexts.length > 0 || handle !== "nike");
    assert.equal(posts.posts.some((post) => slideTexts.includes(post.text)), false);
    assert.equal(followers.accounts.length, Math.min(40, fixture.followers.data.items.length));
    assert.ok(followers.accounts.every((account) => account.followers === undefined && account.following === undefined && account.postsCount === undefined));
    assert.equal(replies.posts.some((post) => post.text === ownerCaption), false);
    for (const child of childTexts) {
      if (child) assert.ok(replies.posts.some((post) => post.text === child));
    }
    assert.ok(replies.posts.some((post) => post.likes !== undefined || post.replies !== undefined));
    assert.equal(result.verdict, "caution");
    assert.equal(result.complaintCount, 0);
    assert.ok(result.signals.some((signal) => signal.title === "Account age is unknown"));
    assert.ok(result.signals.some((signal) => signal.detail.includes("Posts on the profile: unknown")));
    assert.ok(result.signals.some((signal) => signal.title === "Follower history is insufficient"));
    assert.ok(result.signals.some((signal) => signal.title === "Complaint coverage is unknown"));
    assert.ok(result.warnings.some((warning) => warning.includes("complaint coverage is unknown")));
    assert.ok(result.warnings.some((warning) => warning.includes("total post count is unknown")));
    const parent = `https://www.instagram.com/p/${fixture.posts.data.items[0]?.code}/`;
    assert.ok(snapshot.snapshot.replies.length > 0);
    assert.ok(snapshot.snapshot.replies.every((post) => post.url === parent));
    assert.ok(result.evidence.filter((item) => item.kind === "post").every((item) => item.url?.startsWith("https://www.instagram.com/p/")));
    assert.equal(result.evidence.some((item) => item.kind === "complaint"), false);
  });
}

test("an explicit @handle complaint is kept and a brand-word hit is not", () => {
  const mentions = {
    data: {
      items: [
        { code: "Aaa111bbbb", caption: { text: "@nike is a scam. I paid and nothing came." }, user: { username: "buyer" } },
        { code: "Bbb222cccc", caption: { text: "Fraudsters sell fake Nike shoes online." }, user: { username: "news" } },
      ],
    },
  };
  const parsed = parseProviderPayload(mentions, "mentions");
  assert.equal(parsed.posts.length, 2);
  const result = analysisFromCalls(
    "nike",
    [
      call("profile", {
        username: "nike",
        full_name: "Nike",
        biography: "Shop",
        is_verified: true,
        edge_followed_by: { count: 1000 },
        edge_follow: { count: 10 },
        edge_owner_to_timeline_media: { count: 4 },
      }),
      call("posts", { data: { items: [{ code: "Ccc333dddd", caption: { text: "New shoes" }, like_count: 3, user: { username: "nike" } }] } }),
      call("followers", { data: { items: [] } }),
      call("mentions", mentions),
      call("replies", { data: { items: [] } }),
    ],
    new Date("2026-11-06T00:00:00Z"),
    "instagram",
  );
  assert.equal(result.complaintCount, 1);
  assert.equal(result.evidence.some((item) => item.kind === "complaint" && item.excerpt?.includes("@nike")), true);
  assert.equal(result.evidence.some((item) => item.excerpt?.includes("Fraudsters")), false);
});

test("comment likes and the parent post url come from the real comment shape", () => {
  const fixture = loadFixture("nike");
  const replies = parseProviderPayload(fixture.replies, "replies");
  const liked = replies.posts.find((post) => (post.likes ?? 0) > 0);
  assert.ok(liked);
  const withChildCount = fixture.replies.data.items.find((item) => (item.comment_like_count ?? 0) > 0 || (item.preview_child_comments ?? []).length > 0);
  assert.ok(withChildCount);
});
