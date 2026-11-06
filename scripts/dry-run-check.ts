import { analyzeVendor } from "../src/lib/analyze.js";
import { fixtureFor } from "../src/lib/fixtures.js";
import { parseHandle } from "../src/lib/handles.js";

const parsed = parseHandle(process.argv[2] ?? "safevendor");
if (!parsed) {
  console.error("Usage: npm run check:dry -- @handle");
  throw new Error("invalid handle");
}
const handle: string = parsed;
const fixture = fixtureFor(handle);
const analysis = analyzeVendor(handle, fixture.snapshot);
console.log(
  JSON.stringify(
    {
      dryRun: true,
      handle,
      sample: fixture.label,
      verdict: analysis.verdict,
      summary: analysis.summary,
      signals: analysis.signals,
      evidence: analysis.evidence,
    },
    null,
    2,
  ),
);
