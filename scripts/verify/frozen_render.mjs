// A render frozen against a committed baseline, so a refactor that claims to change
// nothing has to prove it.
//
// WHAT THIS CATCHES THAT NOTHING ELSE DOES
// check_engine.mjs asserts the engine is deterministic *within one process*: render
// twice, compare. verify_spec.py grades the oscillator against the Bessel prototype
// with a tolerance. Neither notices a change that is consistent and inside tolerance --
// which is exactly the shape of a boundary refactor gone subtly wrong. A committed
// digest compares against a DIFFERENT COMMIT, which is the only comparison that can
// falsify "this changed nothing".
//
// WHY A DIGEST IS SAFE ACROSS MACHINES
// The module is instantiated with an EMPTY import object, so every arithmetic operation
// including the transcendentals happens inside the WASM. WebAssembly floating point is
// IEEE-754 with no FMA contraction and no extended-precision intermediates, so the same
// module bytes produce the same samples on macOS and on the ubuntu-24.04 runner. That
// property is what makes a hash a legitimate gate rather than a local convenience; it
// would not hold for a native build.
//
// WHY A DIGEST AND NOT A WAV
// A committed reference render of this program is ~4 MB. The digest is 64 bytes and
// fails on a single changed sample, which is the whole requirement. What a digest cannot
// do is say *where* a render diverged, so each segment carries its own digest plus peak
// and RMS -- enough for a failure to name the segment and the direction of the change.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { PARAM } from "../../packages/core/src/index.js";
import { DEFAULTS, PRESETS } from "../../packages/core/src/presets.js";

export const WASM = "packages/core/wasm/fm_dsp.wasm";
export const SR = 48000;

/** Voice count the engine actually has. Read, never mirrored: the steal segment is only
 * a steal segment if it opens MORE notes than there are voices. */
export const MAX_VOICES = Number(
  /pub const MAX_VOICES: usize = (\d+)/.exec(
    readFileSync("crates/dsp/src/lib.rs", "utf8"))?.[1]);

/**
 * The program. Every segment exists because a later step in the note-boundary sequence
 * (issues #8, #9, #10) touches the path it exercises:
 *
 *   chord      polyphony and a same-note retrigger -- the `v.note == note` match in
 *              Engine::note_on that #9 replaces with an id match.
 *   tail       note-off followed by silence long enough for the release to run out --
 *              the note-off lookup, which #9 also rekeys.
 *   steal      more simultaneous notes than voices, so the oldest-first steal runs.
 *   registers  the same patch across the pitch range, so a change in how pitch reaches
 *              midi_to_hz shows up as a digest miss rather than passing at middle C.
 *
 * Times are seconds. Notes are whatever the engine's note argument currently is.
 */
export const SEGMENTS = [
  {
    name: "chord",
    preset: "e-piano-fm",
    seconds: 2.0,
    events: [
      [0.00, "on", 60, 0.8], [0.05, "on", 64, 0.7], [0.10, "on", 67, 0.9],
      // Same note again while it is still sounding: the retrigger branch, not a steal.
      [0.60, "on", 60, 0.5],
      [1.20, "off", 60], [1.20, "off", 64], [1.20, "off", 67],
    ],
  },
  {
    name: "tail",
    preset: "bell",
    seconds: 1.5,
    // Released early on purpose: most of this segment IS the tail, so a release-path
    // regression has somewhere to show up.
    events: [[0.00, "on", 72, 1.0], [0.30, "off", 72]],
  },
  {
    name: "steal",
    preset: "fm-bass",
    seconds: 1.0,
    events: Array.from({ length: MAX_VOICES + 4 }, (_, i) => [i * 0.01, "on", 36 + i, 0.8]),
  },
  {
    name: "registers",
    preset: "marimba",
    seconds: 1.5,
    events: [24, 48, 72, 96].map((n, i) => [i * 0.2, "on", n, 0.85]),
  },
];

/** Apply a preset the way the library does: merged over DEFAULTS, never partial. The
 * engine is stateful, so a partial patch would inherit the previous segment's values --
 * except each segment gets a fresh engine, which is also why the render is reproducible
 * (Engine::new seeds the per-voice drift RNG to a constant). */
