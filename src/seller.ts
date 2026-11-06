import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import type { RoutesConfig } from "@x402/core/server";
import { CATALOG_VERIFIED_ON, SERVICE_LIST } from "./services.js";
import { CNGN, USDT, type Settings } from "./settings.js";

export function checkRoutes(settings: Settings): RoutesConfig {
  const payTo = settings.payTo ?? "0x0000000000000000000000000000000000000000";
  return {
    "POST /api/check": {
      accepts: [
        {
          scheme: "exact",
          network: "eip155:42220",
          payTo,
          price: {
            amount: settings.priceUsdt,
            asset: USDT.asset,
            extra: { name: USDT.name, version: USDT.version },
          },
          maxTimeoutSeconds: 300,
        },
        {
          scheme: "exact",
          network: "eip155:42220",
          payTo,
          price: {
            amount: settings.priceCngn,
            asset: CNGN.asset,
            extra: {
              name: CNGN.name,
              version: CNGN.version,
              assetTransferMethod: "permit2",
            },
          },
          maxTimeoutSeconds: 300,
        },
      ],
      description:
        "Risk score for a Nigerian Instagram, WhatsApp, or shop-link vendor before you pay them. Returns low, medium, or high with evidence and the paid-call receipts.",
      mimeType: "application/json",
      unpaidResponseBody: () => ({
        contentType: "application/json",
        body: {
          error: "payment_required",
          payTo,
          accepts: ["cNGN", "USDT"],
          prices: priceTable(settings),
        },
      }),
      extensions: declareDiscoveryExtension({
        bodyType: "json",
        input: { query: "@vendor" },
        inputSchema: {
          properties: {
            query: { type: "string", description: "Instagram handle, WhatsApp number, or shop URL" },
          },
          required: ["query"],
        },
        output: {
          example: { risk: "medium", summary: "Public traces are thin.", receipts: [] },
        },
      }),
    },
  };
}

export function statusBody(settings: Settings) {
  return {
    name: "Pay-Small-Check",
    network: "celo",
    chainId: 42220,
    mode: settings.buyMode,
    payment: settings.paymentMode,
    payTo: settings.payTo ?? null,
    attributionCode: settings.attributionCode,
    prices: priceTable(settings),
    buyToken: settings.buyToken,
    catalogVerifiedOn: CATALOG_VERIFIED_ON,
    services: SERVICE_LIST.map((service) => ({
      id: service.id,
      catalogId: service.catalogId,
      title: service.title,
      url: service.url,
      quotedAtomic: service.quotedAtomic,
    })),
    facilitator: "https://api.x402.celo.org",
    gateway: "https://gateway.usebuy.ai",
  };
}

export function priceTable(settings: Settings) {
  return {
    USDT: {
      atomic: settings.priceUsdt,
      asset: USDT.asset,
      display: `$${(Number(settings.priceUsdt) / 1_000_000).toFixed(2)}`,
    },
    cNGN: {
      atomic: settings.priceCngn,
      asset: CNGN.asset,
      display: `${Number(settings.priceCngn) / 1_000_000} cNGN`,
    },
  };
}
