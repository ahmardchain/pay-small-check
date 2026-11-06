/**
 * Buy gateway capabilities verified against the live catalog and an unpaid 402
 * quote on 2026-11-06. Amounts are atomic units of USDC, USD₮, or USA₮ (6 decimals).
 * The 402 for the exact body is the price authority; these caps refuse a higher quote.
 *
 * Catalog: GET https://gateway.usebuy.ai/v1/catalog
 * Skill: https://github.com/celo-org/buy-skill/blob/main/skills/use-api-gateway/SKILL.md
 */
export type ServiceDef = {
  id: string;
  catalogId: string;
  title: string;
  platform: string;
  url: string;
  /** Highest atomic amount this app will sign for one call. */
  maxAtomic: bigint;
  /** Amount the unpaid quote returned for the body this app sends. */
  quotedAtomic: string;
};

const gateway = "https://gateway.usebuy.ai";

export const SERVICES = {
  instagramProfile: {
    id: "instagram.profile",
    catalogId: "instagram.profile",
    title: "Instagram profile",
    platform: "instagram",
    url: `${gateway}/v1/social/instagram/profile`,
    maxAtomic: 5000n,
    quotedAtomic: "5000",
  },
  instagramPosts: {
    id: "instagram.posts",
    catalogId: "monid.instagram.tikhub.api-v1-instagram-v2-fetch-user-posts",
    title: "Instagram posts",
    platform: "instagram",
    url: `${gateway}/v1/social/instagram/tools/tikhub-api-v1-instagram-v2-fetch-user-posts`,
    maxAtomic: 7000n,
    quotedAtomic: "7000",
  },
  instagramComments: {
    id: "instagram.comments",
    catalogId: "monid.instagram.tikhub.api-v1-instagram-v2-fetch-post-comments",
    title: "Instagram post comments",
    platform: "instagram",
    url: `${gateway}/v1/social/instagram/tools/tikhub-api-v1-instagram-v2-fetch-post-comments`,
    maxAtomic: 7000n,
    quotedAtomic: "7000",
  },
  instagramSearch: {
    id: "instagram.search",
    catalogId: "monid.instagram.tikhub.api-v1-instagram-v2-general-search",
    title: "Instagram search",
    platform: "instagram",
    url: `${gateway}/v1/social/instagram/tools/tikhub-api-v1-instagram-v2-general-search`,
    maxAtomic: 7000n,
    quotedAtomic: "7000",
  },
  xSearch: {
    id: "x.search",
    catalogId: "x.posts.search",
    title: "X post search",
    platform: "x",
    url: `${gateway}/v1/social/x/posts/search`,
    maxAtomic: 5000n,
    quotedAtomic: "5000",
  },
  redditSearch: {
    id: "reddit.search",
    catalogId: "reddit.posts.search",
    title: "Reddit post search",
    platform: "reddit",
    url: `${gateway}/v1/social/reddit/posts/search`,
    maxAtomic: 5000n,
    quotedAtomic: "5000",
  },
  redditApify: {
    id: "reddit.apify",
    catalogId: "monid.reddit.apify.practicaltools-apify-reddit-api",
    title: "Reddit official API search",
    platform: "reddit",
    url: `${gateway}/v1/social/reddit/tools/apify-practicaltools-apify-reddit-api`,
    maxAtomic: 7000n,
    quotedAtomic: "7000",
  },
  redditComments: {
    id: "reddit.comments",
    catalogId: "monid.reddit.tikhub.api-v1-reddit-app-fetch-post-comments",
    title: "Reddit post comments",
    platform: "reddit",
    url: `${gateway}/v1/social/reddit/tools/tikhub-api-v1-reddit-app-fetch-post-comments`,
    maxAtomic: 5000n,
    quotedAtomic: "5000",
  },
  browser: {
    id: "browser.session",
    catalogId: "browser.sessions.create",
    title: "Browser session (1 minute)",
    platform: "browser",
    url: `${gateway}/v1/browser/sessions`,
    maxAtomic: 3606n,
    quotedAtomic: "3606",
  },
  cencori: {
    id: "cencori.chat",
    catalogId: "cencori.v1.chat.completions",
    title: "Cencori verdict (maximo-atlas-1.3)",
    platform: "cencori",
    url: `${gateway}/cencori/v1/chat/completions`,
    maxAtomic: 10000n,
    quotedAtomic: "10000",
  },
} as const satisfies Record<string, ServiceDef>;

export type ServiceKey = keyof typeof SERVICES;
export const SERVICE_LIST = Object.values(SERVICES);
export const CATALOG_VERIFIED_ON = "2026-11-06";
export const MAX_PAID_CALLS = 8;
