# Services this app will pay for

Verified on **2026-11-06** against the live buy catalog and an unpaid HTTP 402. Nothing in this list is guessed.

- Catalog: `GET https://gateway.usebuy.ai/v1/catalog` (170 capabilities that day).
- Quote: `POST` the exact JSON body with no payment header. The gateway answered `402` and a v1 `accepts` list. Those atomic amounts are the caps in `src/services.ts`.
- Re-check before a funded run: `npm run verify-catalog`. It refuses to treat a moved or delisted capability as still valid. A live check also reads the catalog and skips payment if the URL changed.
- Tokens the gateway offered on every quote: USDC `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`, USD₮ `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`, USA₮ `0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771`. All 6 decimals. **cNGN is not a buy gateway token.**
- Gateway payee on the quotes: `0x20faAca5F980E29639A0FCC6dcA6988E18ed333B`.
- Skill followed: [use-api-gateway](https://github.com/celo-org/buy-skill/blob/main/skills/use-api-gateway/SKILL.md) (`@celo/buy` 0.8.5 is what this repo imports; the skill text pinned 0.8.4).

| App id | Catalog id | Method and URL | Quoted atomic | USD |
| --- | --- | --- | --- | --- |
| `instagram.profile` | `instagram.profile` | `POST /v1/social/instagram/profile` | 5000 | $0.005 |
| `instagram.posts` | `monid.instagram.tikhub.api-v1-instagram-v2-fetch-user-posts` | `POST /v1/social/instagram/tools/tikhub-api-v1-instagram-v2-fetch-user-posts` | 7000 | $0.007 |
| `instagram.comments` | `monid.instagram.tikhub.api-v1-instagram-v2-fetch-post-comments` | `POST /v1/social/instagram/tools/tikhub-api-v1-instagram-v2-fetch-post-comments` | 7000 | $0.007 |
| `instagram.search` | `monid.instagram.tikhub.api-v1-instagram-v2-general-search` | `POST /v1/social/instagram/tools/tikhub-api-v1-instagram-v2-general-search` | 7000 | $0.007 |
| `x.search` | `x.posts.search` | `POST /v1/social/x/posts/search` | 5000 | $0.005 |
| `reddit.search` | `reddit.posts.search` | `POST /v1/social/reddit/posts/search` | 5000 | $0.005 |
| `reddit.apify` | `monid.reddit.apify.practicaltools-apify-reddit-api` | `POST /v1/social/reddit/tools/apify-practicaltools-apify-reddit-api` with `maxResults: 1` | 7000 | $0.007 |
| `reddit.comments` | `monid.reddit.tikhub.api-v1-reddit-app-fetch-post-comments` | `POST /v1/social/reddit/tools/tikhub-api-v1-reddit-app-fetch-post-comments` | 5000 | $0.005 |
| `browser.session` | `browser.sessions.create` | `POST /v1/browser/sessions` with `durationMinutes: 1` | 3606 | $0.003606 |
| `cencori.chat` | `cencori.v1.chat.completions` | `POST /cencori/v1/chat/completions` model `maximo-atlas-1.3`, `max_tokens: 256` | 10000 | $0.01 |

Bodies match the catalog `inputSchema` from that fetch. Short routes take a flat JSON object. Generated routes take `{"queryParams": {...}}` or `{"body", "maxResults"}`. Comments and the second Reddit read run only when an earlier paid response contains a post code or a `t3_` id.

A handle check is profile, posts, comments when a shortcode exists, X search, Reddit search, then Cencori: 5 or 6 calls. A shop link adds the 1-minute browser. A phone number with no handle uses Instagram search plus the Apify Reddit search instead of the profile calls, so it does not stack two cheap copies of the same route. The planner stops at 8 calls including the verdict.

Cencori's catalog row is titled "closed beta". A settled call can still come back as a partner error. This app does not retry a paid call.

Browser commands after the rental (`open`, `get title`, `get text`) are not separate charges. The session token is not returned to the person who asked for the check.

Seller side, separate from buy: `GET https://api.x402.celo.org/supported` on the same day listed cNGN `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` (Permit2, 6 decimals, name `cNGN`, version `1`) and USD₮ (EIP-3009, name `Tether USD`, version `1`). The page offers those two. The first cNGN payer must `approve` Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3`; cNGN has no EIP-2612 permit. That approve is a transaction this app builds, and it carries the ERC-8021 suffix.
