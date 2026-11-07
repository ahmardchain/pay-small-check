const list = document.querySelector("#list");
const params = new URLSearchParams(location.search);
const id = params.get("id");

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function tx(hash, label) {
  if (!hash) return "none";
  return `<a href="https://celoscan.io/tx/${esc(hash)}">${esc(label || "View on Celo")}</a>`;
}

function card(receipt) {
  const calls = (receipt.buyCalls || [])
    .map(
      (call) =>
        `<li>${esc(call.title || call.capability)} · ${call.txHash ? tx(call.txHash, "buy payment") : call.simulated ? "practice, not paid" : "not paid"} ${call.correlationId ? `· ${esc(call.correlationId)}` : ""}</li>`,
    )
    .join("");
  const payment = receipt.userPayment || {};
  const verdict = receipt.verdict || receipt.status;
  const when = receipt.createdAt ? new Date(receipt.createdAt).toLocaleString() : "";
  return `<article class="card stack">
    <div class="proof-head">
      <h2>@${esc(receipt.handle)}</h2>
      <span class="chip ${esc(verdict)}">${esc(verdict)}</span>
    </div>
    <p class="meta">${esc(when)}${receipt.dryRun ? ", practice" : ""}</p>
    <p>${esc(receipt.summary || "")}</p>
    <p>Buyer payment (${esc(payment.rail)}): ${tx(payment.txHash, payment.symbol || "transaction")}</p>
    <p>PayTo: <span class="mono">${esc(payment.payTo || "not set")}</span></p>
    <p>Attribution: ${esc(payment.attribution)}${payment.attributionCodes?.length ? ` (${esc(payment.attributionCodes.join(", "))})` : ""}</p>
    <ul class="evidence">${calls}</ul>
    <p><a href="/proof/?id=${esc(receipt.id)}">Permalink</a></p>
  </article>`;
}

const response = await fetch(id ? `/api/receipts/${encodeURIComponent(id)}` : "/api/receipts");
if (!response.ok) {
  list.innerHTML = `<div class="card stack"><p>No receipt has that id. Open the full list instead.</p><a class="primary" href="/proof/">See all receipts</a></div>`;
} else {
  const body = await response.json();
  const rows = body.receipts || [body];
  list.innerHTML = rows.length ? rows.map(card).join("") : `<div class="card stack"><p>No paid checks yet. Each one will appear here with its Celo payments.</p><a class="primary" href="/">Check a vendor</a></div>`;
}
