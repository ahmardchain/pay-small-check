/**
 * Capability ids confirmed on the live catalog at
 * https://gateway.usebuy.ai/v1/catalog on 2026-11-06.
 * URLs and request bodies are still taken from that catalog at runtime.
 * `quotedAtomic` is that day's per-call quote in atomic USDC, USDT, or USAT.
 * The live catalog quote is what a check actually pays, and a quote above
 * MAX_BUY_ATOMIC_PER_CALL is refused before it is signed.
 */

export type CheckChannel = "x" | "instagram";

export interface CapabilityPlan {
  key: "profile" | "about" | "posts" | "replies" | "followers" | "mentions";
  id: string;
  title: string;
  why: string;
  /** URL observed on the live catalog on 2026-11-06. Live checks use the catalog URL, not this one. */
  documentedUrl: string;
  /** Catalog quote on 2026-11-06. 5000 atomic units is $0.005; 7000 is $0.007. */
  quotedAtomic: string;
  buildBody: (handle: string) => Record<string, unknown>;
}

export const CHECK_PLAN: CapabilityPlan[] = [
  {
    key: "profile",
    id: "monid.x.tikhub.api-v1-twitter-web-fetch-user-profile",
    title: "X profile",
    why: "Account age, follower counts, bio, and verification.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-profile",
    quotedAtomic: "5000",
    buildBody: (handle) => ({ queryParams: { screen_name: handle } }),
  },
  {
    key: "about",
    id: "monid.x.tikhub.api-v1-twitter-web-fetch-user-about",
    title: "X account details",
    why: "The about card, which often includes when and where the account was created.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-about",
    quotedAtomic: "5000",
    buildBody: (handle) => ({ queryParams: { screen_name: handle } }),
  },
  {
    key: "posts",
    id: "monid.x.tikhub.api-v1-twitter-web-fetch-user-post-tweet",
    title: "Recent posts",
    why: "Whether the account posts like a real shop or repeats the same text.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-post-tweet",
    quotedAtomic: "5000",
    buildBody: (handle) => ({ queryParams: { screen_name: handle } }),
  },
  {
    key: "replies",
    id: "monid.x.tikhub.api-v1-twitter-web-fetch-user-tweet-replies",
    title: "Replies",
    why: "How the account answers people, including buyers.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-tweet-replies",
    quotedAtomic: "5000",
    buildBody: (handle) => ({ queryParams: { screen_name: handle } }),
  },
  {
    key: "followers",
    id: "monid.x.tikhub.api-v1-twitter-web-fetch-user-followers",
    title: "Follower sample",
    why: "A page of followers, used to spot empty or brand-new accounts.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-followers",
    quotedAtomic: "5000",
    buildBody: (handle) => ({ queryParams: { screen_name: handle } }),
  },
  {
    key: "mentions",
    id: "x.posts.search",
    title: "Complaint search",
    why: "Public posts that mention the handle next to scam, fraud, fake, or non-delivery.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/x/posts/search",
    quotedAtomic: "5000",
    buildBody: (handle) => ({
      query: `(@${handle}) (scam OR fraud OR fake OR "didn't deliver" OR "did not deliver" OR "never delivered" OR "no refund")`,
      type: "latest",
    }),
  },
];

/**
 * Instagram reads that take a username (or, for comments, a post shortcode)
 * and were available on the live catalog on 2026-11-06.
 * Base five calls quote to 31000 atomic units ($0.031).
 * Comments add 7000 ($0.007) only when the posts payload contains a shortcode,
 * for a maximum of 38000 ($0.038), under the $0.08 buyer fee.
 */
