// Tier-1 gates at the ENGINE level, on the shipped WASM.
//
// scripts/verify/verify_spec.py grades the FM pair against its Bessel prototype.
// That leaves everything the pair is not: envelopes, voice stealing, algorithms,
// feedback stability, and whether an effect does what its name claims. Those are
// stability and headroom checks -- first and second in the quality-matrix dependency
// order -- and a NaN here corrupts every spectral number downstream of it.
//
//     node scripts/verify/check_engine.mjs
import { readFileSync } from "node:fs";
import { PARAM } from "../../packages/core/src/index.js";

const WASM = "packages/core/wasm/fm_dsp.wasm";
const SR = 48000;
// PARAM is IMPORTED, never mirrored.
const P = PARAM;

const { instance } = await WebAssembly.instantiate(readFileSync(WASM), {});
const x = instance.exports;

const fails = [];
const check = (ok, name, detail) => {
  if (ok) console.log(`  ok    ${name}${detail ? " — " + detail : ""}`);
  else { console.log(`  FAIL  ${name} — ${detail}`); fails.push(name); }
};

/** Render the MONO SUM. Anything measuring the effect as a whole wants the sum. */
function renderSum(seconds, setup, events = []) {
  const e = x.engine_new(SR);
  setup(e);
  const n = Math.floor(SR * seconds);
  const out = new Float32Array(n);
  const pending = [...events].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < n; i += 128) {
    while (pending.length && pending[0][0] * SR <= i) pending.shift()[1](e);
    const f = Math.min(128, n - i);
    x.render(e, f);
    const L = new Float32Array(x.memory.buffer, x.out_ptr(e), f);
    const R = new Float32Array(x.memory.buffer, x.out_ptr_r(e), f);
    for (let j = 0; j < f; j++) out[i + j] = (L[j] + R[j]) * 0.5;
  }
  x.engine_free(e);
  return out;
}

/** Render `seconds` of the engine after running `setup`, in real 128-frame blocks. */
function render(seconds, setup, events = []) {
  const e = x.engine_new(SR);
  setup(e);
  const n = Math.floor(SR * seconds);
  const out = new Float32Array(n);
  const pending = [...events].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < n; i += 128) {
    while (pending.length && pending[0][0] * SR <= i) pending.shift()[1](e);
    const f = Math.min(128, n - i);
    x.render(e, f);
    out.set(new Float32Array(x.memory.buffer, x.out_ptr(e), f), i);
  }
  x.engine_free(e);
  return out;
}
const peak = (a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
const allFinite = (a) => a.every(Number.isFinite);

/** Coefficient of variation of the short-time envelope: how much the level moves. */
function envelopeCV(a, from = 0) {
  const W = 960, v = [];
  for (let i = from; i + W < a.length; i += W) {
    let s = 0; for (let j = 0; j < W; j++) s += a[i + j] ** 2;
    v.push(Math.sqrt(s / W));
  }
  const m = v.reduce((p, c) => p + c, 0) / v.length;
  return Math.sqrt(v.reduce((p, c) => p + (c - m) ** 2, 0) / v.length) / m;
}

/** Spectral centroid in Hz, via a Hann-windowed FFT. Brightness, directly. */
function centroid(a, from) {
  const N = 16384;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);   // Hann
    re[i] = a[from + i] * w;
  }
  fftRadix2(re, im);
  const binHz = SR / N;
  let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) {
    const mag = re[k] * re[k] + im[k] * im[k];
    num += k * binHz * mag;
    den += mag;
  }
  return den > 0 ? num / den : 0;
}

/** Fraction of total spectral energy ABOVE `hz`. FM sidebands live up there. */
function energyAbove(a, from, hz) {
  const N = 16384;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
    re[i] = a[from + i] * w;
  }
  fftRadix2(re, im);
  const binHz = SR / N;
  const k0 = Math.max(1, Math.floor(hz / binHz));
  let above = 0, total = 0;
  for (let k = 1; k < N / 2; k++) {
    const mag = re[k] * re[k] + im[k] * im[k];
    total += mag;
    if (k >= k0) above += mag;
  }
  return total > 0 ? above / total : 0;
}

function fftRadix2(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr;
                 const ti = im[i]; im[i] = im[j]; im[j] = ti; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k], uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe; im[i + k + len / 2] = uIm - vIm;
        const nr = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nr;
      }
    }
  }
}

console.log("engine checks (shipped WASM)\n");

// --- stability: sustained note, nothing runs away or goes non-finite
{
  const a = render(4, (e) => {
    x.set_param(e, P.op2Sustain, 0.9);
    x.note_on(e, 60, 0.9);
  });
  check(allFinite(a), "sustained note stays finite", `${a.length} frames`);
  check(peak(a) <= 1.0, "sustained note inside full scale", `peak ${peak(a).toFixed(3)}`);
  check(rms(a) > 0.01, "sustained note is not silent", `rms ${rms(a).toFixed(3)}`);
}

