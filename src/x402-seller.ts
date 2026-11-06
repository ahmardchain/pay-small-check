import { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer, type HTTPAdapter } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { decodePaymentResponseHeader } from "@x402/fetch";
import type { Settings } from "./settings.js";
import { CELO_CAIP2 } from "./lib/tokens.js";

export function unpaidBody(settings: Settings) {
  return {
    error: "payment_required",
    message: "Pay the check fee on Celo, then retry this request.",
    priceUsd: settings.priceUsd,
    payTo: settings.payTo,
    x402: settings.x402Prices.map(({ token, amount }) => ({
      symbol: token.symbol,
      label: token.label,
      asset: token.address,
      amount,
      network: CELO_CAIP2,
      eip712Name: token.eip712Name,
      eip712Version: token.eip712Version,
    })),
    transfer: {
      note: "MiniPay cannot sign the x402 typed-data payload. Send the exact amount to payTo with the attribution suffix appended to the transfer calldata, then POST again with paymentTx set to the transaction hash. cUSD is a transfer token only. The hosted Celo facilitator does not settle cUSD.",
      attributionCode: settings.attributionCode,
      attributionSuffix: settings.attributionSuffix,
      tokens: settings.transferPrices.map(({ token, amount }) => ({
        symbol: token.symbol,
        label: token.label,
        asset: token.address,
        feeCurrency: token.feeCurrency,
        decimals: token.decimals,
        amount,
      })),
    },
  };
}

export function createSeller(settings: Settings): x402HTTPResourceServer {
  if (!settings.payTo) throw new Error("PAY_TO is required to price a check");
  const facilitator = new HTTPFacilitatorClient({
    url: settings.facilitatorUrl,
    createAuthHeaders: async () => {
      const headers: Record<string, string> = settings.x402ApiKey ? { "X-API-Key": settings.x402ApiKey } : {};
      return { verify: headers, settle: headers, supported: headers };
    },
  });
  const server = new x402ResourceServer(facilitator);
  server.register(CELO_CAIP2, new ExactEvmScheme());
  const routes = {
    "POST /api/checks": {
      accepts: settings.x402Prices.map(({ token, amount }) => ({
        scheme: "exact" as const,
        network: CELO_CAIP2,
        payTo: settings.payTo as `0x${string}`,
        maxTimeoutSeconds: 300,
        price: {
          amount,
          asset: token.address,
          extra: { name: token.eip712Name, version: token.eip712Version },
        },
      })),
      description: "One Pay Small Check of an X vendor",
      mimeType: "application/json",
      unpaidResponseBody: async () => ({
        contentType: "application/json",
        body: unpaidBody(settings),
      }),
    },
  };
  return new x402HTTPResourceServer(server, routes);
}

export function requestAdapter(request: Request): HTTPAdapter {
  const url = new URL(request.url);
  return {
    getHeader(name: string) {
      if (name.toLowerCase() === "payment-signature") {
        return request.headers.get("payment-signature") ?? request.headers.get("x-payment") ?? undefined;
      }
      return request.headers.get(name) ?? undefined;
    },
    getMethod: () => request.method,
    getPath: () => url.pathname,
    getUrl: () => request.url,
    getAcceptHeader: () => request.headers.get("accept") ?? "",
    getUserAgent: () => request.headers.get("user-agent") ?? "",
  };
}

const readySellers = new Map<string, Promise<x402HTTPResourceServer>>();

/** Build the seller once and ask the facilitator which schemes it settles. */
export function sellerFor(settings: Settings): Promise<x402HTTPResourceServer> {
  const key = [settings.facilitatorUrl, settings.payTo, settings.priceUsd, settings.x402ApiKey ?? ""].join("|");
  const existing = readySellers.get(key);
  if (existing) return existing;
  const pending = (async () => {
    const seller = createSeller(settings);
    await seller.initialize();
    return seller;
  })();
  readySellers.set(key, pending);
  pending.catch(() => {
    if (readySellers.get(key) === pending) readySellers.delete(key);
  });
  return pending;
}

export function settlementTx(headers: Record<string, string>): string | null {
  const value = headers["PAYMENT-RESPONSE"] ?? headers["payment-response"] ?? headers["X-PAYMENT-RESPONSE"] ?? headers["x-payment-response"];
  if (!value) return null;
  try {
    const decoded = decodePaymentResponseHeader(value) as { transaction?: string };
    return decoded.transaction || null;
  } catch {
    return null;
  }
}
