# Demo video script

Target length: about 2 minutes. Record on a phone, or a browser window at phone width, against the live app. Upload as unlisted or public on YouTube and add the link to the README links table and to SUBMISSION.md.

| Time | Screen | Narration |
|---|---|---|
| 0:00–0:12 | Home page of https://pay-small-check.ahmardchain.workers.dev | "You found a vendor on X. Before you send them money, check them. Pay Small Check costs eight cents on Celo." |
| 0:12–0:25 | Type a real vendor handle, show USDT and the $0.08 fee | "Paste the handle. Pick USDT or cUSD. The fee is shown before anything is signed." |
| 0:25–0:45 | Confirm the payment in MiniPay or the wallet | "In MiniPay this is a normal stablecoin transfer, and the network fee comes out of the same coin. Wallets that sign typed data can pay with a gasless x402 signature instead." |
| 0:45–1:05 | Waiting state, then the verdict stamp | "The agent now pays buy six times: profile, about card, posts, replies, a follower sample, and a complaint search. Each one is its own x402 payment on Celo." |
| 1:05–1:25 | Scroll the signals and evidence | "Every reason has the post behind it. A missing complaint search can never come back Safe." |
| 1:25–1:45 | Tap "Open the public receipt", then /proof | "The receipt has my payment and one Celoscan transaction per buy call. Nothing on this page is typed in by hand." |
| 1:45–2:00 | Celoscan: registration tx for agent 10045, input data ending in the tag | "The agent is registered on ERC-8004 as agent 10045, and its transactions carry our attribution code. Check the vendor before you pay." |

## Before recording

- Fund the agent wallet so the six buy calls settle.
- Pay from a wallet that is not the agent wallet, so the receipt shows a real buyer.
- Do not use `@safevendor`, `@cautionvendor`, or `@riskyvendor` on the live site. Those are practice samples for local runs only.
