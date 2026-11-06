/** Convert a decimal USD string to integer atomic units without floating point. */
export function usdToAtomic(usd: string, decimals: number): bigint {
  const trimmed = usd.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid USD amount: ${usd}`);
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`Amount ${usd} has more precision than ${decimals} decimals`);
  }
  const padded = frac.padEnd(decimals, "0");
  const scale = 10n ** BigInt(decimals);
  return BigInt(whole) * scale + (padded ? BigInt(padded) : 0n);
}

export function formatAtomic(atomic: bigint, decimals: number): string {
  const scale = 10n ** BigInt(decimals);
  const whole = atomic / scale;
  const frac = (atomic % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function atomicString(usd: string, decimals: number): string {
  return usdToAtomic(usd, decimals).toString();
}
