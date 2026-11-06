import {
  buildAuthorization,
  buildPaymentPayload,
  decodeHeader,
  encodeHeader,
  selectRequirement,
  typedDataFor,
} from "./x402.js";

const form = document.querySelector("#check-form");
const handleInput = document.querySelector("#handle");
const tokenSelect = document.querySelector("#token");
const priceLine = document.querySelector("#price");
const whoLine = document.querySelector("#who");
const stateLine = document.querySelector("#state");
const banner = document.querySelector("#banner");
const result = document.querySelector("#result");
const go = document.querySelector("#go");

const ADJECTIVES = ["calm", "bright", "steady", "kind", "quick", "bold", "quiet", "fair", "keen", "warm"];
const NOUNS = ["mango", "palm", "market", "kola", "river", "lantern", "basket", "drum", "cocoa", "harbor"];

let config = null;
let account = null;

function displayName(address) {
  let hash = 0;
  for (const char of address.toLowerCase()) hash = (Math.imul(hash, 33) + char.charCodeAt(0)) >>> 0;
  return `${ADJECTIVES[hash % ADJECTIVES.length]} ${NOUNS[(hash >>> 8) % NOUNS.length]}`;
}

function ethereum() {
  return window.ethereum ?? null;
}

function inMiniPay() {
  return Boolean(ethereum()?.isMiniPay);
}

function setState(text) {
  stateLine.textContent = text;
}

async function loadConfig() {
  const response = await fetch("/api/config");
  config = await response.json();
  if (config.dryRun) {
    banner.hidden = false;
    banner.textContent = "Practice mode is on. No payment, and the verdict uses sample posts. Try @safevendor, @cautionvendor, or @riskyvendor.";
    tokenSelect.closest("label").hidden = true;
    priceLine.textContent = "Practice checks are free.";
    go.textContent = "Run practice check";
    return;
  }
  const usdt = config.transferTokens.find((token) => token.symbol === "USDT");
  priceLine.textContent = `One check is ${config.priceUsd} USDT, or the same amount in cUSD.`;
  if (usdt) priceLine.textContent = `One check is ${formatAmount(usdt.amount, usdt.decimals)} USDT, or the same value in cUSD.`;
  if (inMiniPay()) {
    whoLine.textContent = "Opened in MiniPay. The network fee is paid in the stablecoin you pick.";
    connect(true);
  }
}

function formatAmount(atomic, decimals) {
  const value = BigInt(atomic);
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const frac = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

async function connect(silent) {
  const provider = ethereum();
  if (!provider) {
    if (!silent) setState("Open this page in MiniPay, or use a Celo wallet.");
    return null;
  }
  const accounts = await provider.request({ method: "eth_requestAccounts", params: [] });
  account = accounts?.[0] ?? null;
  if (account) whoLine.textContent = `Connected as ${displayName(account)}.`;
  return account;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  result.hidden = true;
  go.disabled = true;
  try {
    if (!config) await loadConfig();
    if (config.dryRun) {
      setState("Running the practice check…");
      const receipt = await postCheck({ handle: handleInput.value, channel: "x" });
      render(receipt);
      return;
    }
    if (!account) await connect(false);
    if (!account) return;
    const token = tokenSelect.value;
    if (inMiniPay() || token === "cUSD") {
      await payByTransfer(token);
    } else {
      const signed = await payByX402();
      if (signed === "needs-transfer") await payByTransfer("USDT");
    }
  } catch (error) {
    setState(messageOf(error));
  } finally {
    go.disabled = false;
  }
});

