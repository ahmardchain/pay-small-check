import { codeFromRepo } from "@celo/attribution-tags";

/** Stable ERC-8021 code for this repository. Override with ATTRIBUTION_CODE when Loops issues one. */
export const DEFAULT_ATTRIBUTION_CODE = codeFromRepo("ahmardchain/pay-small-check");

export function resolveAttributionCode(override: string | undefined): string {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;
  return DEFAULT_ATTRIBUTION_CODE;
}
