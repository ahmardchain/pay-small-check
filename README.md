# Pay Small Check

A buyer in Nigeria is about to pay a vendor they only know from X. Pay Small Check takes the handle, pays for that account's public record, and returns **Safe**, **Caution**, or **Risky** with the posts the verdict came from.

Version 1 reads X only. WhatsApp is a stub: a person can see where a pasted number or chat would go, and nothing is sent to a data provider. Instagram is a later phase.

## The problem

Small buyers pay vendors from X and WhatsApp every day. The usual check is a scroll through the profile and a hope that "scam", "didn't deliver", or "fake" is not sitting in the replies. That scroll misses account age, thin followers, repeated posts, and complaints that are not on the first screen.

Pay Small Check makes that check a paid, receipted step. The buyer pays a small stablecoin fee. The agent spends part of it on real data it does not own.

## How it works

```text
Buyer  ->  paste @handle  ->  pay on Celo
Agent  ->  six paid calls to buy (usebuy.ai) over x402
Agent  ->  read profile, posts, replies, followers, complaints
Buyer  <-  Safe / Caution / Risky, with links
Public <-  /proof receipt: buyer tx + each buy tx
```

One live check buys six capabilities from the [buy gateway](https://gateway.usebuy.ai). URLs come from the live catalog at request time (`GET https://gateway.usebuy.ai/v1/catalog`). These ids and URLs were available on 6 Nov 2026, each quoted at about **$0.005** in USDC, USDT, or USAT:

| What it answers | Capability id | Documented URL |
| --- | --- | --- |
| Account age, counts, bio | `monid.x.tikhub.api-v1-twitter-web-fetch-user-profile` | `POST /v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-profile` |
| About card | `monid.x.tikhub.api-v1-twitter-web-fetch-user-about` | `POST /v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-about` |
| Recent posts and repetition | `monid.x.tikhub.api-v1-twitter-web-fetch-user-post-tweet` | `POST /v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-post-tweet` |
| Replies | `monid.x.tikhub.api-v1-twitter-web-fetch-user-tweet-replies` | `POST /v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-tweet-replies` |
| A page of followers | `monid.x.tikhub.api-v1-twitter-web-fetch-user-followers` | `POST /v1/social/x/tools/tikhub-api-v1-twitter-web-fetch-user-followers` |
| Posts saying scam, fraud, fake, didn't deliver, no refund | `x.posts.search` | `POST /v1/social/x/posts/search` |

The catalog is the authority. If a row disappears or changes price, the check skips it or refuses it. A call priced above `MAX_BUY_ATOMIC_PER_CALL` (default `20000`, which is $0.02) is not signed.

The buyer fee defaults to **$0.08**, which covers those six calls with room for the facilitator fee. Change it with `CHECK_PRICE_USD`.

The verdict is deliberately plain:

- **Safe** — the account has history, the complaint search was read and came back clean, and the follower and post samples are not screaming.
- **Caution** — mixed signals, a single complaint, or a missing source. A missing complaint search can never be Safe.
- **Risky** — several complaint posts, a days-old account plus a complaint, or several warning signs at once.

It is a reading of public posts, not a promise the vendor will deliver.

## Services used

Paid, not operated by this project:

- **buy gateway** — `https://gateway.usebuy.ai`. x402 v1 and v2, scheme `exact`, Celo mainnet `eip155:42220`. Gateway PayTo observed on 6 Nov 2026: `0x20faAca5F980E29639A0FCC6dcA6988E18ed333B`. The agent pays this address. Tokens offered on the 402: USDC, USDT (`Tether USD` / version `1`), USAT (`Tether America USD` / version `1`).
- **Celo x402 facilitator** — `https://api.x402.celo.org` (`/verify`, `/settle`, `/supported`). Dashboard: `https://x402.celo.org`. Used when a buyer pays this app with a gasless signature. The agent does not need a facilitator key to pay buy. The key is only for settling the buyer's fee.

Free, used as references:

- **ERC-8004 Identity Registry** on Celo mainnet: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
- **Celo RPC** default `https://forno.celo.org`, only to read a buyer's transfer and to broadcast the registration transaction.

## How the buyer pays

Two rails, both on Celo mainnet (chain id `42220`):

1. **x402, gasless.** USDT, USDC, or USAT. The wallet signs EIP-3009 `TransferWithAuthorization`. The facilitator submits it and pays the gas. The buyer needs no CELO. This is the path for wallets that implement `eth_signTypedData_v4`, and for any HTTP client.
2. **Stablecoin transfer.** USDT or cUSD (USDm in MiniPay). MiniPay does not sign typed data, so the page sends a normal transfer and pays the network fee in that stablecoin (CIP-64 `feeCurrency`). The transfer calldata is tagged with an ERC-8021 suffix. The server accepts the hash only if the receipt contains an exact transfer of the check fee to `PAY_TO` on mainnet, and only once.

**cUSD is not an x402 asset** on the hosted facilitator (checked against `https://x402.celo.org/skill.md` and `GET /supported` behavior documented there). cUSD works on the transfer rail only. Gasless signatures are USDT, USDC, or USAT.

x402 settlements cannot carry an ERC-8021 suffix. For those transactions the identifier is the **PayTo** address in `PAY_TO`. The registration transaction and MiniPay transfers do carry the builder code.

## Proof of payment

`/proof` lists every check. Each receipt has:

- the verdict and the evidence links
- the buyer's payment transaction, when one happened
- the PayTo address
- whether attribution was an ERC-8021 code or the PayTo address (x402)
- each buy call: capability id, URL, transaction hash, and correlation id

Practice-mode receipts are labeled and have no transaction hashes. Raw provider payloads are not stored.

Celoscan links use `https://celoscan.io/tx/<hash>`.

## Practice mode

`DRY_RUN` defaults to `true`. The app boots with no keys and no funds.

```bash
npm install
npm test
npm run check:dry -- @riskyvendor
npm run dev
```

Open the printed local URL. Try `@safevendor`, `@cautionvendor`, and `@riskyvendor`. The verdicts use sample posts, and the receipt says so. The six real capability URLs are listed so you can see what a live check will buy.

`npm test` does not spend funds. It includes a mock of the buy 402 where the real `@x402/fetch` client signs a USDT authorization for Celo mainnet and stops before a quote above the cap.

## Go live

Do these in order. Nothing below is done for you, because each step spends a real key or real stablecoins.

1. **Create two pieces of config.**
   - An EVM private key for the agent. This address pays buy. Fund it with USDT on Celo mainnet (or USDC / USAT if you set `BUY_TOKEN`). About **$0.05 per check** is the data cost at the prices above. Also keep a little USDT for the registration gas if you pay gas in USDT.
   - A facilitator API key from <https://x402.celo.org> (connect a wallet, Create API key, sign). It looks like `x402_...`. New keys include a few free mainnet settlements, then the dashboard balance.

2. **Choose PayTo.** Set `PAY_TO` to the address that should receive the buyer's fee. It can be the agent address. `0x0000…0000` means "not live".

3. **Put the secrets in `.dev.vars`** (see `.env.example`). For production:

   ```bash
   npx wrangler secret put AGENT_PRIVATE_KEY
   npx wrangler secret put X402_API_KEY
   ```

   Set the public vars in `wrangler.jsonc` or the dashboard: `DRY_RUN` = `"false"`, `PAY_TO`, `BUY_TOKEN`, `CHECK_PRICE_USD`, `ATTRIBUTION_CODE`, `CELO_RPC_URL`, `PUBLIC_APP_URL`.

4. **Replace the attribution code** if the hackathon issued you one. The default is `paysmallcheck`. The issued code is what a leaderboard credits. Do this before the first real transaction. x402 payments still will not carry it. Report `PAY_TO` for those.

5. **Create the D1 database** and put its id in `wrangler.jsonc` (`database_id` is a local placeholder today):

   ```bash
   npx wrangler d1 create pay-small-check
   npm run db:migrate
   ```

6. **Deploy.**

   ```bash
   npx wrangler deploy
   ```

   The Worker needs the Standard usage model (`limits.cpu_ms` is set). A check holds the request open while buy settles each call. Budget roughly 10 seconds per paid call.

7. **Register the ERC-8004 identity** (one command, spends gas, does not run until you drop `--dry-run`):

   ```bash
   AGENT_PRIVATE_KEY=0x... \
   AGENT_URI=https://<your-worker>/agent.json \
   ATTRIBUTION_CODE=paysmallcheck \
   CELO_RPC_URL=https://forno.celo.org \
   npm run register:8004
   ```

   Preview without broadcasting:

   ```bash
   npm run register:8004 -- --dry-run
   ```

   The script calls `register(agentURI)` on `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, with the ERC-8021 suffix on the calldata, and pays gas in USDT unless `GAS_FEE_CURRENCY=celo`. Copy the printed `agentId` into `AGENT_ID` and redeploy so `/agent.json` includes `registrations`.

8. **Confirm a real check.** From a wallet that is not the agent wallet, open the site, pay, and open `/proof`. You should see your payment hash and six buy hashes. The agent address in `/api/config` (`agentPayer`) is the wallet that paid buy.

9. **Submit the hackathon entry** with this repo, the ERC-8004 id, `PAY_TO`, the attribution code, and a link to `/proof`.

`DRY_RUN=false` with a missing key returns 503 and does not invent a verdict.

## Calling the API

Practice:

```bash
curl -s -X POST http://127.0.0.1:8787/api/checks \
  -H 'content-type: application/json' \
  -d '{"handle":"@safevendor"}'
```

Live, unpaid (returns 402 and a `PAYMENT-REQUIRED` header):

```bash
curl -i -X POST https://<your-worker>/api/checks \
  -H 'content-type: application/json' -H 'accept: application/json' \
  -d '{"handle":"somevendor"}'
```

Retry with `PAYMENT-SIGNATURE`, the base64 x402 v2 payload from `@x402/fetch`. A MiniPay-style transfer retries with `{"handle":"somevendor","paymentTx":"0x…","token":"USDT"}` or `"token":"cUSD"`.

Useful routes:

| Route | Purpose |
| --- | --- |
| `GET /` | The check |
| `GET /proof` | Public receipts |
| `GET /api/config` | Price, PayTo, agent payer, tokens, capability list |
| `GET /api/receipts` and `GET /api/receipts/:id` | Receipt JSON |
| `POST /api/checks` | Run a check |
| `GET /agent.json` | ERC-8004 registration file |
| `GET /whatsapp/` | Coming soon. Nothing is uploaded. |

## Project layout

- `src/app.ts` — HTTP API
- `src/check.ts` — catalog, then the six paid calls
- `src/lib/buy.ts` — `@x402/fetch` buyer, mainnet token only, per-call cap
- `src/lib/analyze.ts` — the verdict
- `src/x402-seller.ts` — buyer fee, facilitator `https://api.x402.celo.org`
- `scripts/register-8004.ts` — ERC-8004 registration
- `public/` — mobile-first pages, including the MiniPay transfer flow

## Development

```bash
npm install
npm test
npm run typecheck
npm run dev
npm run dry-run          # wrangler deploy --dry-run, no upload
```

Node 20 or newer. The Worker compatibility date is 2026-11-06, with `nodejs_compat`.

## What is intentionally not built

- No WhatsApp or Instagram data provider. The WhatsApp page does not submit.
- No testnet payments. The hackathon is mainnet. A non-42220 RPC is rejected when a transfer is checked.
- No automatic retry of a buy call after a timeout or `settle_uncertain`. The receipt keeps the error and stops the queue.
- The paid response shapes from TikHub and the search route vary. The reader walks the JSON for profiles and posts. A payload it does not recognize is a gap, and a gap in the complaint search cannot be a Safe verdict. If buy changes a required body field, that call returns `invalid_request`, is recorded, and is not paid.

## TODO

- Confirm a live paid response once the agent wallet is funded, and tighten the normalizer if TikHub wraps posts in a shape the walker misses. The walker is tested against the nested `legacy` / `core.user_results` shape those endpoints use.
- After registration, set `AGENT_ID` so the registration file and the on-chain id match.
- Swap `ATTRIBUTION_CODE` for the code issued at hackathon enrolment before the first tagged transaction.
