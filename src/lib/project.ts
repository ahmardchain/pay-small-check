import { getAddress, type Address } from "viem";

/** Hackathon-issued ERC-8021 builder code. 17 chars, `[a-z0-9_]`. */
export const ATTRIBUTION_CODE = "celo_aac08e9358f3";

/**
 * Public agent wallet. Receives the buyer's check fee (x402 PayTo) and is the
 * address that pays buy once the matching private key is supplied.
 * The private key is never stored in this repo.
 */
export const AGENT_WALLET: Address = getAddress("0x8e23e92f0ec2bd6B8D004Bc913C17AE412322d08");
