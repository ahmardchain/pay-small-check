import { loadCatalog } from "../src/buy.js";
import { SERVICE_LIST } from "../src/services.js";

const rows = await loadCatalog();
const problems: string[] = [];
for (const service of SERVICE_LIST) {
  const row = rows.find((item) => item.id === service.catalogId);
  if (!row) {
    problems.push(`${service.catalogId} missing`);
    continue;
  }
  if (!row.available) problems.push(`${service.catalogId} unavailable`);
  if (row.method !== "POST") problems.push(`${service.catalogId} method is ${row.method}`);
  if (row.url !== service.url) problems.push(`${service.catalogId} url is ${row.url}`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`catalog ok: ${SERVICE_LIST.length} capabilities still match the 2026-11-06 snapshot`);
