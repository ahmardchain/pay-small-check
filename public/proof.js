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
  return `<article class="card stack">
    <p class="kicker">${esc(receipt.createdAt)} · ${receipt.dryRun ? "practice" : "live"}</p>
    <h2>@${esc(receipt.handle)} · ${esc(receipt.verdict || receipt.status)}</h2>
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
  list.innerHTML = `<p class="card">No receipt was found.</p>`;
} else {
  const body = await response.json();
  const rows = body.receipts || [body];
  list.innerHTML = rows.length ? rows.map(card).join("") : `<p class="card">No checks yet.</p>`;
}
