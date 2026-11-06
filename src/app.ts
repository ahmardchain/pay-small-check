import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import { registrationFile } from "./agent-card.js";
import { runLiveCheck, stripOutput } from "./check.js";
import { analyzeVendor } from "./lib/analyze.js";
import { INSTAGRAM_COMMENTS, planFor, type CheckChannel } from "./lib/capabilities.js";
import { fixtureFor, practiceBuyCalls } from "./lib/fixtures.js";
import { parseHandle, parseInstagramHandle } from "./lib/handles.js";
import { celoReader, PaymentError, verifyTransferPayment, type ChainReader } from "./lib/payments.js";
import { d1Store, memoryStore, publicReceipt, type ReceiptStore, type StoredReceipt } from "./lib/receipts.js";
import { TOKENS, type TokenSymbol } from "./lib/tokens.js";
import { liveBlockers, readSettings, type AppBindings, type Settings } from "./settings.js";
import { requestAdapter, sellerFor, settlementTx, unpaidBody } from "./x402-seller.js";

type Seller = Pick<Awaited<ReturnType<typeof sellerFor>>, "processHTTPRequest" | "processSettlement">;

export interface AppOptions {
  store?: ReceiptStore;
  fetchImpl?: typeof fetch;
  reader?: ChainReader;
  /** Test hook. Production builds the seller from settings. */
  seller?: Seller;
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, PAYMENT-SIGNATURE, X-PAYMENT",
  "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE",
  Vary: "Origin",
};

export function createApp(options: AppOptions = {}) {
  const app = new Hono<{ Bindings: AppBindings }>();

  app.use("*", async (c, next) => {
    if (c.req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    await next();
    for (const [key, value] of Object.entries(CORS)) c.res.headers.set(key, value);
  });

  app.get("/api/health", (c) => {
    const settings = safeSettings(c.env, c.req.url);
    return c.json({
      ok: true,
      service: "pay-small-check",
      chainId: 42220,
      dryRun: settings?.dryRun ?? true,
    });
  });

  app.get("/api/config", (c) => {
    const settings = safeSettings(c.env, c.req.url);
    if (!settings) return c.json({ error: "bad_config", message: "Server configuration is invalid." }, 500);
    return c.json(publicConfig(settings));
  });

  app.get("/agent.json", (c) => c.json(card(c)));
  app.get("/.well-known/agent-registration.json", (c) => c.json(card(c)));

  app.get("/api/receipts", async (c) => {
    const store = storeFor(c.env, options.store);
    const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 100);
    const rows = await store.list(limit);
    return c.json({ receipts: rows.map(publicReceipt) });
  });

  app.get("/api/receipts/:id", async (c) => {
    const store = storeFor(c.env, options.store);
    const row = await store.get(c.req.param("id"));
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(publicReceipt(row));
  });

  app.post("/api/checks", async (c) => {
    let settings: Settings;
    try {
      settings = readSettings(c.env, c.req.url);
    } catch (error) {
      return c.json({ error: "bad_config", message: error instanceof Error ? error.message : "Invalid configuration" }, 500);
    }
    const body = await readBody(c.req.raw);
    if (body == null) return c.json({ error: "invalid_json", message: "Send a JSON object." }, 400);
    const requested = typeof body.channel === "string" ? body.channel : "x";
    if (requested === "facebook") {
      return c.json(
        {
          error: "not_built",
          channel: "facebook",
          message: "Facebook checks are not built. The catalog has no Facebook source, and this app will not invent one.",
        },
        501,
      );
    }
    if (requested !== "x" && requested !== "instagram") {
      return c.json({ error: "unsupported_channel", channel: requested, message: "Unsupported channel." }, 400);
    }
    const channel: CheckChannel = requested;
    const handle = channel === "instagram" ? parseInstagramHandle(body.handle) : parseHandle(body.handle);
    if (!handle) {
      return c.json(
        {
          error: "invalid_handle",
          message:
            channel === "instagram"
              ? "Paste an Instagram username, like @shopname."
              : "Paste an X handle, like @shopname.",
        },
        400,
      );
    }

    if (settings.dryRun) {
      const receipt = await finishDryRun(storeFor(c.env, options.store), handle, channel);
      return c.json(publicReceipt(receipt));
    }

    const missing = liveBlockers(settings);
    if (missing.length) {
      return c.json(
        {
          error: "not_live",
          message: `Live checks need ${missing.join(" and ")}. DRY_RUN is false, so this server will not pretend to check a vendor.`,
        },
        503,
      );
    }

    const paymentHeader = c.req.header("payment-signature") || c.req.header("x-payment");
    const paymentTx = typeof body.paymentTx === "string" ? body.paymentTx.trim() : "";
    if (paymentHeader && paymentTx) {
      return c.json({ error: "one_payment", message: "Send either an x402 payment header or a paymentTx, not both." }, 400);
    }

    if (paymentTx) {
      return transferCheck(c, settings, channel, handle, paymentTx, body.token, options);
    }
    return x402Check(c, settings, channel, handle, Boolean(paymentHeader), options);
  });

  return app;
}

