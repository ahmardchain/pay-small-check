# Changelog

## Unreleased

- Instagram is a paid channel on the same $0.08 fee. The 6 Nov 2026 catalog quotes are $0.031, or $0.038 when a post shortcode adds the comment call.
- Facebook is a disabled coming-soon choice and returns 501. An unsupported channel, including WhatsApp, returns 400.
- One payment buys one check. Transfer hashes and x402 authorizations are reserved in D1 (`payment_claims`, migration `0002`) before the first paid buy call, so replays get `409` and spend nothing.
- Replay tests for both payment rails.
- README restructured; logo, screenshots, CI workflow, submission kit, demo script, and launch posts added.

## 1.0.0 — 2026-11-06

- Live on Celo mainnet with `dryRun: false`.
- $0.08 check fee over x402 (USDT, USDC, USA₮) or by transfer (USDT, cUSD).
- Six paid buy calls per check; Safe, Caution, or Risky verdict with evidence links.
- Public receipts on `/proof`.
- ERC-8004 agent 10045 registered with the `celo_aac08e9358f3` attribution tag.
