// Payment and check flow, moved from the old public/app.js without changing
// behaviour. The page passes in the inputs and an onState callback instead of
// this module reading and writing DOM nodes.
import {
  buildAuthorization,
  buildPaymentPayload,
  decodeHeader,
  encodeHeader,
  selectRequirement,
  typedDataFor,
} from "./x402.js";

const ADJECTIVES = ["calm", "bright", "steady", "kind", "quick", "bold", "quiet", "fair", "keen", "warm"];
const NOUNS = ["mango", "palm", "market", "kola", "river", "lantern", "basket", "drum", "cocoa", "harbor"];

export function displayName(address) {
  let hash = 0;
  for (const char of address.toLowerCase()) hash = (Math.imul(hash, 33) + char.charCodeAt(0)) >>> 0;
  return `${ADJECTIVES[hash % ADJECTIVES.length]} ${NOUNS[(hash >>> 8) % NOUNS.length]}`;
}

export function ethereum() {
  return window.ethereum ?? null;
}

export function inMiniPay() {
  return Boolean(ethereum()?.isMiniPay);
}

export async function loadConfig() {
  const response = await fetch("/api/config");
  return response.json();
}

export function formatAmount(atomic, decimals) {
  const value = BigInt(atomic);
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const frac = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export async function connect(silent, onState) {
  const provider = ethereum();
  if (!provider) {
    if (!silent) onState("Open this page in MiniPay, or use a Celo wallet.");
    return null;
  }
  const accounts = await provider.request({ method: "eth_requestAccounts", params: [] });
  return accounts?.[0] ?? null;
}

export function messageOf(error) {
  const code = error?.code;
  if (code === 4001 || code === "ACTION_REJECTED") return "The payment was dismissed.";
  return error?.message || "Something went wrong.";
}

/**
 * Runs one check end to end and resolves with the receipt, or null when the
 * buyer still has to connect a wallet.
 * @param {{ config: any, account: string | null, handle: string, channel: "x" | "instagram", token: "USDT" | "cUSD", onState: (text: string) => void }} input
 */
export async function runCheck({ config, account, handle, channel, token, onState }) {
  if (config.dryRun) {
    onState("Running the practice check…");
    return postCheck({ handle, channel });
  }
  if (!account) return null;
  const ctx = { config, account, handle, channel, onState };
  if (inMiniPay() || token === "cUSD") return payByTransfer(ctx, token);
  const signed = await payByX402(ctx);
  if (signed === "needs-transfer") return payByTransfer(ctx, "USDT");
  return signed;
}

async function payByX402({ config, account, handle, channel, onState }) {
  onState("Asking for the price…");
  const first = await fetch("/api/checks", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ handle, channel }),
  });
  if (first.status !== 402) {
    const body = await first.json();
    if (!first.ok) throw new Error(body.message || "The check could not start.");
    return body;
  }
  const encoded = first.headers.get("payment-required");
  if (!encoded) throw new Error("The server did not return a payment challenge.");
  const required = decodeHeader(encoded);
  const usdt = config.x402Tokens.find((token) => token.symbol === "USDT");
  const requirement = selectRequirement(required, usdt.asset);
  const authorization = buildAuthorization(account, requirement);
  const typed = typedDataFor(requirement, authorization);
  onState("Confirm the gasless payment in your wallet.");
  let signature;
  try {
    signature = await ethereum().request({
      method: "eth_signTypedData_v4",
      params: [account, JSON.stringify(typed)],
    });
  } catch (error) {
    if (error?.code === 4001) throw error;
    onState("This wallet cannot sign a gasless payment. Sending a transfer instead.");
    return "needs-transfer";
  }
  onState(channel === "instagram" ? "Payment signed. Buying the Instagram record…" : "Payment signed. Buying the X record…");
  const payload = buildPaymentPayload(required, requirement, authorization, signature);
  const paid = await fetch("/api/checks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "PAYMENT-SIGNATURE": encodeHeader(payload),
    },
    body: JSON.stringify({ handle, channel }),
  });
  const body = await paid.json();
  if (!paid.ok) throw new Error(body.message || "The payment did not settle.");
  return body;
}

async function payByTransfer({ config, account, handle, channel, onState }, symbol) {
  const token = config.transferTokens.find((item) => item.symbol === symbol);
  if (!token) throw new Error("That token is not available.");
  if (!config.payTo) throw new Error("The PayTo wallet is not set yet.");
  const data = transferCalldata(config.payTo, token.amount, config.attributionSuffix);
  onState("Checking the balance…");
  await assertCanPay(account, token, data);
  onState("Confirm the payment in your wallet.");
  const hash = await ethereum().request({
    method: "eth_sendTransaction",
    params: [
      {
        from: account,
        to: token.asset,
        data,
        value: "0x0",
        feeCurrency: token.feeCurrency,
      },
    ],
  });
  onState("Waiting for the network…");
  await waitForReceipt(hash);
  onState(channel === "instagram" ? "Payment confirmed. Buying the Instagram record…" : "Payment confirmed. Buying the X record…");
  return postCheck({ handle, channel, paymentTx: hash, token: symbol });
}

function transferCalldata(to, amount, suffix) {
  const selector = "a9059cbb";
  const address = to.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const value = BigInt(amount).toString(16).padStart(64, "0");
  const tail = String(suffix || "").replace(/^0x/, "");
  return `0x${selector}${address}${value}${tail}`;
}

async function assertCanPay(account, token, data) {
  const balanceData = `0x70a08231${account.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
  const raw = await ethereum().request({
    method: "eth_call",
    params: [{ to: token.asset, data: balanceData }, "latest"],
  });
  const balance = BigInt(raw);
  const amount = BigInt(token.amount);
  let fee = 0n;
  try {
    const gas = await ethereum().request({
      method: "eth_estimateGas",
      params: [{ from: account, to: token.asset, data, feeCurrency: token.feeCurrency }],
    });
    const price = await ethereum().request({ method: "eth_gasPrice", params: [token.feeCurrency] });
    fee = BigInt(gas) * BigInt(price) * 2n;
  } catch {
    fee = 2_000_000_000_000_000n;
  }
  const scale = token.decimals === 18 ? 1n : 10n ** 12n;
  if (balance * scale < amount * scale + fee) {
    window.location.href = "https://link.minipay.xyz/add_cash";
    throw new Error("The balance does not cover the check and the network fee.");
  }
}

async function waitForReceipt(hash) {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    const receipt = await ethereum().request({ method: "eth_getTransactionReceipt", params: [hash] });
    if (receipt) {
      if (receipt.status === "0x0") throw new Error("The payment failed.");
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("The payment is still pending. Keep this hash and try the check again in a moment.");
}

async function postCheck(body) {
  const response = await fetch("/api/checks", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "The check failed.");
  return payload;
}
