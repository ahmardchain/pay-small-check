# Submission kit

Copy-paste answers for the [Agents on Open Rails](https://www.loops.house/agents-on-open-rails) form. Keep this file in sync with what is submitted.

Deadline: **Mon 9 Nov 2026, 09:00 GMT** (10:00 Lagos).

## Basics

| Field | Answer |
|---|---|
| Project name | Pay Small Check |
| One line | Check the vendor on X before you send the money. |
| Track | Build with buy |
| Live app | https://pay-small-check.ahmardchain.workers.dev |
| Public repo | https://github.com/ahmardchain/pay-small-check |
| Proof of payments | https://pay-small-check.ahmardchain.workers.dev/proof/ |
| ERC-8004 agent id | 10045 ([registration tx](https://celoscan.io/tx/0x56926cb9a3faba200070350065c04ba7ec0ae2378670428b6df95ea2a940f9c6)) |
| Agent / PayTo wallet | `0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08` |
| ERC-8021 attribution code | `celo_aac08e9358f3` |
| Network | Celo mainnet, chain id 42220 |
| Builder | AHMARD, [@ahmardchain](https://x.com/ahmardchain) |

## Description

A buyer who found a vendor on X pastes the handle and pays $0.08 on Celo. The agent spends that fee on six paid reads of the account through buy: profile, about card, recent posts, replies, a follower sample, and a complaint search. It returns Safe, Caution, or Risky with the posts behind the verdict, and stores a public receipt with the buyer's payment and every buy transaction.

## Problem

The [Global State of Scams 2025](https://gasa.org/knowledge-base/blog/global-scams-on-the-rise-over-half-of-adults-worldwide-report-scam-encounters) report (Global Anti-Scam Alliance and Feedzai, 46,000 adults in 42 markets) found 57% met a scam in the past year, 23% lost money, roughly [$442 billion in total](https://www.feedzai.com/blog/gasa-global-state-of-scams-report/), and shopping scams were the most common kind, hitting 54% of victims. Checking a vendor by hand means scrolling replies and guessing whether a follower count is real. Pay Small Check does that reading for the price of a few cents, before the money moves.

## Services used (not owned by this project)

| Service | How it is paid | What it is for |
|---|---|---|
| buy gateway, `gateway.usebuy.ai` | x402 `exact` on Celo, one payment per call, from the agent wallet to gateway PayTo `0x20faAca5F980E29639A0FCC6dcA6988E18ed333B` | Six X reads per check, about $0.005 each at the 6 Nov 2026 catalog quotes |
| Celo x402 facilitator, `api.x402.celo.org` | Settles the buyer's gasless USDT, USDC, or USA₮ authorization | The buyer's $0.08 fee |

Proof of payment: each receipt on [/proof](https://pay-small-check.ahmardchain.workers.dev/proof/) lists the buyer's transaction hash and one row per buy call with its transaction hash and correlation id.

## Architecture notes for judges

- **Gas.** MiniPay buyers send a normal USDT or cUSD transfer and pay the network fee in that same stablecoin. x402 buyers sign; the facilitator submits. No relayer in this app pays gas for users.
- **Attribution.** Registration and MiniPay transfers carry `celo_aac08e9358f3` in calldata. x402 settlements cannot carry a suffix, so those are identified by the PayTo wallet above.
- **One payment, one check.** A transfer hash or x402 authorization is reserved before the first buy call. Replays get `409` and spend nothing.
- **Spend limits.** A buy quote above $0.02 for one call is refused before signing. An uncertain settlement is never retried.

## Where users came from

Fill this in from real numbers before submitting: links to the posts or groups that sent people, and the count of independent paying wallets on `/proof`.

## AI usage and prior work

Written during Agents on Open Rails with AI coding assistance. No prior product code; the repository started from the MIT license.

## Checklist

| Rule | Status | Proof |
|---|---|---|
| Celo mainnet only | ✅ | [/api/config](https://pay-small-check.ahmardchain.workers.dev/api/config) shows chain 42220 and `dryRun: false` |
| Public GitHub repo | ✅ | https://github.com/ahmardchain/pay-small-check |
| ERC-8004 identity from the agent wallet | ✅ | Agent 10045, [tx](https://celoscan.io/tx/0x56926cb9a3faba200070350065c04ba7ec0ae2378670428b6df95ea2a940f9c6) |
| Attribution tag implemented | ✅ | Tag at the end of the registration calldata; appended to MiniPay transfers in `public/app.js` |
| PayTo address for x402 | ✅ | `0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08` |
| Services used and proof of payment stated | ✅ | Tables above and `/proof` |
| Independent users | ⏳ | Count on `/proof` at submission time |
| Demo video | ⏳ | Record from [DEMO-SCRIPT.md](DEMO-SCRIPT.md) |
