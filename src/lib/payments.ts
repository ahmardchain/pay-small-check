import {
  createPublicClient,
  decodeEventLog,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { celo } from "viem/chains";
import { readAttribution } from "./attribution.js";
import { CELO_CHAIN_ID, tokenByAddress, type TokenInfo } from "./tokens.js";

const TRANSFER_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

export interface TransferProof {
  txHash: Hex;
  from: Address;
  to: Address;
  token: TokenInfo;
  amount: bigint;
  attributionCodes: string[];
}

export interface ChainReader {
  getChainId(): Promise<number>;
  getTransaction(hash: Hex): Promise<{ input?: Hex; to?: Address | null } | null>;
  getTransactionReceipt(hash: Hex): Promise<{
    status: "success" | "reverted";
    logs: { address: Address; data: Hex; topics: [] | [Hex, ...Hex[]] }[];
  } | null>;
}

export function celoReader(rpcUrl: string): ChainReader {
  const client = createPublicClient({ chain: celo, transport: http(rpcUrl) });
  return {
    getChainId: () => client.getChainId(),
    async getTransaction(hash) {
      const tx = await client.getTransaction({ hash });
      return { input: tx.input, to: tx.to };
    },
    async getTransactionReceipt(hash) {
      const receipt = await client.getTransactionReceipt({ hash });
      return {
        status: receipt.status,
        logs: receipt.logs.map((log) => ({
          address: log.address,
          data: log.data,
          topics: log.topics,
        })),
      };
    },
  };
}

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

export async function verifyTransferPayment(
  reader: ChainReader,
  txHash: string,
  payTo: Address,
  expected: { token: TokenInfo; amount: bigint },
): Promise<TransferProof> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new PaymentError("The payment transaction hash is not a transaction hash.");
  }
  const hash = txHash as Hex;
  const chainId = await reader.getChainId();
  if (chainId !== CELO_CHAIN_ID) {
    throw new PaymentError("The configured RPC is not Celo mainnet.");
  }
  const [tx, receipt] = await Promise.all([reader.getTransaction(hash), reader.getTransactionReceipt(hash)]);
  if (!tx || !receipt) throw new PaymentError("That transaction is not on Celo yet.");
  if (receipt.status !== "success") throw new PaymentError("The payment transaction failed.");
  if (!tx.to || tx.to.toLowerCase() !== expected.token.address.toLowerCase()) {
    throw new PaymentError(`The transaction did not call the ${expected.token.label} contract.`);
  }

  let matched: { from: Address; to: Address; value: bigint } | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== expected.token.address.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: TRANSFER_ABI, data: log.data, topics: log.topics });
      if (decoded.eventName !== "Transfer") continue;
      const args = decoded.args as { from: Address; to: Address; value: bigint };
      if (args.to.toLowerCase() !== payTo.toLowerCase()) continue;
      if (args.value !== expected.amount) continue;
      matched = args;
      break;
    } catch {
      continue;
    }
  }
  if (!matched) {
    throw new PaymentError(
      `No ${expected.token.label} transfer of the exact check fee to the PayTo wallet was found in that transaction.`,
    );
  }
  const token = tokenByAddress(expected.token.address);
  if (!token) throw new PaymentError("Unsupported token.");
  const attribution = readAttribution(tx.input);
  return {
    txHash: hash,
    from: matched.from,
    to: matched.to,
    token,
    amount: matched.value,
    attributionCodes: attribution?.codes ?? [],
  };
}

export type { PublicClient };
