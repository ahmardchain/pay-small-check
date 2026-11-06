# Pay Small Check

[![Celo mainnet](https://img.shields.io/badge/Celo-mainnet%2042220-FCFF52)](https://celoscan.io)
[![x402](https://img.shields.io/badge/payments-x402-111111)](https://x402.celo.org)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-agent%2010045-0c6b4f)](https://celoscan.io/tx/0x56926cb9a3faba200070350065c04ba7ec0ae2378670428b6df95ea2a940f9c6)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> Check the vendor on X before you send the money.

A buyer pastes an X handle. Pay Small Check charges **$0.08** on Celo, buys that account's public record from [buy](https://usebuy.ai), and returns **Safe**, **Caution**, or **Risky** with the posts the verdict came from.

Built for [Agents on Open Rails](https://www.loops.house/agents-on-open-rails) (deadline Mon 9 Nov 2026, 09:00 GMT). Track: **Build with buy**.

| | |
|---|---|
| Live app | https://pay-small-check.ahmardchain.workers.dev |
| Proof | https://pay-small-check.ahmardchain.workers.dev/proof |
| Registration file | https://pay-small-check.ahmardchain.workers.dev/agent.json |
| Source | https://github.com/ahmardchain/pay-small-check |
| Network | Celo mainnet `eip155:42220` |
| ERC-8004 agent | **10045**, minted in [`0x56926cb9…40f9c6`](https://celoscan.io/tx/0x56926cb9a3faba200070350065c04ba7ec0ae2378670428b6df95ea2a940f9c6) |
| PayTo / agent wallet | [`0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08`](https://celoscan.io/address/0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08) |
| ERC-8021 code | `celo_aac08e9358f3` |
| Buyer price | **$0.08** (USDT, USDC, or USA₮ over x402; USDT or cUSD by transfer) |

## What it does in one sentence

A person about to pay a vendor they only know from X pays $0.08, the agent spends that on six paid reads of the public account, and the receipt lists every transaction.

## Why it exists

Paying a vendor from X is usually a scroll and a hope. The complaints ("scam", "didn't deliver", "fake") sit in replies and mentions, and a new account with a bought following looks the same as a shop that has delivered for years.

1. **The check is manual.** Account age, follower quality, repeated posts, and complaint language are not on the first screen.
2. **The data is not ours.** Profile, posts, replies, followers, and search are bought per call from the buy gateway. This app does not hold an X API key.
3. **The result has to be checkable.** Safe, Caution, or Risky is useless if a judge cannot open the payment. Every check is stored on `/proof`.

WhatsApp is a coming-soon page. Nothing pasted there is uploaded, and there is no WhatsApp data source. Instagram is a later phase. Version 1 reads X only.

## How a check runs

```text
Buyer                         Pay Small Check                      buy (usebuy.ai)
  |                                  |                                    |
  |-- paste @handle --------------->|                                    |
  |<-- price $0.08, Celo mainnet ----|                                    |
  |-- x402 signature, or             |                                    |
  |   USDT / cUSD transfer --------->|                                    |
  |                                  |-- 1 profile ----------------------->|
  |                                  |-- 2 about ------------------------>|
  |                                  |-- 3 recent posts ----------------->|
  |                                  |-- 4 replies ---------------------->|
  |                                  |-- 5 follower sample -------------->|
  |                                  |-- 6 complaint search ------------->|
  |                                  |<-- each call settled, tx hash ------|
  |<-- Safe / Caution / Risky -------|                                    |
  |                                  |-- receipt on /proof                |
```

The buyer pays one fee. The agent then pays buy six times. A quote above `MAX_BUY_ATOMIC_PER_CALL` (default $0.02) is refused before it is signed. A call that times out or returns `settle_uncertain` is not retried. If the complaint search cannot be read, the verdict cannot be Safe.

## The six buy calls

Prices below are the catalog quotes read on 6 Nov 2026 (about **$0.005** each, USDC / USDT / USAT). The live catalog at `GET https://gateway.usebuy.ai/v1/catalog` is the authority at request time. Gateway PayTo for those calls: `0x20faAca5F980E29639A0FCC6dcA6988E18ed333B`.

| # | What it is for | Capability | Endpoint |
|---|---|---|---|
| 1 | Account age, counts, bio, verification | `monid.x.tikhub.api-v1-twitter-web-fetch-user-profile` | [`POST /v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-profile`](https://gateway.usebuy.ai/v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-profile) |
| 2 | About card | `monid.x.tikhub.api-v1-twitter-web-fetch-user-about` | [`POST /v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-about`](https://gateway.usebuy.ai/v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-about) |
| 3 | Recent posts, repetition, engagement | `monid.x.tikhub.api-v1-twitter-web-fetch-user-post-tweet` | [`POST /v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-post-tweet`](https://gateway.usebuy.ai/v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-post-tweet) |
| 4 | Replies | `monid.x.tikhub.api-v1-twitter-web-fetch-user-tweet-replies` | [`POST /v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-tweet-replies`](https://gateway.usebuy.ai/v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-tweet-replies) |
| 5 | A page of followers | `monid.x.tikhub.api-v1-twitter-web-fetch-user-followers` | [`POST /v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-followers`](https://gateway.usebuy.ai/v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-followers) |
| 6 | Posts saying scam, fraud, fake, didn't deliver, no refund | `x.posts.search` | [`POST /v1/social/x/posts/search`](https://gateway.usebuy.ai/v1/social/x/posts/search) |

Settlement is x402 `exact` on Celo through the gateway. The agent wallet pays. No upstream X credential is sent.

## What the buyer pays

| Rail | Who it is for | Asset | Amount |
|---|---|---|---|
| x402, gasless | Wallets that can sign EIP-712 | USDT, USDC, or USA₮ | `80000` (6 decimals) = $0.08 |
| Transfer | MiniPay, and cUSD | USDT or cUSD (USDm in MiniPay) | $0.08. cUSD is `80000000000000000` (18 decimals) |

MiniPay does not sign the x402 typed-data payload, so the page sends a normal transfer and pays the network fee in that same stablecoin. The hosted facilitator at `https://api.x402.celo.org` does **not** settle cUSD. Gasless signatures are USDT (`Tether USD`, version `1`), USDC (`USDC`, version `2`), or USA₮ (`Tether America USD`, version `1`).

x402 settlements are submitted by the facilitator and cannot carry an ERC-8021 suffix. Those payments are identified by PayTo [`0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08`](https://celoscan.io/address/0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08). Registration and MiniPay transfers append `celo_aac08e9358f3` (schema 0, marker `0x8021…`).

## Proof

[The proof page](https://pay-small-check.ahmardchain.workers.dev/proof) lists every check. Each receipt has the verdict, evidence links, the buyer's payment transaction, PayTo, whether attribution was the ERC-8021 code or the PayTo address, and one row per buy call (capability, URL, transaction hash, correlation id). Celoscan links are `https://celoscan.io/tx/<hash>`.

The receipt API was empty when this page was checked on 6 Nov 2026. The registration below is the transaction already mined. Paid checks land on `/proof` after a buyer pays.

## On-chain

| | |
|---|---|
| Chain | Celo mainnet, chain id `42220` |
| Identity Registry | [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) |
| Agent id | **10045** |
| Registration | [`0x56926cb9a3faba200070350065c04ba7ec0ae2378670428b6df95ea2a940f9c6`](https://celoscan.io/tx/0x56926cb9a3faba200070350065c04ba7ec0ae2378670428b6df95ea2a940f9c6) — success, 6 Nov 2026, `register(agentURI)`, gas paid in USDT |
| Agent URI | https://pay-small-check.ahmardchain.workers.dev/agent.json |
| Owner / agent wallet | [`0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08`](https://celoscan.io/address/0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08) |
| Calldata suffix | `celo_aac08e9358f3` then `0x11 0x00` then the ERC-8021 marker |

The registration file the transaction points at is live and lists the same wallet, the same code, and `registrations[].agentId = 10045`.

## For the Build with buy track

| What the track asks | Where it is |
|---|---|
| A real buyer's problem | Someone in Nigeria is about to pay a vendor they found on X |
| Paid calls into a service this project does not run | Six buy capabilities, each its own x402 payment on Celo mainnet |
| Not one cheap call repeated | Profile, about, posts, replies, followers, and a complaint search. Skipping the complaint search blocks a Safe verdict |
| Proof of payment | [/proof](https://pay-small-check.ahmardchain.workers.dev/proof) stores the buyer transaction and each buy transaction |
| A wallet a person already has | MiniPay transfer (USDT or cUSD, fee in that stablecoin) or a gasless x402 signature. No new wallet is required to try the page |
| ERC-8004 identity | Agent **10045**, [registration tx](https://celoscan.io/tx/0x56926cb9a3faba200070350065c04ba7ec0ae2378670428b6df95ea2a940f9c6) |
| ERC-8021 where a tag can be attached | `celo_aac08e9358f3` on `register` and on MiniPay transfers. x402 uses PayTo instead |
| Celo mainnet only | Chain id 42220. A transfer receipt from any other chain is rejected |

## Try it

Open https://pay-small-check.ahmardchain.workers.dev, paste a handle, and pay $0.08 from a Celo wallet. The deployed app is not in practice mode (`dryRun` is false on `/api/config`).

A local checkout does not spend anything until `DRY_RUN` is set to `false` and the secrets exist. `wrangler.jsonc` ships with `DRY_RUN=true`.

```bash
git clone https://github.com/ahmardchain/pay-small-check.git
cd pay-small-check
npm install
npm test
npm run dev
```

Practice handles, sample posts only: `@safevendor`, `@cautionvendor`, `@riskyvendor`. Or `npm run check:dry -- @riskyvendor`.

| Command | What it does | Spends? |
|---|---|---|
| `npm test` | 22 tests: verdicts, catalog plan, ERC-8021 round-trip, x402 challenge, transfer receipt | No |
| `npm run typecheck` | `tsc --noEmit` | No |
| `npm run check:dry -- @handle` | Prints a practice verdict | No |
| `npm run dev` | Worker on localhost. Practice mode unless `DRY_RUN=false` | No, while `DRY_RUN=true` |
| `npm run register:8004 -- --dry-run` | Prints the tagged `register` transaction. Already broadcast; see the tx above | No |
| `npm run deploy` | Cloudflare Workers. Needs the Standard usage model | Deploy only |

To take live payments from a fresh deploy: set `AGENT_PRIVATE_KEY` for `0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08` as a Wrangler secret, set `X402_API_KEY` from [x402.celo.org](https://x402.celo.org), set `DRY_RUN=false` and `AGENT_ID=10045`, create the D1 database (`npm run db:migrate`), and deploy. The key is not in this repo. Fund the wallet with USDT (or USDC / USAT if `BUY_TOKEN` changes). About $0.03 of the $0.08 fee is the six data calls at the 6 Nov catalog quotes.

Unpaid live call:

```bash
curl -i -X POST https://pay-small-check.ahmardchain.workers.dev/api/checks \
  -H 'content-type: application/json' -H 'accept: application/json' \
  -d '{"handle":"somevendor"}'
```

That returns `402` and a `PAYMENT-REQUIRED` header. Retry with `PAYMENT-SIGNATURE`, or with `{"handle":"somevendor","paymentTx":"0x…","token":"USDT"}` after a transfer. `"token":"cUSD"` is the transfer rail only.

## Layout

```text
pay-small-check/
├── public/                 # mobile pages: check, /proof, WhatsApp stub, about, terms
├── src/app.ts              # HTTP API
├── src/check.ts            # catalog, then the six paid calls
├── src/lib/buy.ts          # @x402/fetch buyer, Celo mainnet, per-call cap
├── src/lib/analyze.ts      # Safe / Caution / Risky
├── src/x402-seller.ts      # buyer fee via https://api.x402.celo.org
├── scripts/register-8004.ts
└── migrations/             # D1 receipts
```

## Known limits

- Version 1 reads X only. The WhatsApp page does not submit. Instagram is not wired.
- cUSD cannot be an x402 payment on the hosted facilitator. It is a transfer.
- x402 payments do not carry `celo_aac08e9358f3`. Use the PayTo address for those.
- The complaint-search payload is whatever the gateway returns. A shape this app cannot read is a gap, not a clean bill of health.
- A paid call is not automatically repeated after a timeout or `settle_uncertain`.

## License

MIT. See [LICENSE](LICENSE).