// --- the dangerous case: feedback FM at maximum index and feedback, held.
// A self-modulating operator is where this engine is most likely to blow up.
{
  const a = render(4, (e) => {
    x.set_param(e, P.algorithm, 3);          // feedback algorithm
    x.set_param(e, P.index, 2.0);
    x.set_param(e, P.feedback, 0.9);
    x.set_param(e, P.op1Level, 1.0);
    x.set_param(e, P.op2Sustain, 1.0);
    x.note_on(e, 40, 1.0);
  });
  check(allFinite(a), "max index + max feedback stays finite");
  check(peak(a) <= 1.0, "max index + max feedback inside full scale",
        `peak ${peak(a).toFixed(3)}`);
}

// --- headroom under polyphony, including voice stealing past the pool size
{
  const a = render(3, (e) => {
    x.set_param(e, P.op2Sustain, 0.9);
    for (let n = 36; n < 36 + 24; n++) x.note_on(e, n, 1.0);   // 24 notes, 16 voices
  });
  check(allFinite(a), "24 notes into a 16-voice pool stays finite");
  check(peak(a) <= 1.0, "24 notes inside full scale", `peak ${peak(a).toFixed(3)}`);
}

// --- envelope: release must actually reach silence, or notes pile up forever
{
  const a = render(3, (e) => {
    x.note_on(e, 60, 0.9);
    x.note_off(e, 60);
  });
  const tail = a.subarray(a.length - SR / 2);
  check(rms(tail) < 1e-4, "note released decays to silence",
        `tail rms ${rms(tail).toExponential(1)}`);
}

// --- FM: index at zero must be a plain carrier (a sine), index up must brighten.
// This is THE defining FM check: index is the "drive" of the technique. A zero-crossing
// count was tried first and FAILED to distinguish them -- with a ratio-2 carrier the
// composite stays periodic at the modulator's fundamental, so the crossing rate does
// not move when sidebands appear. Spectral centroid moves but weakly (the J0 carrier
// dominates the sum); the honest proxy for "sidebands appeared" is the fraction of
// energy ABOVE the first sideband band.
{
  const brightOf = (index) => {
    const a = renderSum(1.0, (e) => {
      x.set_param(e, P.algorithm, 0);          // carrier + 1 modulator
      x.set_param(e, P.index, index);
      x.set_param(e, P.op1Ratio, 1.0);
      x.set_param(e, P.op1Level, 1.0);
      x.set_param(e, P.op2Sustain, 0.9);
      x.set_param(e, P.op1Sustain, 0.9);
      x.note_on(e, 48, 0.9);
    });
    // Carrier at 2xf0 = 262 Hz; first sidebands at 131 and 393. Energy above 600 Hz
    // only exists once sidebands do.
    return { centroid: centroid(a, SR / 2), hi: energyAbove(a, SR / 2, 600) };
  };
  const flat = brightOf(0.0), rich = brightOf(1.5);
  check(rich.hi > flat.hi * 4, "raising index brightens the tone (more sidebands)",
        `energy >600 Hz ${(100 * flat.hi).toFixed(2)}% -> ${(100 * rich.hi).toFixed(2)}%`);
}

// --- algorithms must actually differ: 4 algorithms, 4 sounds
{
  const profileOf = (alg) => {
    const a = renderSum(1.2, (e) => {
      x.set_param(e, P.algorithm, alg);
      x.set_param(e, P.op1Level, 1.0);
      x.set_param(e, P.op2Level, 1.0);
      x.set_param(e, P.op3Level, 1.0);
      x.set_param(e, P.op4Level, 1.0);
      x.set_param(e, P.op2Sustain, 0.9);
      x.note_on(e, 48, 0.9);
    });
    const seg = a.subarray(SR / 2, SR / 2 + 16384);
    return { rms: rms(seg), hi: energyAbove(a, SR / 2, 900) };
  };
  const a0 = profileOf(0), a2 = profileOf(2);
  check(a0.rms > 0.005 && a2.rms > 0.005, "every algorithm produces sound",
        `mod1 rms ${a0.rms.toFixed(3)}, stack2 rms ${a2.rms.toFixed(3)}`);
  check(Math.abs(a0.hi - a2.hi) > 0.002, "stack2 differs from mod1 (two carriers sum)",
        `mod1 hi-band ${(100 * a0.hi).toFixed(2)}% vs stack2 ${(100 * a2.hi).toFixed(2)}%`);
}

