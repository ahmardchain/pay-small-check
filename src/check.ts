import { createBuyPayer, shouldStopAfter, type BuyCallResult } from "./lib/buy.js";
import { loadCatalog } from "./lib/catalog.js";
import { resolvePlan } from "./lib/capabilities.js";
import { analysisFromCalls } from "./lib/snapshot.js";
import type { Settings } from "./settings.js";

export interface LiveCheck {
  calls: BuyCallResult[];
  warnings: string[];
  analysis: ReturnType<typeof analysisFromCalls> | null;
  charge: boolean;
  error?: string;
}

export async function runLiveCheck(settings: Settings, handle: string, fetchImpl: typeof fetch = fetch): Promise<LiveCheck> {
  if (!settings.agentPrivateKey) {
    return { calls: [], warnings: [], analysis: null, charge: false, error: "AGENT_PRIVATE_KEY is not set" };
  }
  let catalog: unknown;
  try {
    catalog = await loadCatalog(settings.catalogUrl, fetchImpl);
  } catch (error) {
    return {
      calls: [],
      warnings: [],
      analysis: null,
      charge: false,
      error: error instanceof Error ? error.message : "Could not read the buy catalog",
    };
  }
  const { calls, missing } = resolvePlan(catalog, handle);
  const warnings = missing.map((id) => `buy catalog has no available capability ${id}`);
  const payer = createBuyPayer({
    privateKey: settings.agentPrivateKey,
    rpcUrl: settings.rpcUrl,
    tokenAddress: settings.buyToken.address,
    tokenSymbol: settings.buyToken.symbol,
    maxAtomic: settings.maxAtomicPerCall,
    fetchImpl,
  });
  const results: BuyCallResult[] = [];
  for (const call of calls) {
    const result = await payer.pay(call);
    result.amount = call.indicativeAtomic ?? null;
    results.push(result);
    if (shouldStopAfter(result)) {
      warnings.push("Stopped after an uncertain buy payment. That call was not retried.");
      break;
    }
  }
  const settled = results.some((call) => call.settled === true || Boolean(call.txHash));
  const parsed = results.some((call) => call.ok && call.output != null);
  if (!settled && !parsed) {
    return {
      calls: results,
      warnings,
      analysis: null,
      charge: false,
      error: "No buy call returned data. Nothing was charged for this check.",
    };
  }
  const analysis = analysisFromCalls(handle, results);
  return { calls: results, warnings: [...warnings, ...analysis.warnings], analysis, charge: true };
}

export function stripOutput(call: BuyCallResult) {
  const { output: _output, ...rest } = call;
  return rest;
}
