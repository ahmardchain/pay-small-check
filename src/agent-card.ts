import { AGENT_REGISTRY } from "./lib/tokens.js";
import type { Settings } from "./settings.js";

/** ERC-8004 registration file. `registrations` is added after the on-chain id is known. */
export function registrationFile(settings: Settings) {
  const origin = settings.publicAppUrl || "https://example.com";
  const file: Record<string, unknown> = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "Pay Small Check",
    description:
      "Checks an X vendor for a Nigerian buyer before they pay. Buys profile, posts, replies, follower, and complaint data through the buy gateway on Celo and returns Safe, Caution, or Risky.",
    services: [
      { name: "web", endpoint: `${origin}/` },
      { name: "x402", endpoint: `${origin}/api/checks`, version: "2" },
    ],
    x402Support: true,
    active: true,
    supportedTrust: ["reputation"],
  };
  if (settings.agentId) {
    file.registrations = [
      {
        agentId: Number(settings.agentId),
        agentRegistry: AGENT_REGISTRY,
      },
    ];
  }
  return file;
}
