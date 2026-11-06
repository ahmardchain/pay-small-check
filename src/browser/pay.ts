import { toDataSuffix } from "@celo/attribution-tags";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { createPermit2ApprovalTx, getPermit2AllowanceReadParams, toClientEvmSigner } from "@x402/evm";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { concat, createPublicClient, createWalletClient, custom, http, type Address, type Hex } from "viem";
import { celo } from "viem/chains";
import { CNGN, USDT } from "../settings.js";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type PayToken = "cNGN" | "USDT";

export type PaidCheck = {
  report: unknown;
  customerTx: string | null;
};

export async function payAndCheck(query: string, token: PayToken, attributionCode: string): Promise<PaidCheck> {
  const ethereum = (globalThis as { ethereum?: Eip1193 }).ethereum;
  if (!ethereum) {
    throw new Error("No wallet on this page. Open it in MiniPay or another Celo wallet.");
  }
  await ethereum.request({ method: "eth_requestAccounts" });
  const wallet = createWalletClient({ account: undefined, chain: celo, transport: custom(ethereum) });
  const [address] = await wallet.getAddresses();
  if (!address) throw new Error("The wallet did not share an account.");
  const publicClient = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
  const signer = toClientEvmSigner(
    {
      address,
      signTypedData: (message) =>
        wallet.signTypedData({
          account: address,
          domain: message.domain,
          types: message.types,
          primaryType: message.primaryType,
          message: message.message,
        } as never),
    },
    publicClient,
  );

  if (token === "cNGN") {
    await ensureCngnAllowance(wallet, publicClient, address, attributionCode);
  }

  const asset = token === "cNGN" ? CNGN.asset.toLowerCase() : USDT.asset.toLowerCase();
  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer,
    networks: ["eip155:42220"],
    paymentRequirementsSelector: (_version, requirements) => {
      const match = requirements.find((item) => item.asset.toLowerCase() === asset);
      if (!match) throw new Error(`This seller is not offering ${token} right now.`);
      return match;
    },
  });

  const response = await wrapFetchWithPayment(fetch, client)("/api/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const report = await response.json();
  if (!response.ok) {
    const message = typeof report === "object" && report && "error" in report ? String(report.error) : response.statusText;
    throw new Error(message);
  }
  return { report, customerTx: readSettlement(response) };
}

async function ensureCngnAllowance(
  wallet: {
    sendTransaction: (args: { account: Address; chain: typeof celo; to: Address; data: Hex }) => Promise<Hex>;
  },
  publicClient: {
    readContract: (args: ReturnType<typeof getPermit2AllowanceReadParams>) => Promise<unknown>;
    waitForTransactionReceipt: (args: { hash: Hex }) => Promise<unknown>;
  },
  owner: Address,
  attributionCode: string,
): Promise<void> {
  const read = getPermit2AllowanceReadParams({ tokenAddress: CNGN.asset, ownerAddress: owner });
  const allowance = await publicClient.readContract(read);
  const amount = typeof allowance === "bigint" ? allowance : 0n;
  if (amount >= BigInt(120_000_000)) return;
  const approval = createPermit2ApprovalTx(CNGN.asset);
  const hash = await wallet.sendTransaction({
    account: owner,
    chain: celo,
    to: approval.to,
    data: concat([approval.data, toDataSuffix(attributionCode)]),
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

function readSettlement(response: Response): string | null {
  const header = response.headers.get("payment-response") ?? response.headers.get("x-payment-response");
  if (!header) return null;
  try {
    const json = JSON.parse(atob(header)) as { transaction?: string };
    return json.transaction ?? null;
  } catch {
    return null;
  }
}

export type { Hex };