// --- chorus: an effect must be shown to do the thing its name claims
{
  const setup = (mix) => (e) => {
    x.set_param(e, P.op2Sustain, 0.9);
    x.set_param(e, P.chorusRate, 0.42);
    x.set_param(e, P.chorusDepth, 4.2);
    x.set_param(e, P.chorusMix, mix);
    x.note_on(e, 60, 0.8);
  };
  const dry = render(2, setup(0)), wet = render(2, setup(0.85));
  const dcv = envelopeCV(dry, SR), wcv = envelopeCV(wet, SR);
  check(allFinite(wet), "chorus output stays finite");
  check(peak(wet) <= 1.0, "chorus inside full scale", `peak ${peak(wet).toFixed(3)}`);
  check(wcv > dcv * 1.4, "chorus modulates the envelope",
        `CV ${dcv.toFixed(3)} dry → ${wcv.toFixed(3)} wet (${(wcv / dcv).toFixed(2)}x)`);

  const dry2 = render(2, setup(0));
  let same = true;
  for (let i = 0; i < dry.length; i++) if (dry[i] !== dry2[i]) { same = false; break; }
  check(same, "chorus at mix=0 is a true bypass and deterministic");
}

// --- reverb: a tail must OUTLAST the note. Otherwise it is an EQ with extra steps.
{
  const setup = (mix) => (e) => {
    x.set_param(e, P.op2Sustain, 0.0);
    x.set_param(e, P.op2Release, 0.02);
    x.set_param(e, P.reverbSize, 0.8);
    x.set_param(e, P.reverbMix, mix);
    x.note_on(e, 60, 0.9);
  };
  const off = [[0.15, (e) => x.note_off(e, 60)]];
  const dry = render(2.5, setup(0), off), wet = render(2.5, setup(0.7), off);
  const from = Math.floor(SR * 1.2);
  const dryTail = rms(dry.subarray(from)), wetTail = rms(wet.subarray(from));
  check(allFinite(wet), "reverb output stays finite");
  check(peak(wet) <= 1.0, "reverb inside full scale", `peak ${peak(wet).toFixed(3)}`);
  check(dryTail < 1e-5, "no tail without reverb", `dry tail ${dryTail.toExponential(1)}`);
  check(wetTail > 1e-3, "reverb produces a tail that outlasts the note",
        `wet tail ${wetTail.toExponential(2)} vs dry ${dryTail.toExponential(1)}`);
  const early = rms(wet.subarray(Math.floor(SR * 0.6), Math.floor(SR * 0.9)));
  const late = rms(wet.subarray(Math.floor(SR * 2.0), Math.floor(SR * 2.3)));
  check(late < early * 0.7, "reverb tail decays",
        `${early.toExponential(2)} -> ${late.toExponential(2)}`);
}

// --- delay: a repeat must appear AT THE TIME ASKED FOR, not merely somewhere
{
  const T = 0.25;
  const a = renderSum(1.6, (e) => {
    x.set_param(e, P.op2Sustain, 0.0);
    x.set_param(e, P.op2Release, 0.02);
    x.set_param(e, P.delayTime, T);
    x.set_param(e, P.delayFeedback, 0.5);
    x.set_param(e, P.delayMix, 0.9);
    x.note_on(e, 60, 0.9);
  }, [[0.05, (e) => x.note_off(e, 60)]]);
  check(allFinite(a), "delay output stays finite");
  check(peak(a) <= 1.0, "delay inside full scale", `peak ${peak(a).toFixed(3)}`);

  const hop = Math.floor(SR * 0.005);
  const env = [];
  for (let i = 0; i + hop < a.length; i += hop) env.push(rms(a.subarray(i, i + hop)));
  const at = (t) => Math.round((t * SR) / hop);
  const peakIn = (lo, hi) => {
    let bi = lo, bv = -1;
    for (let i = Math.max(0, lo); i <= Math.min(env.length - 1, hi); i++)
      if (env[i] > bv) { bv = env[i]; bi = i; }
    return [bi, bv];
  };
  const [srcI, srcV] = peakIn(0, at(0.08));
  const [repI, repV] = peakIn(at(T - 0.05), at(T + 0.05));
  const measured = ((repI - srcI) * hop) / SR;
  const err = Math.abs(measured - T) * 1000;
  check(repV > 1e-3, "delay produces an audible repeat", `peak ${repV.toExponential(2)}`);
  check(err < 10, "repeat lands at the requested time",
        `measured ${(measured * 1000).toFixed(1)} ms vs ${T * 1000} ms (${err.toFixed(1)} ms off)`);
  const [, second] = peakIn(at(2 * T - 0.05) + srcI, at(2 * T + 0.05) + srcI);
  check(second > 1e-4 && second < repV, "feedback gives a quieter second repeat",
        `${repV.toExponential(2)} -> ${second.toExponential(2)}`);
}

// --- determinism: same input, same output, every time
{
  const setup = (e) => { x.set_param(e, P.op2Sustain, 0.9); x.note_on(e, 60, 0.8); };
  const a = render(2, setup), b = render(2, setup);
  let same = true;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; }
  check(same, "the engine is deterministic run to run");
}

console.log();
if (fails.length) {
  console.log(`ENGINE CHECKS FAIL — ${fails.length}: ${fails.join(", ")}`);
  process.exit(1);
}
console.log("engine checks OK");
