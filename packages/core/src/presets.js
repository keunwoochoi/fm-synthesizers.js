// The patch bank. PRINCIPLES #1: curation is the product -- these values ARE the work.
//
// The roster is the classic FM signatures, chosen WITHOUT the brand names (see
// agentic-docs/licensing.md -- trademarks bind hardest for FM). Values are designed
// against THIS engine's controls; nothing here is transcribed from anyone's factory
// bank.
//
// EVERY patch is merged over DEFAULTS before it is sent. The engine is stateful, so a
// partial patch would inherit whatever the last one set. Completeness is structural
// here, not a review habit.

import { ALGORITHM, PARAM_DEFAULTS } from "./parameters.js";

/** Neutral starting point. Any field a patch omits is RESET to this, never left behind. */
export const DEFAULTS = PARAM_DEFAULTS;

/** `group` picks the demo pattern: a bass and a bell do not want the same notes. */
export const PRESETS = {};

/** Demo pattern groups, in menu order. */
export const GROUPS = ["keys", "brass", "bass", "pluck", "pad"];

export function applyPreset(engine, name) {
  const p = PRESETS[name];
  if (!p) throw new Error(`unknown preset: ${name}`);
  // Merged over DEFAULTS: nothing carries over from the previously selected patch.
  for (const [k, v] of Object.entries({ ...DEFAULTS, ...p.params })) engine.setParam(k, v);
  return p;
}
