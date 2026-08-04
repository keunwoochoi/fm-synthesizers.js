// Gate: the shipped WASM still renders the frozen program sample-for-sample.
//
//     node scripts/verify/check_frozen_render.mjs            # check (CI does this)
//     node scripts/verify/check_frozen_render.mjs --update   # rewrite the baseline
//
// The baseline is NEVER rewritten by a failing check. Regeneration is a separate,
// explicit invocation that shows up in a diff and has to be defended in a commit
// message, because a gate that repairs itself when it fails grades nothing at all.
import { readFileSync, writeFileSync } from "node:fs";

import { compare, renderProgram } from "./frozen_render.mjs";

const BASELINE = "scripts/verify/frozen-render-baseline.json";
const update = process.argv.includes("--update");

const current = await renderProgram();

if (update) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
  console.log(`frozen render: baseline rewritten — ${BASELINE}`);
  for (const s of current.segments)
    console.log(`  ${s.name.padEnd(10)} ${s.frames} frames  peak ${s.peak}  ${s.digest.slice(0, 12)}…`);
  console.log("\nA rewritten baseline is a claim that the sound CHANGED ON PURPOSE.");
  console.log("The commit message has to say what changed and why it is correct.");
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
} catch (error) {
  // Loud on failure: a missing baseline must never read as "nothing to compare, pass".
  console.error(`frozen render: cannot read ${BASELINE} — ${error.message}`);
  console.error("If this is the first run, create it with --update and commit it.");
  process.exit(1);
}

const diffs = compare(baseline, current);
if (diffs.length === 0) {
  console.log(`frozen render: ${current.segments.length} segments identical to the baseline`);
  for (const s of current.segments)
    console.log(`  ok    ${s.name.padEnd(10)} ${s.frames} frames  ${s.digest.slice(0, 12)}…`);
  process.exit(0);
}

console.error("frozen render: the render no longer matches the committed baseline\n");
for (const d of diffs) console.error(`  FAIL  ${d}`);
console.error(
  "\nIf this change is intended, rerun with --update and say in the commit message " +
  "what changed about the sound and why it is correct. If it is not intended, this " +
  "is the regression the baseline exists to catch.");
process.exit(1);
