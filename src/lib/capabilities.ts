/**
 * Capability ids confirmed on the live catalog at
 * https://gateway.usebuy.ai/v1/catalog on 2026-11-06.
 * URLs and request bodies are still taken from that catalog at runtime.
 * Indicative price that day was 5000 atomic units ($0.005) of USDC, USDT, or USAT.
 */

export interface CapabilityPlan {
  key: "profile" | "about" | "posts" | "replies" | "followers" | "mentions";
  id: string;
  title: string;
  why: string;
  /** URL observed on the live catalog on 2026-11-06. Live checks use the catalog URL, not this one. */
  documentedUrl: string;
  buildBody: (handle: string) => Record<string, unknown>;
}

export const CHECK_PLAN: CapabilityPlan[] = [
  {
    key: "profile",
    id: "monid.x.tikhub.api-v1-twitter-web-fetch-user-profile",
    title: "X profile",
    why: "Account age, follower counts, bio, and verification.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-profile",
    buildBody: (handle) => ({ queryParams: { screen_name: handle } }),
  },
  {
    key: "about",
    id: "monid.x.tikhub.api-v1-twitter-web-fetch-user-about",
    title: "X account details",
    why: "The about card, which often includes when and where the account was created.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-about",
    buildBody: (handle) => ({ queryParams: { screen_name: handle } }),
  },
  {
    key: "posts",
    id: "monid.x.tikhub.api-v1-twitter-web-fetch-user-post-tweet",
    title: "Recent posts",
    why: "Whether the account posts like a real shop or repeats the same text.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-post-tweet",
    buildBody: (handle) => ({ queryParams: { screen_name: handle } }),
  },
  {
    key: "replies",
    id: "monid.x.tikhub.api-v1-twitter-web-fetch-user-tweet-replies",
    title: "Replies",
    why: "How the account answers people, including buyers.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-tweet-replies",
    buildBody: (handle) => ({ queryParams: { screen_name: handle } }),
  },
  {
    key: "followers",
    id: "monid.x.tikhub.api-v1-twitter-web-fetch-user-followers",
    title: "Follower sample",
    why: "A page of followers, used to spot empty or brand-new accounts.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-followers",
    buildBody: (handle) => ({ queryParams: { screen_name: handle } }),
  },
  {
    key: "mentions",
    id: "x.posts.search",
    title: "Complaint search",
    why: "Public posts that mention the handle next to scam, fraud, fake, or non-delivery.",
    documentedUrl: "https://gateway.usebuy.ai/v1/social/x/posts/search",
    buildBody: (handle) => ({
      query: `(@${handle}) (scam OR fraud OR fake OR "didn't deliver" OR "did not deliver" OR "never delivered" OR "no refund")`,
      type: "latest",
    }),
  },
];

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

export function resolvePlan(catalog: unknown, handle: string): { calls: ResolvedCall[]; missing: string[] } {
  const byId = new Map(capabilitiesFromCatalog(catalog).map((entry) => [entry.id, entry]));
  const calls: ResolvedCall[] = [];
  const missing: string[] = [];
  for (const plan of CHECK_PLAN) {
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
