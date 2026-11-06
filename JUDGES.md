# Judge run-through

About 90 seconds on the live app, then two local commands that do not spend. Facts below were read from the deployment and the buy catalog on 6 Nov 2026.

## Click path

1. Open https://pay-small-check.ahmardchain.workers.dev
   Confirm the page asks for an X or Instagram handle and shows a $0.08 fee. USDT and cUSD are the choices. Facebook is in the platform list, disabled, and labeled coming soon.
2. Open https://pay-small-check.ahmardchain.workers.dev/api/config
   Confirm `dryRun` is `false`, `priceUsd` is `"0.08"`, `agentId` is `"10045"`, `payTo` and `agentPayer` are `0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08`, `attributionCode` is `celo_aac08e9358f3`, `calls` has six X entries, `instagramCalls` lists the Instagram reads, and `facebook.status` is `"coming_soon"`.
3. Open https://pay-small-check.ahmardchain.workers.dev/agent.json
   Confirm `registrations[0].agentId` is `10045` and `services` includes `agentWallet` `eip155:42220:0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08`.
4. Open https://celoscan.io/tx/0x56926cb9a3faba200070350065c04ba7ec0ae2378670428b6df95ea2a940f9c6
   Confirm success, token id 10045, and that the input ends with:

   ```text
   63656c6f5f616163303865393335386633110080218021802180218021802180218021
   ```

   That is `celo_aac08e9358f3`, then a length byte, schema 0, and the ERC-8021 marker.
5. Open https://pay-small-check.ahmardchain.workers.dev/proof/
   `/proof` redirects here. The list is the public set of paid checks, each with the buyer's transaction and one Celoscan link per buy call. Counts live there, not in this file.
6. Facebook and an unknown channel do not score a profile.

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST https://pay-small-check.ahmardchain.workers.dev/api/checks \
     -H 'content-type: application/json' -d '{"channel":"facebook","handle":"shop"}'
   curl -s -X POST https://pay-small-check.ahmardchain.workers.dev/api/checks \
     -H 'content-type: application/json' -d '{"channel":"whatsapp","handle":"08030000000"}'
   ```

   Facebook returns `501` with `not_built`. WhatsApp returns `400` with `unsupported_channel`. Neither call buys data.

## Commands

Unpaid price challenge. Expect HTTP 402 and a `PAYMENT-REQUIRED` header. PayTo in the header is `0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08`. Amount `80000` on `eip155:42220` for USDT, USDC, and USA₮. This does not settle.

```bash
curl -i -X POST https://pay-small-check.ahmardchain.workers.dev/api/checks \
  -H 'content-type: application/json' -H 'accept: application/json' \
  -d '{"handle":"celo"}'
```

Receipt list, same data as the proof page:

```bash
curl -s https://pay-small-check.ahmardchain.workers.dev/api/receipts
```

Local, no funds. From a clone of this repo:

```bash
npm install
npm test
npm run check:dry -- @riskyvendor
```

`@riskyvendor` is a labeled sample. The live site does not use it.

## Links

| What | URL |
|---|---|
| App | https://pay-small-check.ahmardchain.workers.dev |
| Proof | https://pay-small-check.ahmardchain.workers.dev/proof/ |
| Agent file | https://pay-small-check.ahmardchain.workers.dev/agent.json |
| Config | https://pay-small-check.ahmardchain.workers.dev/api/config |
| Receipts | https://pay-small-check.ahmardchain.workers.dev/api/receipts |
| Registration | https://celoscan.io/tx/0x56926cb9a3faba200070350065c04ba7ec0ae2378670428b6df95ea2a940f9c6 |
| PayTo wallet | https://celoscan.io/address/0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08 |
| Identity Registry | https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 |
| buy catalog | https://gateway.usebuy.ai/v1/catalog |
| Hackathon | https://www.loops.house/agents-on-open-rails |

## Questions a judge may ask

**Why X and Instagram?** Both have capabilities on the buy catalog. An X check buys six reads (profile, about, posts, replies, followers, complaint search) at $0.005 each on 6 Nov 2026, about $0.030. An Instagram check buys profile (`instagram.profile`, $0.005), account details (`monid.instagram.tikhub.api-v1-instagram-v1-fetch-user-info-by-username`, $0.005), posts (`monid.instagram.tikhub.api-v1-instagram-v2-fetch-user-posts`, $0.007), followers (`monid.instagram.tikhub.api-v1-instagram-v2-fetch-user-followers`, $0.007), and a complaint search (`monid.instagram.tikhub.api-v1-instagram-v2-general-search`, $0.007). That is $0.031. Comments (`monid.instagram.tikhub.api-v1-instagram-v2-fetch-post-comments`, $0.007) run only when the posts payload has a shortcode, which makes $0.038. Both totals are under the $0.08 fee.

**Why is Facebook not a real check?** The catalog read on 6 Nov 2026 had no Facebook capabilities. The platform choice is disabled, and `channel: "facebook"` returns 501 and does not score a profile. Inventing a feed would be a fake check. WhatsApp is not a channel: that request returns 400.

**Why is cUSD a transfer, not x402?** The live 402 from this app offers USDT, USDC, and USA₮ only. The hosted facilitator does not settle cUSD. `/api/config` says the same thing. MiniPay also cannot sign the x402 typed-data payload, so the page sends a normal USDT or cUSD transfer and pays the network fee in that coin. The transfer calldata carries `celo_aac08e9358f3`. An x402 settlement cannot, so those payments are identified by PayTo.

**How does a check stop a fake vendor?** It does not freeze their wallet or escrow the buyer's later payment to them. It runs before that payment. Risky means several public complaint posts, a days-old account plus a complaint, or several warning signs together (new account, repeated posts, thin followers). The page shows the links. The buyer decides whether to pay the vendor. A missing complaint search cannot come back Safe.

**What does one check cost?** The buyer pays $0.08 (`80000` atomic USDT, USDC, or USA₮, or the same value in cUSD) on either channel. X's six catalog quotes on 6 Nov 2026 were $0.005 each, about **$0.030** of data. Instagram's quotes were **$0.031**, or **$0.038** when a post shortcode lets the comment call run. The agent wallet `0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08` pays the buy gateway (`0x20faAca5F980E29639A0FCC6dcA6988E18ed333B`). The catalog is re-read per check. A quote above $0.02 for one call is not signed.

**What if a buy call fails?** A call that did not settle is not blindly retried. A timeout or `settle_uncertain` stops the rest of the queue. If nothing settled and nothing could be read, the buyer's x402 payment is not settled and a transfer hash is not consumed, so they can retry. If some calls did settle, the check still returns a verdict from what came back, the fee is taken, and `/proof` lists which calls paid and which failed.

**Can one payment be replayed for many checks?** No. The transfer hash, or the x402 payer and nonce, is reserved in D1 before the first buy call. A repeat, including several sent in parallel, gets `409 payment_used` and makes no paid call. `test/replay.test.ts` fires five parallel replays on each rail and asserts exactly six paid calls.
