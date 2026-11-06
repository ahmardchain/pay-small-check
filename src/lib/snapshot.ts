import { analyzeVendor, type Analysis, type VendorSnapshot } from "./analyze.js";
import type { CheckChannel } from "./capabilities.js";
import type { BuyCallResult } from "./buy.js";
import { parseProviderPayload, type AccountFacts, type PostFacts } from "./normalize.js";

export function snapshotFromCalls(handle: string, calls: BuyCallResult[]): { snapshot: VendorSnapshot; warnings: string[] } {
  const warnings: string[] = [];
  const buckets: Record<string, { accounts: AccountFacts[]; posts: PostFacts[]; recognized: boolean; failed: boolean }> = {};
  for (const call of calls) {
    if (!call.ok || call.output == null) {
      buckets[call.key] = { accounts: [], posts: [], recognized: false, failed: true };
      if (call.error) warnings.push(`${call.title}: ${call.error}`);
      continue;
    }
    const parsed = parseProviderPayload(call.output);
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
  return { snapshot, warnings };
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
  const { snapshot, warnings } = snapshotFromCalls(handle, calls);
  return { ...analyzeVendor(handle, snapshot, now, channel), warnings };
}
