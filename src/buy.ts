import { errorCodeOf, getTokenBalance, x402 } from "@celo/buy-core";
import type { LocalAccount } from "viem";
import type { ServiceDef } from "./services.js";
import { BUY_GATEWAY } from "./settings.js";
import type { Receipt } from "./types.js";

export type PaidResponse = {
  ok: boolean;
  status: number;
  json: unknown;
  receipt: Receipt;
};

type PaymentInfo = {
  asset: string;
  amount: string;
  txHash?: string;
  outcome: "confirmed" | "rejected" | "ambiguous";
  status: number;
};

export async function payService(opts: {
  account: LocalAccount;
  service: ServiceDef;
  body: unknown;
  token: "USDC" | "USDT" | "USAT";
  fetchImpl?: typeof fetch;
  readBalance?: boolean;
}): Promise<PaidResponse> {
  const receiptBase = {
    capability: opts.service.id,
    catalogId: opts.service.catalogId,
    title: opts.service.title,
    url: opts.service.url,
  };
  let payment: PaymentInfo | undefined;
  try {
    const response = await x402.payingFetch(
      {
        account: opts.account,
        network: "celo",
        preferredToken: opts.token,
        fetchImpl: opts.fetchImpl,
        readBalance: opts.readBalance
          ? (args) => getTokenBalance({ network: args.network, token: args.token, owner: args.owner })
          : undefined,
      },
      opts.service.url,
      {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(opts.body),
        maxAmount: opts.service.maxAtomic,
        maxRetries: 1,
        onPayment: (info) => {
          payment = {
            asset: info.asset,
            amount: info.amount,
            txHash: info.txHash,
            outcome: info.outcome,
            status: info.status,
          };
        },
      },
    );
    const text = await response.text();
    const json = parseJson(text);
    const outcome = payment?.outcome ?? (response.ok ? "confirmed" : "rejected");
    return {
      ok: response.ok,
      status: response.status,
      json,
      receipt: {
        ...receiptBase,
        token: opts.token,
        amountAtomic: payment?.amount ?? null,
        amountDisplay: payment ? displayAtomic(payment.amount) : null,
        txHash: payment?.txHash ?? null,
        outcome,
        detail: response.ok ? null : clip(text),
      },
    };
  } catch (error) {
    const code = errorCodeOf(error);
    const paid = code == null && payment != null;
    return {
      ok: false,
      status: 0,
      json: null,
      receipt: {
        ...receiptBase,
        token: opts.token,
        amountAtomic: payment?.amount ?? null,
        amountDisplay: payment ? displayAtomic(payment.amount) : null,
        txHash: payment?.txHash ?? null,
        outcome: paid ? "ambiguous" : "skipped",
        detail: code ? `${code}: ${clip(errorMessage(error))}` : clip(errorMessage(error)),
      },
    };
  }
}

export async function loadCatalog(fetchImpl: typeof fetch = fetch): Promise<CatalogRow[]> {
  const response = await fetchImpl(`${BUY_GATEWAY}/v1/catalog`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Buy catalog returned ${response.status}. Refusing to pay against a stale list.`);
  }
  const body = (await response.json()) as { capabilities?: CatalogRow[] };
  return body.capabilities ?? [];
}

export function assertListed(rows: CatalogRow[], service: ServiceDef): void {
  const row = rows.find((item) => item.id === service.catalogId);
  if (!row?.available) {
    throw new Error(`${service.catalogId} is not available in the live buy catalog.`);
  }
  if (row.method !== "POST" || row.url !== service.url) {
    throw new Error(`${service.catalogId} moved in the live catalog. Refusing to call a URL this build did not verify.`);
  }
}

type CatalogRow = { id?: string; available?: boolean; method?: string; url?: string };

export function displayAtomic(atomic: string): string {
  const value = Number(atomic) / 1_000_000;
  if (!Number.isFinite(value)) return atomic;
  return `$${value.toFixed(value < 0.01 ? 4 : 2)}`;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

function clip(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "paid call failed";
}

export function isBalanceStop(receipt: Receipt): boolean {
  return receipt.outcome === "skipped" && (receipt.detail?.includes("insufficient_balance") ?? false);
}