function card(c: { env: AppBindings; req: { url: string } }) {
  const settings = safeSettings(c.env, c.req.url);
  return registrationFile(settings ?? readSettings({ DRY_RUN: "true" }, c.req.url));
}

function safeSettings(env: AppBindings, url: string): Settings | null {
  try {
    return readSettings(env, url);
  } catch {
    return null;
  }
}

const fallbackStore = memoryStore();

function storeFor(env: AppBindings, override?: ReceiptStore): ReceiptStore {
  if (override) return override;
  if (env.DB) return d1Store(env.DB);
  return fallbackStore;
}

async function readBody(request: Request): Promise<Record<string, unknown> | undefined | null> {
  const text = await request.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

async function finishDryRun(store: ReceiptStore, handle: string, channel: CheckChannel): Promise<StoredReceipt> {
  const fixture = fixtureFor(handle);
  const analysis = analyzeVendor(handle, fixture.snapshot, new Date(), channel);
  const receipt: StoredReceipt = {
    id: newId(),
    createdAt: new Date().toISOString(),
    channel,
    handle,
    status: "complete",
    dryRun: true,
    verdict: analysis.verdict,
    summary: `Practice mode. ${analysis.summary} This is sample data, not a live reading of @${handle}.`,
    signals: analysis.signals,
    evidence: analysis.evidence,
    partial: false,
    warnings: [
      "DRY_RUN is on. No wallet was charged and no buy call was made.",
      "Try @safevendor, @cautionvendor, or @riskyvendor to see the three verdicts.",
    ],
    userPayment: {
      rail: "dry-run",
      asset: null,
      symbol: null,
      amount: null,
      txHash: null,
      payTo: null,
      attribution: "not-applicable",
      attributionCodes: [],
    },
    buyCalls: practiceBuyCalls(channel),
    paymentTx: null,
  };
  await store.put(receipt);
  return receipt;
}

async function transferCheck(
  c: { env: AppBindings; json: (body: unknown, status?: number) => Response },
  settings: Settings,
  channel: CheckChannel,
  handle: string,
  paymentTx: string,
  tokenSymbol: unknown,
  options: AppOptions,
): Promise<Response> {
  const symbol = typeof tokenSymbol === "string" ? tokenSymbol : "USDT";
  if (symbol !== "USDT" && symbol !== "cUSD") {
    return c.json({ error: "invalid_token", message: "Transfer payment accepts USDT or cUSD." }, 400);
  }
  const token = TOKENS[symbol as TokenSymbol];
  const price = settings.transferPrices.find((entry) => entry.token.symbol === token.symbol);
  if (!price || !settings.payTo) return c.json({ error: "bad_config" }, 500);
  const store = storeFor(c.env, options.store);
  if (await store.hasPaymentTx(paymentTx)) {
    return c.json({ error: "payment_used", message: "That payment was already used for a check." }, 409);
  }
  try {
    const reader = options.reader ?? celoReader(settings.rpcUrl);
    const proof = await verifyTransferPayment(reader, paymentTx, settings.payTo, {
      token,
      amount: BigInt(price.amount),
    });
    // Reserve the hash before any paid buy call. Parallel replays of the same
    // transaction lose here instead of each spending on six data calls.
    const key = `transfer:${proof.txHash}`;
    if (!(await store.claimPayment(key))) {
      return c.json({ error: "payment_used", message: "That payment was already used for a check." }, 409);
    }
    const live = await runLiveCheck(settings, handle, options.fetchImpl, channel);
    if (!live.charge || !live.analysis) {
      await store.releasePayment(key);
      return c.json(
        {
          error: "check_failed",
          message: live.error ?? "The data calls failed before a verdict. This payment was not consumed. Retry with the same transaction.",
          buyCalls: live.calls.map(stripOutput),
        },
        502,
      );
    }
    const receipt = await saveReceipt(store, {
      channel,
      handle,
      settings,
      analysis: live.analysis,
      warnings: live.warnings,
      calls: live.calls,
      rail: "transfer",
      asset: proof.token.address,
      symbol: proof.token.symbol,
      amount: proof.amount.toString(),
      txHash: proof.txHash,
      attribution: proof.attributionCodes.length ? "erc8021" : "not-applicable",
      attributionCodes: proof.attributionCodes,
      paymentTx: proof.txHash,
    });
    return c.json(publicReceipt(receipt));
  } catch (error) {
    // An error after the claim keeps it: a buy call may already have paid.
    if (error instanceof PaymentError) return c.json({ error: "payment_rejected", message: error.message }, 402);
    const message = error instanceof Error ? error.message : "Could not read the payment.";
    return c.json({ error: "payment_unreadable", message }, 502);
  }
}

async function x402Check(
  c: { env: AppBindings; req: { raw: Request }; json: (body: unknown, status?: number) => Response },
  settings: Settings,
  channel: CheckChannel,
  handle: string,
  hasPayment: boolean,
  options: AppOptions,
): Promise<Response> {
  if (hasPayment && !settings.x402ApiKey) {
    return c.json(
      {
        error: "facilitator_key_missing",
        message: "Set X402_API_KEY from https://x402.celo.org before accepting x402 payments. Transfer payments do not need this key.",
        transfer: unpaidBody(settings).transfer,
      },
      503,
    );
  }
  const store = storeFor(c.env, options.store);
  let seller: Seller;
  try {
    seller = options.seller ?? (await sellerFor(settings));
  } catch (error) {
    return c.json(
      {
        error: "facilitator_unavailable",
        message: error instanceof Error ? error.message : "The Celo x402 facilitator could not be reached.",
        transfer: unpaidBody(settings).transfer,
      },
      503,
    );
  }
  const adapter = requestAdapter(c.req.raw);
  const result = await seller.processHTTPRequest({
    adapter,
    path: "/api/checks",
    method: "POST",
  });
  if (result.type === "payment-error") {
    const headers = new Headers(result.response.headers);
    for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
    const body = result.response.isHtml ? String(result.response.body ?? "") : JSON.stringify(result.response.body ?? {});
    return new Response(body, { status: result.response.status, headers });
  }
  if (result.type !== "payment-verified") {
    return c.json(unpaidBody(settings), 402);
  }

  // Verification alone does not consume the authorization nonce, so parallel
  // requests with one signature would all pass. Reserve it before buying.
  const claimKey = x402ClaimKey(result.paymentPayload, c.req.raw);
  if (!(await store.claimPayment(claimKey))) {
    return c.json({ error: "payment_used", message: "That payment authorization is already being used for a check." }, 409);
  }

  const live = await runLiveCheck(settings, handle, options.fetchImpl, channel);
  if (!live.charge || !live.analysis) {
    // Nothing was charged and the authorization was not settled, so the same
    // signature may be retried.
    await store.releasePayment(claimKey);
    return c.json(
      {
        error: "check_failed",
        message: live.error ?? "The data calls failed. The x402 payment was not settled.",
        buyCalls: live.calls.map(stripOutput),
      },
      502,
    );
  }

  const draft = await saveReceipt(store, {
    channel,
    handle,
    settings,
    analysis: live.analysis,
    warnings: live.warnings,
    calls: live.calls,
    rail: "x402",
    asset: null,
    symbol: null,
    amount: null,
    txHash: null,
    attribution: "payto-address",
    attributionCodes: [],
    paymentTx: null,
  });
  const encoded = Buffer.from(JSON.stringify(publicReceipt(draft)));
  const settled = await seller.processSettlement(result.paymentPayload, result.paymentRequirements, result.declaredExtensions, {
    request: { adapter, path: "/api/checks", method: "POST" },
    responseBody: encoded,
  });
  if (!settled.success) {
    draft.status = "failed";
    draft.verdict = null;
    draft.summary = "The x402 payment did not settle, so the verdict was withheld.";
    draft.warnings.push(settled.errorReason ?? "settlement failed");
    await store.put(draft);
    const headers = new Headers(settled.response?.headers ?? {});
    for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
    return new Response(JSON.stringify({ error: "settlement_failed", message: settled.errorReason, receiptId: draft.id }), {
      status: settled.response?.status ?? 402,
      headers,
    });
  }
  const txHash = settlementTx(settled.headers);
  const paidAsset = result.paymentRequirements.asset;
  const paidAmount = result.paymentRequirements.amount;
  draft.userPayment.txHash = txHash;
  draft.userPayment.asset = paidAsset;
  draft.userPayment.amount = paidAmount;
  draft.userPayment.symbol = symbolForAsset(paidAsset);
  draft.paymentTx = txHash;
  await store.put(draft);
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  for (const [key, value] of Object.entries(settled.headers)) headers.set(key, value);
  for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
  headers.set("Cache-Control", "private, no-store");
  return new Response(JSON.stringify(publicReceipt(draft)), { status: 200, headers });
}

/**
 * A stable key for one x402 authorization: the payer and its EIP-3009 nonce.
 * Falls back to a hash of the raw header for payload shapes without a nonce.
 */
export function x402ClaimKey(paymentPayload: unknown, request: Request): string {
  const inner = (paymentPayload as { payload?: { authorization?: { from?: unknown; nonce?: unknown } } } | null)?.payload;
  const auth = inner?.authorization;
  if (auth && typeof auth.from === "string" && typeof auth.nonce === "string") {
    return `x402:${auth.from}:${auth.nonce}`.toLowerCase();
  }
  const raw = request.headers.get("payment-signature") ?? request.headers.get("x-payment") ?? "";
  return `x402-raw:${raw}`;
}

function symbolForAsset(asset: string): string | null {
  const found = Object.values(TOKENS).find((token) => token.address.toLowerCase() === asset.toLowerCase());
  return found?.symbol ?? null;
}

async function saveReceipt(
  store: ReceiptStore,
  input: {
    channel: CheckChannel;
    handle: string;
    settings: Settings;
    analysis: { verdict: StoredReceipt["verdict"]; summary: string; signals: unknown[]; evidence: unknown[] };
    warnings: string[];
    calls: Parameters<typeof stripOutput>[0][];
    rail: StoredReceipt["userPayment"]["rail"];
    asset: string | null;
    symbol: string | null;
    amount: string | null;
    txHash: string | null;
    attribution: StoredReceipt["userPayment"]["attribution"];
    attributionCodes: string[];
    paymentTx: string | null;
  },
): Promise<StoredReceipt> {
  const receipt: StoredReceipt = {
    id: newId(),
    createdAt: new Date().toISOString(),
    channel: input.channel,
    handle: input.handle,
    status: "complete",
    dryRun: false,
    verdict: input.analysis.verdict,
    summary: input.analysis.summary,
    signals: input.analysis.signals,
    evidence: input.analysis.evidence,
    partial: input.calls.some((call) => !call.ok),
    warnings: input.warnings,
    userPayment: {
      rail: input.rail,
      asset: input.asset,
      symbol: input.symbol,
      amount: input.amount,
      txHash: input.txHash,
      payTo: input.settings.payTo,
      attribution: input.attribution,
      attributionCodes: input.attributionCodes,
    },
    buyCalls: input.calls.map(stripOutput),
    paymentTx: input.paymentTx,
  };
  try {
    await store.put(receipt);
  } catch (error) {
    if (error instanceof Error && /payment_tx_used|UNIQUE/i.test(error.message)) {
      throw new PaymentError("That payment was already used for a check.");
    }
    throw error;
  }
  return receipt;
}

function newId(): string {
  return `chk_${crypto.randomUUID()}`;
}

function describeCalls(channel: CheckChannel) {
  return planFor(channel).map((plan) => ({
    key: plan.key,
    capability: plan.id,
    title: plan.title,
    why: plan.why,
    url: plan.documentedUrl,
    quotedAtomic: plan.quotedAtomic,
  }));
}

function publicConfig(settings: Settings) {
  const agent = settings.agentPrivateKey ? privateKeyToAccount(settings.agentPrivateKey).address : settings.agentAddress;
  return {
    dryRun: settings.dryRun,
    chainId: 42220,
    network: "eip155:42220",
    priceUsd: settings.priceUsd,
    payTo: settings.payTo,
    agentPayer: agent,
    attributionCode: settings.attributionCode,
    attributionSuffix: settings.attributionSuffix,
    buyToken: settings.buyToken.symbol,
    facilitator: settings.facilitatorUrl,
    catalog: settings.catalogUrl,
    agentId: settings.agentId || null,
    x402Tokens: settings.x402Prices.map(({ token, amount }) => ({
      symbol: token.symbol,
      label: token.label,
      asset: token.address,
      decimals: token.decimals,
      amount,
      eip712Name: token.eip712Name,
    })),
    transferTokens: settings.transferPrices.map(({ token, amount }) => ({
      symbol: token.symbol,
      label: token.label,
      asset: token.address,
      feeCurrency: token.feeCurrency,
      decimals: token.decimals,
      amount,
    })),
    calls: describeCalls("x"),
    instagramCalls: describeCalls("instagram"),
    instagramComments: {
      key: INSTAGRAM_COMMENTS.key,
      capability: INSTAGRAM_COMMENTS.id,
      title: INSTAGRAM_COMMENTS.title,
      why: INSTAGRAM_COMMENTS.why,
      url: INSTAGRAM_COMMENTS.documentedUrl,
      quotedAtomic: INSTAGRAM_COMMENTS.quotedAtomic,
      note: "Runs only when the posts payload contains a shortcode.",
    },
    facebook: { available: false, status: "coming_soon" },
    cusdNote:
      "cUSD (USDm in MiniPay) is accepted as an on-chain transfer. The hosted Celo x402 facilitator does not settle cUSD. Gasless x402 payments use USDT, USDC, or USA₮.",
    support: `https://github.com/${settings.githubRepo}/issues`,
  };
}

export const app = createApp();
