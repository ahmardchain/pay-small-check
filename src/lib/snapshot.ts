import { analyzeVendor, isComplaint, type Analysis, type VendorSnapshot } from "./analyze.js";
import type { CheckChannel } from "./capabilities.js";
import type { BuyCallResult } from "./buy.js";
import { findInstagramShortcode, parseProviderPayload, type AccountFacts, type PostFacts } from "./normalize.js";

export function snapshotFromCalls(
  handle: string,
  calls: BuyCallResult[],
  channel: CheckChannel = "x",
): { snapshot: VendorSnapshot; warnings: string[] } {
  const warnings: string[] = [];
  const buckets: Record<string, { accounts: AccountFacts[]; posts: PostFacts[]; recognized: boolean; failed: boolean }> = {};
  for (const call of calls) {
    if (!call.ok || call.output == null) {
      buckets[call.key] = { accounts: [], posts: [], recognized: false, failed: true };
      if (call.error) warnings.push(`${call.title}: ${call.error}`);
      continue;
    }
    const parsed = parseProviderPayload(call.output, channel === "instagram" ? call.key : undefined);
    if (channel === "instagram" && call.key === "replies") {
      const shortcode = findInstagramShortcode(calls.find((entry) => entry.key === "posts")?.output);
      if (shortcode) {
        const url = `https://www.instagram.com/p/${shortcode}/`;
        parsed.posts = parsed.posts.map((post) => ({ ...post, url: post.url ?? url }));
      }
    }
    buckets[call.key] = { ...parsed, failed: false };
    if (!parsed.recognized) warnings.push(`${call.title} came back in a shape Pay Small Check could not read.`);
  }
  const profileAccounts = buckets.profile?.accounts ?? [];
  const aboutAccounts = buckets.about?.accounts ?? [];
  const primary = pickHandle(profileAccounts, handle) ?? pickHandle(profileAccounts, "");
  const extra = pickHandle(aboutAccounts, handle) ?? pickHandle(aboutAccounts, "");
  const profile = primary && extra ? fillAccount(primary, extra) : primary ?? extra;
  const snapshot: VendorSnapshot = {
    profile,
    posts: buckets.posts?.posts ?? [],
    replies: buckets.replies?.posts ?? [],
    mentions: (buckets.mentions?.posts ?? []).filter((post) => post.handle?.toLowerCase() !== handle.toLowerCase()),
    followers: (buckets.followers?.accounts ?? []).filter((account) => account.handle.toLowerCase() !== handle.toLowerCase()),
    gaps: {
      profile: !profile,
      posts: !buckets.posts || buckets.posts.failed || !buckets.posts.recognized,
      replies: !buckets.replies || buckets.replies.failed || !buckets.replies.recognized,
      followers: !buckets.followers || buckets.followers.failed || !buckets.followers.recognized,
      mentions: !buckets.mentions || buckets.mentions.failed || !buckets.mentions.recognized,
    },
  };
  if (channel === "instagram") {
    if (!snapshot.gaps.mentions) {
      const relevant = snapshot.mentions.filter((post) => referencesAccount(post.text, handle, snapshot.profile?.displayName));
      const accused = relevant.filter((post) => isComplaint(post.text));
      if (accused.length === 0) {
        snapshot.mentions = [];
        snapshot.gaps.mentions = true;
        snapshot.mentionCoverage = "unknown";
        warnings.push(
          "Instagram general-search results are not verified complaints about this account; complaint coverage is unknown.",
        );
      } else {
        snapshot.mentions = accused;
      }
    }
    if (snapshot.profile?.postsCount === 0 && snapshot.posts.length > 0) {
      snapshot.profile = { ...snapshot.profile, postsCount: undefined };
      warnings.push("Profile reported zero posts despite returned media; total post count is unknown.");
    }
  }
  return { snapshot, warnings };
}

/**
 * A keyword search for the handle will mention that word without accusing the account.
 * An explicit reference is an @handle, a profile URL, or a multi-word display name.
 */
function referencesAccount(text: string, handle: string, displayName?: string): boolean {
  const needle = handle.toLowerCase();
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`@${escaped}\\b`, "i").test(text)) return true;
  if (text.toLowerCase().includes(`instagram.com/${needle}`)) return true;
  if (!displayName) return false;
  const words = displayName
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 3 && word !== needle);
  if (words.length < 2) return false;
  const hay = text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ");
  return hay.includes(words.slice(0, 3).join(" "));
}

function pickHandle(accounts: AccountFacts[], handle: string): AccountFacts | null {
  if (!handle) return accounts[0] ?? null;
  return accounts.find((account) => account.handle.toLowerCase() === handle.toLowerCase()) ?? null;
}

function fillAccount(primary: AccountFacts, extra: AccountFacts): AccountFacts {
  return {
    handle: primary.handle,
    displayName: primary.displayName ?? extra.displayName,
    bio: primary.bio ?? extra.bio,
    createdAt: primary.createdAt ?? extra.createdAt,
    followers: primary.followers ?? extra.followers,
    following: primary.following ?? extra.following,
    postsCount: primary.postsCount ?? extra.postsCount,
    verified: primary.verified ?? extra.verified,
    defaultProfileImage: primary.defaultProfileImage ?? extra.defaultProfileImage,
    location: primary.location ?? extra.location,
    id: primary.id ?? extra.id,
  };
}

export function analysisFromCalls(
  handle: string,
  calls: BuyCallResult[],
  now = new Date(),
  channel: CheckChannel = "x",
): Analysis & { warnings: string[] } {
  const { snapshot, warnings } = snapshotFromCalls(handle, calls, channel);
  return { ...analyzeVendor(handle, snapshot, now, channel), warnings };
}
