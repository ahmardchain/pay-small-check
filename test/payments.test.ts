import assert from "node:assert/strict";
import test from "node:test";
import { encodeAbiParameters, encodeEventTopics, type Hex } from "viem";
import { taggedTransferData } from "../src/lib/attribution.js";
import { PaymentError, verifyTransferPayment, type ChainReader } from "../src/lib/payments.js";
import { TOKENS } from "../src/lib/tokens.js";

const payTo = "0x1111111111111111111111111111111111111111" as const;
const from = "0x2222222222222222222222222222222222222222" as const;
const amount = 80_000n;
const hash = `0x${"ab".repeat(32)}` as Hex;

const transferAbi = [
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

function reader(overrides: Partial<ChainReader> = {}): ChainReader {
  const topics = encodeEventTopics({
    abi: transferAbi,
    eventName: "Transfer",
    args: { from, to: payTo },
  }) as [`0x${string}`, `0x${string}`, `0x${string}`];
  const data = encodeAbiParameters([{ type: "uint256" }], [amount]);
  return {
    getChainId: async () => 42220,
    getTransaction: async () => ({
      to: TOKENS.USDT.address,
      input: taggedTransferData(payTo, amount, "celo_aac08e9358f3"),
    }),
    getTransactionReceipt: async () => ({
      status: "success",
      logs: [{ address: TOKENS.USDT.address, data, topics }],
    }),
    ...overrides,
  };
}

test("a tagged USDT transfer of the exact fee is accepted", async () => {
  const proof = await verifyTransferPayment(reader(), hash, payTo, { token: TOKENS.USDT, amount });
  assert.equal(proof.from.toLowerCase(), from.toLowerCase());
  assert.deepEqual(proof.attributionCodes, ["celo_aac08e9358f3"]);
});

test("the wrong recipient is rejected and the hash is not consumed by a thrown error", async () => {
  const topics = encodeEventTopics({
    abi: transferAbi,
    eventName: "Transfer",
    args: { from, to: from },
  }) as [`0x${string}`, `0x${string}`, `0x${string}`];
  const data = encodeAbiParameters([{ type: "uint256" }], [amount]);
  await assert.rejects(
    () =>
      verifyTransferPayment(
        reader({
          getTransactionReceipt: async () => ({
            status: "success",
            logs: [{ address: TOKENS.USDT.address, data, topics }],
          }),
        }),
        hash,
        payTo,
        { token: TOKENS.USDT, amount },
      ),
    PaymentError,
  );
});

test("a testnet RPC is rejected", async () => {
  await assert.rejects(
    () => verifyTransferPayment(reader({ getChainId: async () => 11142220 }), hash, payTo, { token: TOKENS.USDT, amount }),
    /mainnet/,
  );
});