function applyPreset(x, e, name) {
  const preset = PRESETS[name];
  if (!preset) throw new Error(`frozen render: no preset "${name}"`);
  for (const [k, v] of Object.entries({ ...DEFAULTS, ...preset.params })) {
    if (PARAM[k] === undefined) throw new Error(`${name}: unknown param ${k}`);
    x.set_param(e, PARAM[k], v);
  }
}

/** Render one segment to interleaved stereo. Stereo on purpose: chorus, ping-pong delay
 * and the FDN reverb are all stereo, and a mono sum can cancel exactly the difference
 * they would show. */
function renderSegment(x, segment) {
  const e = x.engine_new(SR);
  applyPreset(x, e, segment.preset);
  const n = Math.floor(SR * segment.seconds);
  const out = new Float32Array(n * 2);
  const pending = [...segment.events].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < n; i += 128) {
    while (pending.length && pending[0][0] * SR <= i) {
      const [, kind, note, vel] = pending.shift();
      if (kind === "on") x.note_on(e, note, vel);
      else x.note_off(e, note);
    }
    const f = Math.min(128, n - i);
    x.render(e, f);
    const L = new Float32Array(x.memory.buffer, x.out_ptr(e), f);
    const R = new Float32Array(x.memory.buffer, x.out_ptr_r(e), f);
    for (let j = 0; j < f; j++) { out[(i + j) * 2] = L[j]; out[(i + j) * 2 + 1] = R[j]; }
  }
  x.engine_free(e);
  return out;
}

export const digest = (buffer) =>
  createHash("sha256").update(Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength))
    .digest("hex");

const peak = (a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);

/** Render the whole program and describe it. Pure: no file writes, no process.exit --
 * the CLI decides what to do with the result, and the test can call it directly. */
export async function renderProgram(wasmPath = WASM) {
  const { instance } = await WebAssembly.instantiate(readFileSync(wasmPath), {});
  const x = instance.exports;
  const segments = SEGMENTS.map((segment) => {
    const samples = renderSegment(x, segment);
    return {
      name: segment.name,
      preset: segment.preset,
      frames: samples.length / 2,
      digest: digest(samples),
      // Rounded, because these are for a human reading a failure message. The DIGEST is
      // the gate; a stat that drifted in the last decimal place is not a finding.
      peak: Number(peak(samples).toFixed(6)),
      rms: Number(rms(samples).toFixed(6)),
    };
  });
  return { sampleRate: SR, maxVoices: MAX_VOICES, segments };
}

/**
 * Compare a fresh render against a baseline. Returns a list of human-readable
 * differences; empty means identical.
 *
 * Kept separate from both rendering and file IO so it can be tested against
 * hand-built inputs -- the comparator is the part that fails open if it is wrong,
 * and "an audit never observed to fail is not evidence of anything".
 */
export function compare(baseline, current) {
  const diffs = [];
  if (baseline.sampleRate !== current.sampleRate)
    diffs.push(`sample rate ${baseline.sampleRate} -> ${current.sampleRate}`);
  if (baseline.maxVoices !== current.maxVoices)
    diffs.push(`MAX_VOICES ${baseline.maxVoices} -> ${current.maxVoices}`);

  const byName = new Map(current.segments.map((s) => [s.name, s]));
  for (const want of baseline.segments) {
    const got = byName.get(want.name);
    if (!got) { diffs.push(`segment "${want.name}" is missing from the render`); continue; }
    byName.delete(want.name);
    if (want.frames !== got.frames)
      diffs.push(`segment "${want.name}": ${want.frames} frames -> ${got.frames}`);
    else if (want.digest !== got.digest)
      diffs.push(
        `segment "${want.name}" (${got.preset}): samples changed — ` +
        `peak ${want.peak} -> ${got.peak}, rms ${want.rms} -> ${got.rms}, ` +
        `sha256 ${want.digest.slice(0, 12)}… -> ${got.digest.slice(0, 12)}…`);
  }
  for (const extra of byName.keys())
    diffs.push(`segment "${extra}" is in the render but not in the baseline`);
  return diffs;
}
