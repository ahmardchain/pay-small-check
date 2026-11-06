import { privateKeyToAccount } from "viem/accounts";
import { resolveAttributionCode } from "./attribution.js";

export const CELO_CHAIN_ID = 42220;
export const CELO_RPC_DEFAULT = "https://forno.celo.org";
export const FACILITATOR_URL = "https://api.x402.celo.org";
export const BUY_GATEWAY = "https://gateway.usebuy.ai";

/** Celo mainnet USD₮ (EIP-3009). Confirmed on GET https://api.x402.celo.org/supported on 2026-11-06. */
export const USDT = {
  symbol: "USDT",
  asset: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
  decimals: 6,
  name: "Tether USD",
  version: "1",
} as const;

/**
 * Celo mainnet cNGN (Permit2, 6 decimals). Confirmed on the same facilitator
 * response. cNGN has no EIP-2612 permit, so the first payer approves Permit2.
 */
export const CNGN = {
  symbol: "cNGN",
  asset: "0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f",
  decimals: 6,
  name: "cNGN",
  version: "1",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
} as const;

/** $0.08. A full check spends about $0.04 at the gateway; see docs/services.md. */
export const DEFAULT_PRICE_USDT = "80000";
/** 120 cNGN. Fixed hackathon price, roughly $0.08 near 1,500 NGN per dollar. Not a live FX quote. */
export const DEFAULT_PRICE_CNGN = "120000000";

export type BuyToken = "USDC" | "USDT" | "USAT";

export type Settings = {
  buyMode: "mock" | "live";
  paymentMode: "open" | "x402";
  agentPrivateKey?: `0x${string}`;
  payTo?: `0x${string}`;
  x402ApiKey?: string;
  attributionCode: string;
  buyToken: BuyToken;
  priceUsdt: string;
  priceCngn: string;
  rpcUrl: string;
  agentEndpoint: string;
  port: number;
};

export function settingsFromEnv(env: Record<string, string | undefined>): Settings {
  const agentPrivateKey = parseKey(env.AGENT_PRIVATE_KEY ?? env.BUY_PRIVATE_KEY);
  const derived = agentPrivateKey ? privateKeyToAccount(agentPrivateKey).address : undefined;
  const payTo = parseAddress(env.PAY_TO) ?? derived;
  const buyMode = env.BUY_MODE === "live" ? "live" : "mock";
  const paymentMode = env.PAYMENT_MODE === "x402" ? "x402" : "open";
  const buyToken = parseBuyToken(env.BUY_TOKEN);
  return {
    buyMode,
    paymentMode,
    agentPrivateKey,
    payTo,
    x402ApiKey: blankToUndefined(env.X402_API_KEY),
    attributionCode: resolveAttributionCode(env.ATTRIBUTION_CODE),
    buyToken,
    priceUsdt: digits(env.CHECK_PRICE_USDT, DEFAULT_PRICE_USDT),
    priceCngn: digits(env.CHECK_PRICE_CNGN, DEFAULT_PRICE_CNGN),
    rpcUrl: blankToUndefined(env.CELO_RPC_URL) ?? CELO_RPC_DEFAULT,
    agentEndpoint: (blankToUndefined(env.AGENT_ENDPOINT) ?? "").replace(/\/$/, ""),
    port: Number(env.PORT ?? 8787) || 8787,
  };
}

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function digits(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  if (!/^\d+$/.test(trimmed) || trimmed === "0") {
    throw new Error("Check prices must be positive integer atomic amounts");
  }
  return trimmed;
}

function parseBuyToken(value: string | undefined): BuyToken {
  const token = (value?.trim() || "USDT").toUpperCase();
  if (token === "USDC" || token === "USDT" || token === "USAT") return token;
  throw new Error("BUY_TOKEN must be USDC, USDT, or USAT");
}

export function parseKey(value: string | undefined): `0x${string}` | undefined {
  const trimmed = blankToUndefined(value);
  if (!trimmed) return undefined;
  const hex = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("AGENT_PRIVATE_KEY must be a 32-byte hex private key");
  }
  return hex as `0x${string}`;
}

export function parseAddress(value: string | undefined): `0x${string}` | undefined {
  const trimmed = blankToUndefined(value);
  if (!trimmed) return undefined;
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    throw new Error("PAY_TO must be an 0x address");
  }
  return trimmed as `0x${string}`;
}
