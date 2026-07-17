/**
 * CI guard CLI: validate the committed coverage matrix against the real spec files. Exits
 * non-zero (failing the pr-validate job) if any cell's mapping no longer resolves. Run via
 * `npm run check:matrix` (tsx resolves the NodeNext `.js` imports to the `.ts` sources).
 */

import { runMatrixCheck } from "../src/matrix/run.js";

const result = runMatrixCheck();

if (result.ok) {
  const gaps = Object.entries(result.gapCells)
    .map(([category, count]) => `${category}=${count.toString()}`)
    .join(", ");
  process.stdout.write(`coverage matrix OK — ${result.mappedCells.toString()} mapped cell(s); gaps: ${gaps}\n`);
  process.exit(0);
}

process.stderr.write("coverage matrix FAILED:\n");
for (const error of result.errors) {
  process.stderr.write(`  - ${error}\n`);
}
process.exit(1);
