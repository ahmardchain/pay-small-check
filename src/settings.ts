import { getAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { attributionSuffix } from "./lib/attribution.js";
import { atomicString, usdToAtomic } from "./lib/money.js";
import {
  isAddress,
  parseTokenSymbol,
  TOKENS,
  X402_TOKENS,
  type TokenInfo,
} from "./lib/tokens.js";

export interface AppBindings {
  DB?: D1Database;
  DRY_RUN?: string;
  AGENT_PRIVATE_KEY?: string;
  X402_API_KEY?: string;
  PAY_TO?: string;
  CELO_RPC_URL?: string;
  BUY_GATEWAY_CATALOG?: string;
  X402_FACILITATOR_URL?: string;
  CHECK_PRICE_USD?: string;
  BUY_TOKEN?: string;
  MAX_BUY_ATOMIC_PER_CALL?: string;
  ATTRIBUTION_CODE?: string;
  PUBLIC_APP_URL?: string;
  AGENT_ID?: string;
  GITHUB_REPO?: string;
}

export interface Settings {
  dryRun: boolean;
  payTo: Address | null;
  agentPrivateKey: Hex | null;
  agentAddress: Address | null;
  x402ApiKey: string | null;
  rpcUrl: string;
  catalogUrl: string;
  facilitatorUrl: string;
  priceUsd: string;
  buyToken: TokenInfo;
  maxAtomicPerCall: bigint;
  attributionCode: string;
  attributionSuffix: Hex;
  publicAppUrl: string;
  agentId: string;
  githubRepo: string;
  x402Prices: { token: TokenInfo; amount: string }[];
  transferPrices: { token: TokenInfo; amount: string }[];
}

export function readSettings(env: AppBindings, requestUrl?: string): Settings {
  const dryRun = (env.DRY_RUN ?? "true").toLowerCase() !== "false";
  const priceUsd = env.CHECK_PRICE_USD?.trim() || "0.08";
  usdToAtomic(priceUsd, 6);
  const buyToken = parseTokenSymbol(env.BUY_TOKEN, "USDT");
  const code = (env.ATTRIBUTION_CODE?.trim() || "paysmallcheck").toLowerCase();
  const suffix = attributionSuffix(code);
  const origin = (env.PUBLIC_APP_URL?.trim() || originOf(requestUrl) || "").replace(/\/$/, "");
  const agentPrivateKey = normalizeKey(env.AGENT_PRIVATE_KEY);
  return {
    dryRun,
    payTo: isAddress(env.PAY_TO) ? getAddress(env.PAY_TO) : null,
    agentPrivateKey,
    agentAddress: agentPrivateKey ? privateKeyToAccount(agentPrivateKey).address : null,
    x402ApiKey: env.X402_API_KEY?.trim() || null,
    rpcUrl: env.CELO_RPC_URL?.trim() || "https://forno.celo.org",
    catalogUrl: env.BUY_GATEWAY_CATALOG?.trim() || "https://gateway.usebuy.ai/v1/catalog",
    facilitatorUrl: env.X402_FACILITATOR_URL?.trim() || "https://api.x402.celo.org",
    priceUsd,
    buyToken,
    maxAtomicPerCall: BigInt(env.MAX_BUY_ATOMIC_PER_CALL?.trim() || "20000"),
    attributionCode: code,
    attributionSuffix: suffix,
    publicAppUrl: origin,
    agentId: env.AGENT_ID?.trim() || "",
    githubRepo: env.GITHUB_REPO?.trim() || "ahmardchain/pay-small-check",
    x402Prices: X402_TOKENS.map((token) => ({ token, amount: atomicString(priceUsd, token.decimals) })),
    transferPrices: [TOKENS.USDT, TOKENS.cUSD].map((token) => ({
      token,
      amount: atomicString(priceUsd, token.decimals),
    })),
  };
}

function originOf(requestUrl?: string): string {
  if (!requestUrl) return "";
  try {
    return new URL(requestUrl).origin;
  } catch {
    return "";
  }
}

function normalizeKey(value: string | undefined): Hex | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withPrefix = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(withPrefix)) {
    throw new Error("AGENT_PRIVATE_KEY must be a 32-byte hex private key");
  }
  return withPrefix as Hex;
}

export function liveBlockers(settings: Settings): string[] {
  const missing: string[] = [];
  if (!settings.payTo) missing.push("PAY_TO");
  if (!settings.agentPrivateKey) missing.push("AGENT_PRIVATE_KEY");
  return missing;
}