export const INSTAGRAM_PLAN: CapabilityPlan[] = [
  {
    key: "profile",
    id: "instagram.profile",
    title: "Instagram profile",
    why: "Public profile counts, bio, and verification.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/instagram/profile",
    quotedAtomic: "5000",
    buildBody: (handle) => ({ username: handle }),
  },
  {
    key: "about",
    id: "monid.instagram.tikhub.api-v1-instagram-v1-fetch-user-info-by-username",
    title: "Instagram account details",
    why: "A second read of the public user record by username.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/instagram/tools/tikhub-api-v1-instagram-v1-fetch-user-info-by-username",
    quotedAtomic: "5000",
    buildBody: (handle) => ({ queryParams: { username: handle } }),
  },
  {
    key: "posts",
    id: "monid.instagram.tikhub.api-v1-instagram-v2-fetch-user-posts",
    title: "Instagram posts",
    why: "Recent posts, used for repetition and engagement.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/instagram/tools/tikhub-api-v1-instagram-v2-fetch-user-posts",
    quotedAtomic: "7000",
    buildBody: (handle) => ({ queryParams: { username: handle } }),
  },
  {
    key: "followers",
    id: "monid.instagram.tikhub.api-v1-instagram-v2-fetch-user-followers",
    title: "Instagram follower sample",
    why: "A page of followers, used to spot empty accounts.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/instagram/tools/tikhub-api-v1-instagram-v2-fetch-user-followers",
    quotedAtomic: "7000",
    buildBody: (handle) => ({ queryParams: { username: handle } }),
  },
  {
    key: "mentions",
    id: "monid.instagram.tikhub.api-v1-instagram-v2-general-search",
    title: "Instagram complaint search",
    why: "Public Instagram results for this username next to the word scam.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/instagram/tools/tikhub-api-v1-instagram-v2-general-search",
    quotedAtomic: "7000",
    buildBody: (handle) => ({ queryParams: { keyword: `${handle} scam`.slice(0, 120) } }),
  },
];

/** Paid only after the posts call returns a shortcode. `buildBody` receives that code. */
export const INSTAGRAM_COMMENTS: CapabilityPlan = {
  key: "replies",
  id: "monid.instagram.tikhub.api-v1-instagram-v2-fetch-post-comments",
  title: "Instagram post comments",
  why: "Recent comments on one post, used as context for how people talk to the account.",
  documentedUrl: "https://gateway.usebuy.ai/v1/social/instagram/tools/tikhub-api-v1-instagram-v2-fetch-post-comments",
  quotedAtomic: "7000",
  buildBody: (code) => ({ queryParams: { code_or_url: code.slice(0, 300), sort_by: "recent" } }),
};

export function planFor(channel: CheckChannel): CapabilityPlan[] {
  return channel === "instagram" ? INSTAGRAM_PLAN : CHECK_PLAN;
}

/** Sum of the 2026-11-06 catalog quotes. The live check pays the catalog's own quote. */
export function quotedAtomicTotal(plans: CapabilityPlan[]): bigint {
  return plans.reduce((sum, plan) => sum + BigInt(plan.quotedAtomic), 0n);
}

export interface CatalogCapability {
  id: string;
  available?: boolean;
  method?: string;
  url?: string;
  platform?: string;
  description?: string;
  price?: {
    usd?: string;
    atomic?: string;
    tokens?: string[];
    pricingModel?: string;
  } | null;
}

export interface ResolvedCall {
  plan: CapabilityPlan;
  capability: CatalogCapability;
  url: string;
  method: "POST";
  body: Record<string, unknown>;
  indicativeAtomic?: string;
}

export function capabilitiesFromCatalog(catalog: unknown): CatalogCapability[] {
  if (!catalog || typeof catalog !== "object") return [];
  const capabilities = (catalog as { capabilities?: unknown }).capabilities;
  if (!Array.isArray(capabilities)) return [];
  return capabilities.filter((entry): entry is CatalogCapability => {
    return !!entry && typeof entry === "object" && typeof (entry as CatalogCapability).id === "string";
  });
}

export function resolvePlan(
  catalog: unknown,
  handle: string,
  plans: CapabilityPlan[] = CHECK_PLAN,
): { calls: ResolvedCall[]; missing: string[] } {
  const byId = new Map(capabilitiesFromCatalog(catalog).map((entry) => [entry.id, entry]));
  const calls: ResolvedCall[] = [];
  const missing: string[] = [];
  for (const plan of plans) {
    const capability = byId.get(plan.id);
    if (!capability?.url || capability.available === false || (capability.method ?? "POST").toUpperCase() !== "POST") {
      missing.push(plan.id);
      continue;
    }
    calls.push({
      plan,
      capability,
      url: capability.url,
      method: "POST",
      body: plan.buildBody(handle),
      indicativeAtomic: capability.price?.atomic,
    });
  }
  return { calls, missing };
}
