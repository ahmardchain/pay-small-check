import { concat, encodeFunctionData, type Hex } from "viem";
import { fromDataSuffix, toDataSuffix } from "@celo/attribution-tags";

const CODE = /^[a-z0-9_]{1,32}$/;

export function assertAttributionCode(code: string): string {
  if (!CODE.test(code)) {
    throw new Error("ATTRIBUTION_CODE must be 1-32 characters of a-z, 0-9, or underscore");
  }
  return code;
}

export function attributionSuffix(code: string): Hex {
  return toDataSuffix(assertAttributionCode(code));
}

/** Append an ERC-8021 suffix. The EVM ignores trailing bytes, so the call still executes. */
export function tagCalldata(data: Hex, code: string): Hex {
  return concat([data, attributionSuffix(code)]);
}

export function readAttribution(data: Hex | undefined | null): { codes: string[]; schemaId: number } | null {
  if (!data || !data.startsWith("0x")) return null;
  try {
    return fromDataSuffix(data as Hex);
  } catch {
    return null;
  }
}

export const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export function taggedTransferData(to: `0x${string}`, amount: bigint, code: string): Hex {
  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [to, amount],
  });
  return tagCalldata(data, code);
}
