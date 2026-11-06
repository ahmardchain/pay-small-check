import type { VendorSnapshot } from "./analyze.js";
import { CHECK_PLAN } from "./capabilities.js";

const open = { profile: false, posts: false, replies: false, followers: false, mentions: false };

export function fixtureFor(handle: string): { snapshot: VendorSnapshot; sample: boolean; label: string } {
  const key = handle.toLowerCase();
  if (key === "safevendor") return { snapshot: safeSnapshot(), sample: true, label: "safe" };
  if (key === "riskyvendor") return { snapshot: riskySnapshot(), sample: true, label: "risky" };
  return { snapshot: cautionSnapshot(handle), sample: true, label: "caution" };
}

function safeSnapshot(): VendorSnapshot {
  return {
    profile: {
      handle: "safevendor",
      displayName: "Safe Vendor",
      bio: "Lagos shop. Delivery before payment confirmation.",
      createdAt: "Wed Oct 10 20:19:24 +0000 2018",
      followers: 2400,
      following: 300,
      postsCount: 400,
      verified: false,
      defaultProfileImage: false,
      location: "Lagos",
      id: "1050123456789012345",
    },
    posts: [
      post("safevendor", "201", "New ankara in stock. Pickup in Yaba or delivery after transfer."),
      post("safevendor", "202", "Closed on Sunday. Orders from Saturday ship Monday."),
      post("safevendor", "203", "Thank you for the review, Tunde. The second parcel leaves today."),
      post("safevendor", "204", "Size guide is in the pinned post."),
    ],
    replies: [post("safevendor", "301", "Sent the receipt. Tell me when it arrives.")],
    mentions: [post("buyerada", "401", "Got my order from @safevendor yesterday.")],
    followers: Array.from({ length: 8 }, (_, index) => ({
      handle: `reader${index}`,
      createdAt: "Tue Jan 12 10:00:00 +0000 2016",
      followers: 80 + index,
      following: 40,
      postsCount: 20,
      defaultProfileImage: false,
    })),
    gaps: open,
  };
}

function cautionSnapshot(handle: string): VendorSnapshot {
  return {
    profile: {
      handle,
      displayName: handle,
      bio: "DM for price",
      createdAt: "Mon Mar 02 10:00:00 +0000 2026",
      followers: 860,
      following: 140,
      postsCount: 36,
      verified: false,
      defaultProfileImage: false,
      id: "1890000000000000001",
    },
    posts: [
      post(handle, "501", "Shoes available. Pay to the number in my bio."),
      post(handle, "502", "Last pair. Send payment and your address."),
      post(handle, "503", "New stock of bags."),
    ],
    replies: [],
    mentions: [post("ngbuyer", "601", `@${handle} took payment and didn't deliver the shoes.`)],
    followers: Array.from({ length: 8 }, (_, index) => ({
      handle: `fan${index}`,
      createdAt: "Thu May 01 10:00:00 +0000 2020",
      followers: 40,
      following: 30,
      postsCount: 12,
      defaultProfileImage: false,
    })),
    gaps: open,
  };
}

function riskySnapshot(): VendorSnapshot {
  return {
    profile: {
      handle: "riskyvendor",
      displayName: "Flash Deals",
      bio: "",
      createdAt: new Date(Date.now() - 10 * 86_400_000).toUTCString(),
      followers: 5200,
      following: 4900,
      postsCount: 8,
      verified: false,
      defaultProfileImage: true,
      id: "1980000000000000001",
    },
    posts: [
      post("riskyvendor", "701", "Send money now. Limited slots."),
      post("riskyvendor", "702", "Send money now. Limited slots."),
      post("riskyvendor", "703", "Send money now. Limited slots."),
      post("riskyvendor", "704", "Send money now. Limited slots."),
    ],
    replies: [],
    mentions: [
      post("ada", "801", "@riskyvendor is a scam. I paid and nothing came."),
      post("tunde", "802", "Fake shop. @riskyvendor never delivered."),
      post("ngozi", "803", "No refund from @riskyvendor. Fraud."),
    ],
    followers: Array.from({ length: 8 }, (_, index) => ({
      handle: `empty${index}`,
      createdAt: new Date(Date.now() - 5 * 86_400_000).toUTCString(),
      followers: 0,
      following: 800,
      postsCount: 0,
      defaultProfileImage: true,
    })),
    gaps: open,
  };
}

function post(handle: string, id: string, text: string) {
  return {
    id,
    handle,
    text,
    createdAt: "Mon Nov 02 10:00:00 +0000 2026",
    likes: 12,
    reposts: 1,
    replies: 0,
  };
}

export function practiceBuyCalls() {
  return CHECK_PLAN.map((plan) => ({
    key: plan.key,
    capability: plan.id,
    title: plan.title,
    why: plan.why,
    url: plan.documentedUrl,
    txHash: null as string | null,
    amount: null as string | null,
    asset: null as string | null,
    token: "USDT",
    correlationId: null as string | null,
    ok: false,
    simulated: true,
    error: null as string | null,
  }));
}
