import { analyzeVendor, type Analysis, type VendorSnapshot } from "./analyze.js";
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
  const profile =
    pickHandle(profileAccounts, handle) ??
    pickHandle(aboutAccounts, handle) ??
    pickHandle(profileAccounts, "") ??
    null;
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

export function analysisFromCalls(handle: string, calls: BuyCallResult[], now = new Date()): Analysis & { warnings: string[] } {
  const { snapshot, warnings } = snapshotFromCalls(handle, calls);
  return { ...analyzeVendor(handle, snapshot, now), warnings };
}
