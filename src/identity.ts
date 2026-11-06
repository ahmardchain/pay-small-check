import { toDataSuffix } from "@celo/attribution-tags";
import { concat, encodeFunctionData, type Hex } from "viem";
import type { Settings } from "./settings.js";

export const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
export const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as const;

export const identityAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

export function agentRegistration(settings: Pick<Settings, "agentEndpoint">, agentId?: string) {
  const endpoint = settings.agentEndpoint || "https://pay-small-check.example";
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "Pay-Small-Check",
    description:
      "Checks a Nigerian social-media vendor before you pay them. The agent pays buy for Instagram, X, Reddit, a browser fetch, and a Cencori verdict, then sells the check over x402 in cNGN or USD₮.",
    services: [
      { name: "web", endpoint },
      { name: "x402", endpoint: `${endpoint}/api/check` },
    ],
    x402Support: true,
    active: true,
    supportedTrust: ["reputation"],
    ...(agentId
      ? {
          registrations: [
            {
              agentId: Number(agentId),
              agentRegistry: `eip155:42220:${IDENTITY_REGISTRY}`,
            },
          ],
        }
      : {}),
  };
}

export function registrationDataUri(document: unknown): string {
  const json = JSON.stringify(document);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:application/json;base64,${btoa(binary)}`;
}

/** ERC-8004 register(agentURI) with the app's ERC-8021 suffix on the calldata. */
export function buildRegistrationCall(agentURI: string, attributionCode: string): Hex {
  const data = encodeFunctionData({
    abi: identityAbi,
    functionName: "register",
    args: [agentURI],
  });
  return concat([data, toDataSuffix(attributionCode)]);
}
