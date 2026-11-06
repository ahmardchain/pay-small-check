import { getAddress, type Address } from "viem";

/**
 * Addresses checked against Celo docs and the live buy catalog on 2026-11-06.
 * USDT and USAT EIP-712 names are not the token symbols. cUSD is not an x402
 * asset on the hosted facilitator; it is only used for the MiniPay transfer rail.
 */
export const CELO_CHAIN_ID = 42220;
export const CELO_CAIP2 = "eip155:42220" as const;

export const IDENTITY_REGISTRY = getAddress("0x8004A169FB4a3325136EB29fA0ceB6D2e539a432");
export const REPUTATION_REGISTRY = getAddress("0x8004BAa17C55a88189AE136b182e5fdA19dE9b63");
export const AGENT_REGISTRY = `eip155:42220:${IDENTITY_REGISTRY}`;

export type TokenSymbol = "USDT" | "USDC" | "USAT" | "cUSD";

export interface TokenInfo {
  symbol: TokenSymbol;
  /** What a person sees in MiniPay. cUSD is labeled USDm there. */
  label: string;
  address: Address;
  /** Address passed as CIP-64 feeCurrency. For 6-decimal tokens this is the adapter, not the token. */
  feeCurrency: Address;
  decimals: number;
  eip3009: boolean;
  eip712Name?: string;
  eip712Version?: string;
  x402: boolean;
}

export const TOKENS: Record<TokenSymbol, TokenInfo> = {
  USDT: {
    symbol: "USDT",
    label: "USDT",
    address: getAddress("0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e"),
    feeCurrency: getAddress("0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72"),
    decimals: 6,
    eip3009: true,
    eip712Name: "Tether USD",
    eip712Version: "1",
    x402: true,
  },
  USDC: {
    symbol: "USDC",
    label: "USDC",
    address: getAddress("0xcebA9300f2b948710d2653dD7B07f33A8B32118C"),
    feeCurrency: getAddress("0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B"),
    decimals: 6,
    eip3009: true,
    eip712Name: "USDC",
    eip712Version: "2",
    x402: true,
  },
  USAT: {
    symbol: "USAT",
    label: "USA₮",
    address: getAddress("0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771"),
    feeCurrency: getAddress("0x0357EE22278c922e1D36cFe6b899269b161880C4"),
    decimals: 6,
    eip3009: true,
    eip712Name: "Tether America USD",
    eip712Version: "1",
    x402: true,
  },
  cUSD: {
    symbol: "cUSD",
    label: "cUSD",
    address: getAddress("0x765DE816845861e75A25fCA122bb6898B8B1282a"),
    feeCurrency: getAddress("0x765DE816845861e75A25fCA122bb6898B8B1282a"),
    decimals: 18,
    eip3009: false,
    x402: false,
  },
};

export const X402_TOKENS = [TOKENS.USDT, TOKENS.USDC, TOKENS.USAT] as const;
export const TRANSFER_TOKENS = [TOKENS.USDT, TOKENS.cUSD] as const;

export function tokenByAddress(address: string): TokenInfo | undefined {
  const needle = address.toLowerCase();
  return Object.values(TOKENS).find((token) => token.address.toLowerCase() === needle);
}

export function parseTokenSymbol(value: string | undefined, fallback: TokenSymbol): TokenInfo {
  const upper = (value ?? fallback).toUpperCase();
  if (upper === "USDT" || upper === "USDC" || upper === "USAT") return TOKENS[upper];
  throw new Error(`BUY_TOKEN must be USDC, USDT, or USAT. Received ${value}`);
}

export function isAddress(value: string | undefined | null): value is Address {
  return !!value && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/i.test(value);
}
