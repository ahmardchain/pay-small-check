# Pay Small Check

[![Celo mainnet](https://img.shields.io/badge/Celo-mainnet%2042220-FCFF52)](https://celoscan.io)
[![x402](https://img.shields.io/badge/payments-x402-111111)](https://x402.celo.org)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-agent%2010045-0c6b4f)](https://celoscan.io/tx/0x56926cb9a3faba200070350065c04ba7ec0ae2378670428b6df95ea2a940f9c6)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> Check the vendor on X before you send the money.

Judge run-through: [JUDGES.md](JUDGES.md).

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

## For judges: verify in 60 seconds

Checked against the live deployment on 6 Nov 2026.

1. Open the app: https://pay-small-check.ahmardchain.workers.dev
2. Open the proof page: https://pay-small-check.ahmardchain.workers.dev/proof (`/proof` redirects to `/proof/`). The receipt list was empty at check time. New paid checks show up here.
3. Open the registration file: https://pay-small-check.ahmardchain.workers.dev/agent.json — agent id **10045**, wallet `eip155:42220:0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08`, code `celo_aac08e9358f3`.
4. Open the public config: https://pay-small-check.ahmardchain.workers.dev/api/config — `dryRun` is `false`, `priceUsd` is `"0.08"`, `payTo` and `agentPayer` are `0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08`, `agentId` is `"10045"`, six calls are listed.
5. Open the registration transaction: https://celoscan.io/tx/0x56926cb9a3faba200070350065c04ba7ec0ae2378670428b6df95ea2a940f9c6 — status success, `register` on the Identity Registry, ERC-721 token id **10045** minted to `0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08`. The input data ends with the attribution tag. Hex of `celo_aac08e9358f3` is `63656c6f5f616163303865393335386633`, then length `11`, schema `00`, then the `8021` marker repeated:

```text
63656c6f5f616163303865393335386633110080218021802180218021802180218021
```

6. PayTo for the buyer's fee, and the wallet that pays buy, are the same address: [`0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08`](https://celoscan.io/address/0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08).

Unpaid check. This does not spend. It returned HTTP 402 with a `PAYMENT-REQUIRED` header (x402 version 2, three accepts, each `80000` on `eip155:42220`, PayTo the wallet above):

```bash
curl -i -X POST https://pay-small-check.ahmardchain.workers.dev/api/checks \
  -H 'content-type: application/json' -H 'accept: application/json' \
  -d '{"handle":"celo"}'
```

## Demo flow (90 seconds)

1. Open https://pay-small-check.ahmardchain.workers.dev on a phone or a narrow window.
2. Paste an X handle. The field accepts `@name` or `name`.
3. Choose USDT or cUSD. The fee shown is $0.08.
4. Pay. In MiniPay that is a stablecoin transfer and the network fee comes out of the same coin. In a wallet that can sign typed data, USDT can be a gasless x402 signature. cUSD is always a transfer.
5. Wait. The agent buys six X reads from buy, then the page stamps **Safe**, **Caution**, or **Risky**, with the reasons and links.
6. Open **Open the public receipt**. That is `/proof/?id=…`. The same row is on https://pay-small-check.ahmardchain.workers.dev/proof/.

Practice mode is not what the live site does. A local `npm run dev` with the committed `DRY_RUN=true` stamps a verdict from sample posts and says so.

## What's real (not mocked)

| Piece | State |
|---|---|
| Live site `dryRun: false`, price $0.08, PayTo, agent 10045 | Real. Read them on [/api/config](https://pay-small-check.ahmardchain.workers.dev/api/config) |
| ERC-8004 registration, agent 10045, tag in the calldata | Real. [Transaction](https://celoscan.io/tx/0x56926cb9a3faba200070350065c04ba7ec0ae2378670428b6df95ea2a940f9c6) |
| Unpaid `POST /api/checks` → 402 `PAYMENT-REQUIRED` for USDT, USDC, USA₮ | Real. Curl above |
| Six buy routes (profile, about, posts, replies, followers, complaint search) | Real endpoints on `gateway.usebuy.ai`, each quoted at $0.005 on 6 Nov 2026. A live check pays them. This README does not paste a settled buy hash, because [/api/receipts](https://pay-small-check.ahmardchain.workers.dev/api/receipts) was `{ "receipts": [] }` when checked |
| Buyer payments and buy transaction hashes on `/proof` | The page is real. Counts are not invented here. They show up as people pay |
| `@safevendor`, `@cautionvendor`, `@riskyvendor` | Sample posts, labeled practice. Only when `DRY_RUN=true` (local default in `wrangler.jsonc`). Not the live site |
| WhatsApp | Coming-soon page at `/whatsapp/`. The field is disabled. Nothing is uploaded. No WhatsApp data source |
| Instagram | Not built. Named as a later phase |
| A guarantee the vendor will deliver | Not what this is. The verdict is a reading of public posts |

## Build with buy: judging criteria map

| Criterion | Where to look |
|---|---|
| Problem solved | A buyer is about to pay a vendor they only know from X. The app returns Safe, Caution, or Risky with links before that payment |
| Depth of integration: verified paid calls into services this project does not control | One check buys six capabilities from the [buy gateway](https://gateway.usebuy.ai/v1/catalog). Each is its own x402 payment on Celo. The gateway PayTo is `0x20faAca5F980E29639A0FCC6dcA6988E18ed333B`, not this app |
| Growth for those services | Six calls per check, about $0.03 of catalog price at the 6 Nov 2026 quotes ($0.005 × 6), not one repeated cheap call. A missing or unreadable complaint search cannot be scored Safe |
| Independent users are a qualifier | Any existing Celo wallet can pay (MiniPay transfer, or an x402 signature). No count is claimed here. Paid checks are collected on [/proof](https://pay-small-check.ahmardchain.workers.dev/proof/) |
| Proof of payment | `/proof` stores the buyer transaction and each buy transaction hash. The list was empty at the last check; do not treat this README as a substitute for that page |
| PayTo | `0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08`. x402 settlements cannot carry the attribution tag, so this address is the identifier. It is also `payTo` on the live 402 |
| ERC-8004 required | Agent **10045**, registry `eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, [registration tx](https://celoscan.io/tx/0x56926cb9a3faba200070350065c04ba7ec0ae2378670428b6df95ea2a940f9c6). The tag `celo_aac08e9358f3` is on that calldata. The same code is appended to MiniPay transfer calldata |

## Reproduce locally

No wallet and no spend:

```bash
npm install
npm test
npm run check:dry -- @riskyvendor
```

`npm test` does not call the network for a payment. `check:dry` prints a practice verdict for `@riskyvendor` and says the posts are a sample.

## AI usage & prior work disclosure

This project was written during Agents on Open Rails with AI coding assistance. There was no prior product code. The repository started from the MIT license.

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

One payment buys one check. Before the first buy call, the transfer hash or the x402 payer and nonce is reserved in D1. A second request with the same payment, even sent at the same moment, gets `409 payment_used` and spends nothing. The reservation is released only when a check charged nothing, so a failed check can be retried with the same payment.

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
| `npm test` | 27 tests: verdicts, catalog plan, ERC-8021 round-trip, x402 challenge, transfer receipt, parallel payment replays on both rails. The x402 challenge test calls the hosted facilitator, so it needs network | No |
| `npm run typecheck` | `tsc --noEmit` | No |
| `npm run check:dry -- @handle` | Prints a practice verdict | No |
| `npm run dev` | Worker on localhost. Practice mode unless `DRY_RUN=false` | No, while `DRY_RUN=true` |
| `npm run register:8004 -- --dry-run` | Prints the tagged `register` transaction. Already broadcast; see the tx above | No |
| `npm run deploy` | Cloudflare Workers. Needs the Standard usage model | Deploy only |

To take live payments from a fresh deploy: set `AGENT_PRIVATE_KEY` for `0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08` as a Wrangler secret, set `X402_API_KEY` from [x402.celo.org](https://x402.celo.org), set `DRY_RUN=false` and `AGENT_ID=10045`, create the D1 database and apply both migrations (`npm run db:migrate`, before every deploy that adds one), and deploy. The key is not in this repo. Fund the wallet with USDT (or USDC / USAT if `BUY_TOKEN` changes). About $0.03 of the $0.08 fee is the six data calls at the 6 Nov catalog quotes.

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
└── migrations/             # D1 receipts and payment reservations
```

## Known limits

- Version 1 reads X only. The WhatsApp page does not submit. Instagram is not wired.
- cUSD cannot be an x402 payment on the hosted facilitator. It is a transfer.
- x402 payments do not carry `celo_aac08e9358f3`. Use the PayTo address for those.
- The complaint-search payload is whatever the gateway returns. A shape this app cannot read is a gap, not a clean bill of health.
- A paid call is not automatically repeated after a timeout or `settle_uncertain`.
- A transfer is not bound to the person who sent it. Whoever submits a matching transaction hash first gets the check.

## License

MIT. See [LICENSE](LICENSE).
