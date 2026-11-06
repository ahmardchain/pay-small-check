import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { PaymentRequirements } from "@x402/core/types";
import { CELO_CAIP2 } from "./tokens.js";
import type { ResolvedCall } from "./capabilities.js";

export interface BuyCallResult {
  key: string;
  capability: string;
  title: string;
  why: string;
  url: string;
  txHash: string | null;
  amount: string | null;
  asset: string | null;
  token: string | null;
  correlationId: string | null;
  ok: boolean;
  simulated: boolean;
  settled: boolean | null;
  retryable: boolean | null;
  output: unknown;
  error: string | null;
}

export interface BuyPayer {
  pay(call: ResolvedCall): Promise<BuyCallResult>;
}

interface PaidBody {
  output?: unknown;
  transaction?: string;
  txHash?: string;
  correlationId?: string;
  upstreamRunId?: string;
  paymentSettled?: boolean;
  retryable?: boolean;
  error?: string;
  code?: string;
}

function isRecord(value: unknown): value is PaidBody & Record<string, unknown> {
  return !!value && typeof value === "object";
}

export function readSettlement(response: Response, body: unknown): {
  txHash: string | null;
  settled: boolean | null;
  retryable: boolean | null;
  correlationId: string | null;
  output: unknown;
  error: string | null;
} {
  const header = response.headers.get("payment-response") ?? response.headers.get("x-payment-response");
  let headerTx: string | null = null;
  if (header) {
    try {
      const decoded = decodePaymentResponseHeader(header) as { transaction?: string; success?: boolean };
      if (decoded?.transaction) headerTx = decoded.transaction;
    } catch {
      try {
        const json = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as { transaction?: string };
        if (json.transaction) headerTx = json.transaction;
      } catch {
        headerTx = null;
      }
    }
  }
  const record = isRecord(body) ? body : null;
  return {
    txHash: headerTx ?? record?.transaction ?? record?.txHash ?? null,
    settled: typeof record?.paymentSettled === "boolean" ? record.paymentSettled : response.ok ? true : null,
    retryable: typeof record?.retryable === "boolean" ? record.retryable : null,
    correlationId: record?.correlationId ?? record?.upstreamRunId ?? null,
    output: record && "output" in record ? record.output : body,
    error: record?.error ?? record?.code ?? null,
  };
}

export function createBuyPayer(options: {
  privateKey: `0x${string}`;
  rpcUrl: string;
  tokenAddress: string;
  tokenSymbol: string;
  maxAtomic: bigint;
  fetchImpl?: typeof fetch;
}): BuyPayer {
  const account = privateKeyToAccount(options.privateKey);
  const payer = buildPayer(account, options);
  return {
    async pay(call) {
      try {
        return await payer(call);
      } catch (error) {
        const message = error instanceof Error ? error.message : "buy call failed before a receipt";
        const uncertain = /timeout|network|fetch failed|settle_uncertain/i.test(message);
        return {
          key: call.plan.key,
          capability: call.plan.id,
          title: call.plan.title,
          why: call.plan.why,
          url: call.url,
          txHash: null,
          amount: null,
          asset: null,
          token: options.tokenSymbol,
          correlationId: null,
          ok: false,
          simulated: false,
          settled: uncertain ? null : false,
          retryable: false,
          output: null,
          error: message,
        };
      }
    },
  };
}

function buildPayer(
  account: PrivateKeyAccount,
  options: {
    rpcUrl: string;
    tokenAddress: string;
    tokenSymbol: string;
    maxAtomic: bigint;
    fetchImpl?: typeof fetch;
  },
) {
  const asset = options.tokenAddress.toLowerCase();
  const client = new x402Client((version, requirements) => selectRequirement(version, requirements, asset, options.maxAtomic));
  client.setSpendControls({
    allowedAssets: [
      {
        network: CELO_CAIP2,
        asset: options.tokenAddress,
        maxAmountPerPayment: options.maxAtomic.toString(),
      },
    ],
    maxAmountPerPayment: "$1",
  });
  client.register(CELO_CAIP2, new ExactEvmScheme(account, { rpcUrl: options.rpcUrl }));
  const payFetch = wrapFetchWithPayment(options.fetchImpl ?? fetch, client);

  return async (call: ResolvedCall): Promise<BuyCallResult> => {
    const response = await payFetch(call.url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(call.body),
      signal: AbortSignal.timeout(45_000),
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { error: text.slice(0, 300) };
      }
    }
    const settlement = readSettlement(response, body);
    const uncertain = settlement.error === "settle_uncertain" || response.status === 500;
    return {
      key: call.plan.key,
      capability: call.plan.id,
      title: call.plan.title,
      why: call.plan.why,
      url: call.url,
      txHash: settlement.txHash,
      amount: null,
      asset: options.tokenAddress,
      token: options.tokenSymbol,
      correlationId: settlement.correlationId,
      ok: response.ok,
      simulated: false,
      settled: uncertain ? null : settlement.settled,
      retryable: uncertain ? false : settlement.retryable,
      output: response.ok ? settlement.output : null,
      error: response.ok ? null : settlement.error ?? `HTTP ${response.status}`,
    };
  };
}

export function selectRequirement(
  _version: number,
  requirements: PaymentRequirements[],
  asset: string,
  maxAtomic: bigint,
): PaymentRequirements {
  const chosen = requirements.find(
    (requirement) =>
      requirement.network === CELO_CAIP2 &&
      String(requirement.asset).toLowerCase() === asset,
  );
  if (!chosen) {
    throw new Error("buy did not offer the configured token on Celo mainnet");
  }
  const amount = BigInt(chosen.amount);
  if (amount <= 0n || amount > maxAtomic) {
    throw new Error(`buy price ${amount} exceeds the per-call cap ${maxAtomic}`);
  }
  return chosen;
}

export function shouldStopAfter(call: BuyCallResult): boolean {
  if (call.ok) return false;
  if (call.settled === null) return true;
  if (call.settled === true) return false;
  return false;
}
