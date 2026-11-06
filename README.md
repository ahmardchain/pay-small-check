# Pay-Small-Check

A person pastes the Instagram handle, WhatsApp number, or shop link a vendor sent them, before they pay that vendor. The agent buys public traces it does not own — Instagram, X, Reddit, a one-minute browser, and a Cencori verdict — then returns **low**, **medium**, or **high**, the evidence, and the receipt for each paid call.

It does not read WhatsApp chats. A number is only searched for on public posts.

## Track

Build with buy, Agents on Open Rails. Rules and deadline (Mon 9 Nov 2026, 09:00 GMT) — see [loops.house/agents-on-open-rails](https://www.loops.house/agents-on-open-rails).

Celo mainnet only (chain id 42220). The buy client is `@celo/buy-core` `payingFetch`, aimed at `https://gateway.usebuy.ai`. The page is an x402 seller on `https://api.x402.celo.org`. Users pay a check in cNGN or USD₮. The agent pays buy in USDC, USD₮, or USA₮. The gateway does not accept cNGN.

## What works without funds, and what does not

Do a demo check with no wallet and no spend — see `npm test` and `npm run dev`. `BUY_MODE` defaults to `mock` and `PAYMENT_MODE` defaults to `open`.

| Piece | Without funds | Needs a funded wallet |
| --- | --- | --- |
| Parse a handle, Nigerian mobile, or public shop URL | Yes | |
| Score `@trusted_shop` low, `@scam_shop` high, anything else medium, with 5–8 mock receipts | Yes | |
| Sign an x402 payment against a local 402 and keep the settlement hash | Yes, unit test, no chain | |
| Unpaid `POST /api/check` returns 402 offering cNGN (Permit2) and USD₮ | Yes, if the facilitator `/supported` endpoint answers | |
| Live catalog check (`npm run verify-catalog`) | Yes, it is a free GET | |
| Instagram, X, Reddit, browser, Cencori calls and real tx hashes | | Yes. `BUY_MODE=live` and USD₮ (or USDC/USA₮) on the agent wallet |
| User payment settling to PayTo | | Yes. `PAYMENT_MODE=x402`, `X402_API_KEY`, and the user's cNGN or USD₮ |
| ERC-8004 register | Dry-run prints the calldata | `--broadcast` spends gas, paid in USD₮ as the fee currency |

`@trusted_shop`, `@scam_shop`, and a phone ending in `0000` are demo fixtures in mock mode only. Live mode uses whatever the gateway returns.

## Run

Do this — see `.env.example`.

```sh
npm install
cp .env.example .env
npm test
npm run dev
```

Open `http://localhost:8787`. The dev server rebuilds `public/pay.js` first. That file is the browser wallet client (viem and `@x402/fetch`).

`npm run wallet` prints the agent address once `AGENT_PRIVATE_KEY` is set. `npm run typecheck` is `tsc --noEmit`.

## Fund

Do this with about **$10–20 USD₮ on Celo mainnet**, sent to the address `npm run wallet` prints.

One funded check spends about **$0.04** at the gateway if every call in a full handle-plus-link plan runs (profile $0.005, posts $0.007, comments $0.007, X $0.005, Reddit $0.005, browser $0.003606, Cencori $0.01). The caps are the 402 quotes from 2026-11-06 — see [docs/services.md](docs/services.md). A quote above the cap is skipped, not paid. $10 covers a couple of hundred checks at that price; $20 leaves room if a quote moves up and you raise the cap on purpose.

The agent wallet must hold the token named by `BUY_TOKEN` (default USD₮). cNGN paid by users does not pay the gateway. Keep the USD₮ float even if every customer pays in cNGN.

Gas for the identity registration is paid in USD₮ (`feeCurrency`). You do not need a separate CELO balance for that transaction. The one-time cNGN `approve(Permit2)` is signed by the user's wallet; MiniPay can pay that gas, a raw key cannot if it holds only cNGN and the wallet does not set a fee currency.

Set `BUY_MODE=live` only after the USD₮ arrives. Set `PAYMENT_MODE=x402` when you want users to pay. Create the seller key at [x402.celo.org](https://x402.celo.org) with the PayTo wallet and put it in `X402_API_KEY`. Settlement without the key fails at the facilitator. New keys include a small number of free mainnet settlements, then gas plus 0.3% from the dashboard balance.

Default user prices: **$0.08 USD₮** (`80000` atomic) or **120 cNGN** (`120000000` atomic). 120 cNGN is a fixed price, roughly $0.08 when the naira is near 1,500 per dollar. It is not a quote from Textile or anywhere else. Change `CHECK_PRICE_USDT` and `CHECK_PRICE_CNGN` if you want a different price. Both are 6-decimal atomic strings.

## Identity

Do this — see `npm run register`.

```sh
npm run register                 # dry-run, no transaction
npm run register -- --broadcast # Celo mainnet, from AGENT_PRIVATE_KEY
```

The script calls `register(agentURI)` on `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`. The URI is a `data:` JSON document so you do not need a deployed site first. Set `AGENT_ENDPOINT` to the public origin before you broadcast if you want that URL inside the document. The receipt's `Registered` event is the agent id. The script prints `https://8004scan.io/agents/celo/<agentId>` and the Celoscan link.

The calldata includes the ERC-8021 suffix from `@celo/attribution-tags`. The default code is `codeFromRepo("ahmardchain/pay-small-check")`, which today is `celo_2dc9d9f7fa5b`. If Loops issued you a different code, set `ATTRIBUTION_CODE` before the first broadcast. A tag cannot be added later.

x402 settlements are submitted by the facilitator. Attribution tags are not applied to those transactions. The hackathon counts Build with buy by the PayTo address and the paid calls from the agent wallet. Put the PayTo address in the submission.

## Payment proof for the form

Do a live check (`BUY_MODE=live`). The JSON `receipts` array has one object per gateway call: capability, catalog id, token, atomic amount, and `txHash`. Open `https://celoscan.io/tx/<txHash>`. Those hashes are the proof that this wallet paid services it does not run.

The user's payment is a different transaction. The browser client reads the `PAYMENT-RESPONSE` header and shows that hash too. Mock receipts have `outcome: "mock"` and `txHash: null`. Do not submit those as payment proof.

`npm run verify-catalog` is the free check that the ten routes still match. It does not spend.

## Deploy

Do this — see `wrangler.jsonc`. Workers plus static assets. API requests hit the Worker; the page is an asset.

```sh
npx wrangler secret put AGENT_PRIVATE_KEY
npx wrangler secret put X402_API_KEY
```

For a funded deployment, set `BUY_MODE` to `live` and `PAYMENT_MODE` to `x402` in `wrangler.jsonc`, set `PAY_TO` and `AGENT_ENDPOINT`, run `npm run cf-typegen`, then `npx wrangler deploy`.

The checked-in vars are the mock demo, so a deploy with no edits does not spend. A full live check is several sequential gateway calls and can take a minute. The Node server (`npm start`) is the path to use if a Worker request hits the platform duration limit. CPU is mostly waiting on fetch; `limits.cpu_ms` is 30000.

## Limits

- Public data only. No WhatsApp content, no private accounts, no promise the vendor will deliver.
- The model can raise the score. It cannot lower a high heuristic, and a sentence that looks like an instruction is dropped.
- A paid call is never retried. A timeout after the payment header is sent is recorded as ambiguous.
- Cencori is listed as closed beta. If it fails after settlement, the score stays on the other calls and the receipt is kept.
- Instagram comments run only when a post shortcode is in the posts payload. Reddit comments run only when a `t3_` id is in the search payload, and only on the phone/link path.
- Shop links must be public `http(s)`. Local and private hosts are rejected before any payment.
- This build's caps and URLs are the 2026-11-06 quotes. See [docs/services.md](docs/services.md). If the catalog moves a route, the live path skips it instead of calling an unverified URL.
- No ERC-8004 identity has been minted from this repository yet. That takes the broadcast step above.
