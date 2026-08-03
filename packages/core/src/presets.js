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
export const PRESETS = {
  "e-piano-fm": {
    label: "FM electric piano", group: "keys",
    blurb: "Glassy ring, slow woody decay. The FM signature.",
    params: { algorithm: ALGORITHM.mod1, index: 0.85,
      op1Ratio: 1, op1Level: 1.0, op1Attack: 0.001, op1Decay: 1.1, op1Sustain: 0.12, op1Release: 0.5,
      op2Ratio: 1, op2Level: 0.75, op2Attack: 0.001, op2Decay: 1.4, op2Sustain: 0.05, op2Release: 0.7,
      velToIndex: 0.4, reverbMix: 0.2, reverbSize: 0.7, delayMix: 0.18, delayTime: 0.33, gain: 0.58 },
  },
  "warm-keys": {
    label: "Warm keys", group: "keys",
    blurb: "Soft and mellow. The polite side of FM.",
    params: { algorithm: ALGORITHM.mod1, index: 0.5,
      op1Ratio: 1, op1Level: 0.8, op1Attack: 0.02, op1Decay: 0.9, op1Sustain: 0.25, op1Release: 0.6,
      op2Ratio: 1, op2Level: 0.7, op2Attack: 0.02, op2Decay: 1.2, op2Sustain: 0.2, op2Release: 0.8,
      velToIndex: 0.3, reverbMix: 0.2, reverbSize: 0.8, delayMix: 0.2, delayTime: 0.29, gain: 0.45 },
  },
  "bell": {
    label: "Bell", group: "keys",
    blurb: "Inharmonic ring that outlasts the note.",
    params: { algorithm: ALGORITHM.mod1, index: 1.1,
      op1Ratio: 3.9, op1Level: 1.0, op1Attack: 0.001, op1Decay: 0.9, op1Sustain: 0.05, op1Release: 0.9,
      op2Ratio: 1, op2Level: 0.7, op2Attack: 0.001, op2Decay: 0.7, op2Sustain: 0, op2Release: 1.1,
      velToIndex: 0.3, reverbMix: 0.3, reverbSize: 0.85, delayMix: 0.3, delayTime: 0.28, gain: 0.62 },
  },
  "glass-bell": {
    label: "Glass bell", group: "keys",
    blurb: "A slow glassy ring that glows instead of clanging.",
    params: { algorithm: ALGORITHM.mod2, index: 0.8,
      op1Ratio: 1.4, op1Level: 0.8, op1Attack: 0.04, op1Decay: 1.2, op1Sustain: 0.15, op1Release: 1.4,
      op2Ratio: 1, op2Level: 0.7, op2Attack: 0.05, op2Decay: 1.3, op2Sustain: 0.1, op2Release: 1.5,
      op3Ratio: 2.8, op3Level: 0.5, op3Attack: 0.04, op3Decay: 1.1, op3Sustain: 0.1, op3Release: 1.3,
      velToIndex: 0.3, reverbMix: 0.32, reverbSize: 0.9, delayMix: 0.25, delayTime: 0.31, gain: 0.37 },
  },
  "breathy-brass": {
    label: "Breathy brass", group: "brass",
    blurb: "Slow swell, rich stack, air before the note.",
    params: { algorithm: ALGORITHM.mod2, index: 1.0,
      op1Ratio: 1, op1Level: 0.9, op1Attack: 0.09, op1Decay: 0.4, op1Sustain: 0.7, op1Release: 0.3,
      op2Ratio: 1, op2Level: 0.6, op2Attack: 0.1, op2Decay: 0.3, op2Sustain: 0.8, op2Release: 0.3,
      op3Ratio: 2, op3Level: 0.5, op3Attack: 0.09, op3Decay: 0.4, op3Sustain: 0.6, op3Release: 0.3,
      velToIndex: 0.5, chorusMix: 0.25, chorusRate: 0.5, chorusDepth: 3.5, reverbMix: 0.22, gain: 0.32 },
  },
  "fm-bass": {
    label: "FM bass", group: "bass",
    blurb: "Round, solid, sits under everything.",
    params: { algorithm: ALGORITHM.mod1, index: 0.7,
      op1Ratio: 0.5, op1Level: 1.0, op1Attack: 0.001, op1Decay: 0.3, op1Sustain: 0.1, op1Release: 0.1,
      op2Ratio: 1, op2Level: 0.85, op2Attack: 0.001, op2Decay: 0.4, op2Sustain: 0.5, op2Release: 0.15,
      velToIndex: 0.35, reverbMix: 0.04, reverbSize: 0.4, gain: 0.34 },
  },
  "metal-pluck": {
    label: "Metal pluck", group: "pluck",
    blurb: "Short metallic ping. Gone in a flash.",
    params: { algorithm: ALGORITHM.mod1, index: 1.2,
      op1Ratio: 1.4, op1Level: 1.0, op1Attack: 0.001, op1Decay: 0.25, op1Sustain: 0, op1Release: 0.1,
      op2Ratio: 1, op2Level: 0.8, op2Attack: 0.001, op2Decay: 0.3, op2Sustain: 0, op2Release: 0.12,
      velToIndex: 0.4, reverbMix: 0.08, reverbSize: 0.6, delayMix: 0.15, delayTime: 0.21, gain: 0.8 },
  },
  "fb-pad": {
    label: "Feedback pad", group: "pad",
    blurb: "Feedback FM — unstable, vocal, alive.",
    params: { algorithm: ALGORITHM.feedback, index: 0.6, feedback: 0.35,
      op1Ratio: 1, op1Level: 0.9, op1Attack: 0.3, op1Decay: 0.8, op1Sustain: 0.6, op1Release: 0.8,
      op2Ratio: 1, op2Level: 0.6, op2Attack: 0.35, op2Decay: 0.7, op2Sustain: 0.7, op2Release: 0.9,
      velToIndex: 0.3, chorusMix: 0.3, chorusRate: 0.45, chorusDepth: 4.0, reverbMix: 0.38,
      reverbSize: 0.85, delayMix: 0.2, delayTime: 0.34, gain: 0.32 },
  },
  "stack-keys": {
    label: "Stack keys", group: "keys",
    blurb: "Two stacked pairs — big, bright, layered.",
    params: { algorithm: ALGORITHM.stack2, index: 0.7,
      op1Ratio: 1, op1Level: 0.8, op1Attack: 0.002, op1Decay: 0.7, op1Sustain: 0.2, op1Release: 0.4,
      op2Ratio: 1, op2Level: 0.6, op2Attack: 0.002, op2Decay: 0.8, op2Sustain: 0.15, op2Release: 0.5,
      op3Ratio: 5, op3Level: 0.75, op3Attack: 0.002, op3Decay: 0.6, op3Sustain: 0.2, op3Release: 0.4,
      op4Ratio: 1, op4Level: 0.5, op4Attack: 0.002, op4Decay: 0.7, op4Sustain: 0.1, op4Release: 0.5,
      velToIndex: 0.4, reverbMix: 0.22, reverbSize: 0.75, delayMix: 0.2, delayTime: 0.27, gain: 0.6 },
  },
  "twang": {
    label: "Twang", group: "pluck",
    blurb: "Short nasal stab — plucked-string-adjacent.",
    params: { algorithm: ALGORITHM.mod1, index: 1.0,
      op1Ratio: 2, op1Level: 0.9, op1Attack: 0.001, op1Decay: 0.2, op1Sustain: 0, op1Release: 0.08,
      op2Ratio: 1, op2Level: 0.75, op2Attack: 0.001, op2Decay: 0.25, op2Sustain: 0, op2Release: 0.1,
      velToIndex: 0.35, reverbMix: 0.07, delayMix: 0.12, delayTime: 0.19, gain: 0.85 },
  },
};

/** Demo pattern groups, in menu order. */
export const GROUPS = ["keys", "brass", "bass", "pluck", "pad"];

export function applyPreset(engine, name) {
  const p = PRESETS[name];
  if (!p) throw new Error(`unknown preset: ${name}`);
  // Merged over DEFAULTS: nothing carries over from the previously selected patch.
  for (const [k, v] of Object.entries({ ...DEFAULTS, ...p.params })) engine.setParam(k, v);
  return p;
}