async function payByX402() {
  setState("Asking for the price…");
  const first = await fetch("/api/checks", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ handle: handleInput.value, channel: "x" }),
  });
  if (first.status !== 402) {
    const body = await first.json();
    if (!first.ok) throw new Error(body.message || "The check could not start.");
    render(body);
    return;
  }
  const encoded = first.headers.get("payment-required");
  if (!encoded) throw new Error("The server did not return a payment challenge.");
  const required = decodeHeader(encoded);
  const usdt = config.x402Tokens.find((token) => token.symbol === "USDT");
  const requirement = selectRequirement(required, usdt.asset);
  const authorization = buildAuthorization(account, requirement);
  const typed = typedDataFor(requirement, authorization);
  setState("Confirm the gasless payment in your wallet.");
  let signature;
  try {
    signature = await ethereum().request({
      method: "eth_signTypedData_v4",
      params: [account, JSON.stringify(typed)],
    });
  } catch (error) {
    if (error?.code === 4001) throw error;
    setState("This wallet cannot sign a gasless payment. Sending a transfer instead.");
    return "needs-transfer";
  }
  setState("Payment signed. Buying the X record…");
  const payload = buildPaymentPayload(required, requirement, authorization, signature);
  const paid = await fetch("/api/checks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "PAYMENT-SIGNATURE": encodeHeader(payload),
    },
    body: JSON.stringify({ handle: handleInput.value, channel: "x" }),
  });
  const body = await paid.json();
  if (!paid.ok) throw new Error(body.message || "The payment did not settle.");
  render(body);
}

async function payByTransfer(symbol) {
  const token = config.transferTokens.find((item) => item.symbol === symbol);
  if (!token) throw new Error("That token is not available.");
  if (!config.payTo) throw new Error("The PayTo wallet is not set yet.");
  const data = transferCalldata(config.payTo, token.amount, config.attributionSuffix);
  setState("Checking the balance…");
  await assertCanPay(token, data);
  setState("Confirm the payment in your wallet.");
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
  setState("Waiting for the network…");
  await waitForReceipt(hash);
  setState("Payment confirmed. Buying the X record…");
  const response = await postCheck({ handle: handleInput.value, channel: "x", paymentTx: hash, token: symbol });
  render(response);
}

function transferCalldata(to, amount, suffix) {
  const selector = "a9059cbb";
  const address = to.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const value = BigInt(amount).toString(16).padStart(64, "0");
  const tail = String(suffix || "").replace(/^0x/, "");
  return `0x${selector}${address}${value}${tail}`;
}

async function assertCanPay(token, data) {
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

function render(receipt) {
  setState("");
  result.hidden = false;
  const verdict = receipt.verdict || "caution";
  const signals = (receipt.signals || [])
    .map((signal) => `<li class="tone-${signal.tone}"><strong>${escapeHtml(signal.title)}</strong><br />${escapeHtml(signal.detail)}</li>`)
    .join("");
  const evidence = (receipt.evidence || [])
    .map((item) => {
      const link = item.url ? `<a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">Open</a>` : "";
      const excerpt = item.excerpt ? `<br />${escapeHtml(item.excerpt)}` : "";
      return `<li><strong>${escapeHtml(item.label)}</strong> ${link}${excerpt}</li>`;
    })
    .join("");
  const calls = (receipt.buyCalls || [])
    .map((call) => {
      const tx = call.txHash ? `<a href="https://celoscan.io/tx/${escapeAttr(call.txHash)}">payment</a>` : call.simulated ? "practice" : "no payment";
      return `<li>${escapeHtml(call.title)} · ${tx}</li>`;
    })
    .join("");
  const userTx = receipt.userPayment?.txHash
    ? `<a href="https://celoscan.io/tx/${escapeAttr(receipt.userPayment.txHash)}">Your payment</a>`
    : "No user payment on this practice check.";
  result.innerHTML = `
    <div class="stamp ${verdict}"><div><small>Verdict</small><br />${escapeHtml(verdict)}</div></div>
    <p>${escapeHtml(receipt.summary || "")}</p>
    <ul class="signals">${signals}</ul>
    <h2>Evidence</h2>
    <ul class="evidence">${evidence}</ul>
    <div class="receipt">
      <div>${userTx}</div>
      <div><a href="/proof/?id=${escapeAttr(receipt.id)}">Open the public receipt</a></div>
      <ul class="evidence">${calls}</ul>
    </div>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "");
}
function messageOf(error) {
  const code = error?.code;
  if (code === 4001 || code === "ACTION_REJECTED") return "The payment was dismissed.";
  return error?.message || "Something went wrong.";
}

loadConfig().catch(() => {
  priceLine.textContent = "The fee could not be loaded.";
});
