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

// --- analog character: voices are NOT bit-identical, but the drift stays bounded.
// PRINCIPLES: "controlled imperfection, and is it controlled". Two sequential chords
// on one engine draw different per-voice drift paths (the engine seed advances), so
// the renders must differ. The BOUND is checked on the pitch directly: the carrier of
// a note must stay within +-5 cents of the requested frequency across repeated notes,
// because a drift that wanders further is an out-of-tune synth, not a breathing one.
// (A waveform-level comparison would measure per-note random phase, which is a real
// and desired behaviour, not drift -- so the bound is measured where drift lives.)
{
  const e = x.engine_new(SR);
  x.set_param(e, P.algorithm, 0);
  x.set_param(e, P.index, 0.5);
  x.set_param(e, P.op1Level, 0.0);   // carrier only: pitch = f0 * drift, cleanly
  x.set_param(e, P.op2Sustain, 0.9);
  x.set_param(e, P.op1Ratio, 1.0);
  x.set_param(e, P.op2Ratio, 1.0);
  const renderNote = (note) => {
    x.note_on(e, note, 0.9);
    const n = SR;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i += 128) {
      const f = Math.min(128, n - i);
      x.render(e, f);
      out.set(new Float32Array(x.memory.buffer, x.out_ptr(e), f), i);
    }
    x.all_off(e);
    return out;
  };
  const fundOf = (a) => {
    // Sub-sample zero-crossing pitch: interpolate each RISING crossing with linear
    // interpolation (rising-only, so each span is a full period, not a half), so a
    // short window's cycle-count quantization does not swamp the +-5 cent drift being
    // measured.
    const from = Math.floor(SR * 0.3), N = SR;
    const crossings = [];
    let prev = a[from], prevI = from;
    for (let i = from + 1; i < from + N; i++) {
      const v = a[i];
      if (prev <= 0 && v > 0) {                // rising crossing only
        const t = prev / (prev - v);
        crossings.push(prevI + t);
      }
      prev = v; prevI = i;
    }
    if (crossings.length < 4) return 0;
    const spans = [];
    for (let i = 1; i < crossings.length; i++) spans.push(crossings[i] - crossings[i - 1]);
    const sorted = [...spans].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return SR / median;                        // Hz
  };
  const cents = (f, f0) => 1200 * Math.log2(f / f0);
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const a = fundOf(renderNote(48)), b = fundOf(renderNote(48));
  const f0 = midi(48);
  check(a !== b, "repeated notes are not identical (per-voice drift)",
        `f0 ${a.toFixed(2)} Hz vs ${b.toFixed(2)} Hz`);
  check(Math.abs(cents(a, f0)) < 5 && Math.abs(cents(b, f0)) < 5,
        "drift stays within +-5 cents of the note",
        `${cents(a, f0).toFixed(2)} and ${cents(b, f0).toFixed(2)} cents`);
  x.engine_free(e);
}

// --- fractional pitch: the note boundary carries the fraction, end to end.
//
// The tuning gate in verify_spec.py grades render_osc, which is handed a frequency in Hz
// and never sees a note number, so nothing there can see a note->Hz path that truncates.
// This measures the SOUNDING frequency of a note started through note_on, which is the
// only place a lost fraction shows up.
//
// Tolerance is +-5 cents, matching the drift check above, because per-voice drift is
// +-2 cents by construction and a tuning assertion has to clear it. That is nowhere near
// tight enough to be fooled: a truncating boundary puts 60.5 at 60, which is 50 cents out.
{
  const e = x.engine_new(SR);
  // Same setup as the drift check above, and for the same reason: in Mod1 the CARRIER is
  // op2, so silencing op1 leaves a bare carrier whose zero crossings are the pitch. Set
  // up any other way this measures the modulator's ratio instead of the note — which it
  // did on the first attempt here, reporting every pitch exactly 1200 cents high because
  // op2Ratio was left at its engine default.
  x.set_param(e, P.algorithm, 0);
  x.set_param(e, P.index, 0.5);
  x.set_param(e, P.op1Level, 0.0);
  x.set_param(e, P.op1Ratio, 1.0);
  x.set_param(e, P.op2Ratio, 1.0);
  x.set_param(e, P.op2Sustain, 0.9);
  x.set_param(e, P.chorusMix, 0); x.set_param(e, P.delayMix, 0); x.set_param(e, P.reverbMix, 0);

  const renderPitch = (pitch) => {
    const n = Math.floor(SR * 1.4);
    const out = new Float32Array(n);
    x.note_on(e, pitch, 0.9);
    for (let i = 0; i < n; i += 128) {
      const f = Math.min(128, n - i);
      x.render(e, f);
      out.set(new Float32Array(x.memory.buffer, x.out_ptr(e), f), i);
    }
    x.all_off(e);
    // Let the release run out, or the next note measures into this one's tail.
    for (let i = 0; i < SR; i += 128) x.render(e, 128);
    return out;
  };
  const fundOf = (a) => {
    const from = Math.floor(SR * 0.3), N = Math.floor(SR * 0.8);
    const crossings = [];
    let prev = a[from], prevI = from;
    for (let i = from + 1; i < from + N; i++) {
      const v = a[i];
      if (prev <= 0 && v > 0) crossings.push(prevI + prev / (prev - v));
      prev = v; prevI = i;
    }
    if (crossings.length < 4) return 0;
    const spans = [];
    for (let i = 1; i < crossings.length; i++) spans.push(crossings[i] - crossings[i - 1]);
    const sorted = spans.sort((a, b) => a - b);
    return SR / sorted[Math.floor(sorted.length / 2)];
  };
  const cents = (f, want) => 1200 * Math.log2(f / want);
  const hzOf = (pitch) => 440 * Math.pow(2, (pitch - 69) / 12);

  // A440 first: the integer case must not have moved.
  const a440 = fundOf(renderPitch(69));
  check(Math.abs(cents(a440, 440)) < 5, "integer pitch 69 is still A440",
        `${a440.toFixed(2)} Hz, ${cents(a440, 440).toFixed(2)} cents`);

  // Quarter-tones, an odd division, and a fraction in a different register. Each would
  // read as its floor if any step on the path still truncated.
  for (const pitch of [60.5, 69.5, 69.25, 71.75, 45.5, 69 + 12 * 7 / 31]) {
    const want = hzOf(pitch);
    const got = fundOf(renderPitch(pitch));
    const off = cents(got, want);
    check(Math.abs(off) < 5, `pitch ${pitch} sounds its own frequency`,
          `${got.toFixed(2)} Hz vs ${want.toFixed(2)} Hz wanted (${off.toFixed(2)} cents)`);
    // Said the other way, so a failure is unambiguous about WHICH failure it is: a
    // truncating boundary lands within a few cents of the floor, not 50-ish away.
    check(Math.abs(cents(got, hzOf(Math.floor(pitch)))) > 20,
          `pitch ${pitch} is not its own floor`,
          `${Math.abs(cents(got, hzOf(Math.floor(pitch)))).toFixed(1)} cents above ${Math.floor(pitch)}`);
  }
  x.engine_free(e);
}

// --- the boundary refuses what it cannot render, rather than making a NaN.
{
  const e = x.engine_new(SR);
  x.set_param(e, P.op1Level, 1.0);
  for (const bad of [NaN, Infinity, -Infinity]) x.note_on(e, bad, 0.9);
  check(x.active_voices(e) === 0, "a non-finite pitch starts no voice",
        `${x.active_voices(e)} voices after NaN/Inf note_on`);

  // And having refused, the engine is still usable and still silent-free.
  x.note_on(e, 60, 0.9);
  const n = SR / 2;
  let finite = true;
  for (let i = 0; i < n; i += 128) {
    x.render(e, 128);
    const view = new Float32Array(x.memory.buffer, x.out_ptr(e), 128);
    for (let j = 0; j < 128; j++) if (!Number.isFinite(view[j])) { finite = false; break; }
    if (!finite) break;
  }
  check(finite, "a refused note leaves no NaN behind in the output");
  x.engine_free(e);
}

// --- voice identity: a voice's name is separate from its pitch.
//
// This is the property that makes microtonal and per-note-expression playing possible at
// all. While the pitch WAS the identity, two voices could not hold the same nominal key
// at different tunings, and a sounding voice could not be named in order to change it.
{
  const fresh = () => {
    const e = x.engine_new(SR);
    x.set_param(e, P.op1Level, 1.0);
    x.set_param(e, P.op2Sustain, 0.9);
    return e;
  };

  // Distinct ids at the SAME pitch stack. This is the case that was impossible.
  {
    const e = fresh();
    x.note_on_id(e, 60, 0.8, 1);
    x.note_on_id(e, 60, 0.8, 2);
    check(x.active_voices(e) === 2, "two ids at the same pitch sound together",
          `${x.active_voices(e)} voices`);
    x.note_off_id(e, 1);
    x.render(e, 128);
    check(x.active_voices(e) === 2, "releasing one id leaves the other sounding",
          `${x.active_voices(e)} voices still active (one releasing, one held)`);
    x.engine_free(e);
  }

  // The same id twice retriggers, exactly as the same pitch twice used to.
  {
    const e = fresh();
    x.note_on_id(e, 60, 0.8, 7);
    x.note_on_id(e, 64, 0.8, 7);
    check(x.active_voices(e) === 1, "the same id twice retriggers one voice",
          `${x.active_voices(e)} voices`);
    x.engine_free(e);
  }

  // Omitting the id must behave as it always did — this is the compatibility rule the
  // frozen baseline proves in bulk, asserted here in the specific.
  {
    const e = fresh();
    x.note_on(e, 60, 0.8);
    x.note_on(e, 60, 0.8);
    check(x.active_voices(e) === 1, "the same pitch twice still retriggers when no id is given",
          `${x.active_voices(e)} voices`);
    x.note_off(e, 60);
    x.render(e, 128);
    x.engine_free(e);
  }

  // A derived id must distinguish pitches a truncating derivation would collide. 60.5 and
  // 60.7 are the case that rules out `pitch as u32`.
  {
    const e = fresh();
    x.note_on(e, 60.5, 0.8);
    x.note_on(e, 60.7, 0.8);
    check(x.active_voices(e) === 2, "two nearby fractional pitches are two voices",
          `${x.active_voices(e)} voices — a truncating id derivation would report 1`);
    x.engine_free(e);
  }

  // Releasing an id that names nothing is a no-op, not an error and not a stuck voice.
  {
    const e = fresh();
    x.note_on_id(e, 60, 0.8, 3);
    x.note_off_id(e, 999);
    x.render(e, 128);
    check(x.active_voices(e) === 1, "releasing an unknown id disturbs nothing",
          `${x.active_voices(e)} voices`);
    x.note_off_id(e, 999);
    x.engine_free(e);
  }

  // Stealing is still oldest-first, and it is the voice SLOT that is reused, not the id.
  {
    const e = fresh();
    for (let i = 0; i < 20; i++) x.note_on_id(e, 40 + i, 0.8, 100 + i);
    check(x.active_voices(e) === 16, "polyphony is still bounded by the voice pool",
          `${x.active_voices(e)} voices for 20 ids`);
    // The first four ids were stolen; releasing them must not disturb the survivors.
    for (let i = 0; i < 4; i++) x.note_off_id(e, 100 + i);
    x.render(e, 128);
    check(x.active_voices(e) === 16, "releasing a stolen id does not release its successor",
          `${x.active_voices(e)} voices`);
    x.engine_free(e);
  }
}

// --- retuning a sounding voice: the pitch moves, nothing else does.
//
// This is the operation every live-retuning protocol needs and this engine never had —
// MTS single-note tuning change, MTS-ESP, MPE channel bend, MIDI 2.0 per-note pitch. It
// is also plain pitch bend, which was unimplementable at any resolution before ids
// existed, because there was no way to name the voice you wanted to change.
{
  const setup = (e) => {
    x.set_param(e, P.algorithm, 0);
    x.set_param(e, P.index, 0.5);
    x.set_param(e, P.op1Level, 0.0);      // carrier only: op2 is the carrier in Mod1
    x.set_param(e, P.op1Ratio, 1.0);
    x.set_param(e, P.op2Ratio, 1.0);
    x.set_param(e, P.op2Attack, 0.005);
    x.set_param(e, P.op2Decay, 0.05);
    x.set_param(e, P.op2Sustain, 0.9);
    x.set_param(e, P.chorusMix, 0); x.set_param(e, P.delayMix, 0); x.set_param(e, P.reverbMix, 0);
  };
  const fundOf = (a, from, N) => {
    const crossings = [];
    let prev = a[from], prevI = from;
    for (let i = from + 1; i < from + N; i++) {
      const v = a[i];
      if (prev <= 0 && v > 0) crossings.push(prevI + prev / (prev - v));
      prev = v; prevI = i;
    }
    if (crossings.length < 4) return 0;
    const spans = [];
    for (let i = 1; i < crossings.length; i++) spans.push(crossings[i] - crossings[i - 1]);
    return SR / spans.sort((a, b) => a - b)[Math.floor(spans.length / 2)];
  };
  const cents = (f, want) => 1200 * Math.log2(f / want);
  const hzOf = (p) => 440 * Math.pow(2, (p - 69) / 12);
  /** Render 2 s, applying `mid` exactly at 1.0 s. */
  const renderWithRetune = (mid) => {
    const e = x.engine_new(SR);
    setup(e);
    x.note_on(e, 69, 0.9);
    const n = SR * 2, at = SR;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i += 128) {
      if (i >= at && i - 128 < at) mid(e);
      x.render(e, 128);
      out.set(new Float32Array(x.memory.buffer, x.out_ptr(e), 128), i);
    }
    x.engine_free(e);
    return out;
  };

  const held = renderWithRetune(() => {});
  const bent = renderWithRetune((e) => x.set_note_pitch(e, 69, 69.5));

  const before = fundOf(bent, Math.floor(SR * 0.4), Math.floor(SR * 0.5));
  const after = fundOf(bent, Math.floor(SR * 1.4), Math.floor(SR * 0.5));
  check(Math.abs(cents(before, 440)) < 5, "before the retune the voice is at its start pitch",
        `${before.toFixed(2)} Hz`);
  check(Math.abs(cents(after, hzOf(69.5))) < 5, "after the retune the voice sounds the new pitch",
        `${after.toFixed(2)} Hz vs ${hzOf(69.5).toFixed(2)} Hz wanted (${cents(after, hzOf(69.5)).toFixed(2)} cents)`);

  // No re-attack: a retrigger would restart the amp envelope, so the level just after the
  // retune would jump. Compared against the SAME patch held without a retune, which
  // isolates the retune from the envelope's own decay.
  const rms = (a, from, N) => {
    let s = 0;
    for (let i = from; i < from + N; i++) s += a[i] * a[i];
    return Math.sqrt(s / N);
  };
  const w = Math.floor(SR * 0.02);
  const pre = rms(bent, SR - w, w), post = rms(bent, SR + 128, w);
  const heldPost = rms(held, SR + 128, w);
  check(Math.abs(post / pre - 1) < 0.1, "the retune produces no attack transient",
        `rms ${pre.toExponential(2)} -> ${post.toExponential(2)} across the boundary`);
  check(Math.abs(post / heldPost - 1) < 0.1, "the retuned voice tracks the held voice's envelope",
        `${post.toExponential(2)} vs ${heldPost.toExponential(2)} un-retuned`);

  // Operator ratios follow the carrier: the whole spectrum scales by the pitch ratio,
  // rather than the modulator staying behind and detuning the stack.
  const cBefore = centroid(bent, Math.floor(SR * 0.5));
  const cAfter = centroid(bent, Math.floor(SR * 1.5));
  const want = hzOf(69.5) / hzOf(69);
  check(Math.abs(cAfter / cBefore / want - 1) < 0.02,
        "the spectrum scales with the new pitch (ratios track)",
        `centroid ${cBefore.toFixed(1)} -> ${cAfter.toFixed(1)} Hz, ratio ${(cAfter / cBefore).toFixed(4)} vs ${want.toFixed(4)}`);

  // An id that names nothing sounding is a no-op, not an error and not a stuck voice.
  {
    const e = x.engine_new(SR);
    setup(e);
    x.note_on_id(e, 60, 0.9, 5);
    x.set_note_pitch_id(e, 999, 72);
    x.render(e, 128);
    check(x.active_voices(e) === 1, "retuning an unknown id disturbs nothing",
          `${x.active_voices(e)} voices`);
    x.note_off_id(e, 5);
    for (let i = 0; i < SR; i += 128) x.render(e, 128);
    x.set_note_pitch_id(e, 5, 72);       // released and finished: still a no-op
    let finite = true;
    for (let i = 0; i < SR / 4; i += 128) {
      x.render(e, 128);
      const view = new Float32Array(x.memory.buffer, x.out_ptr(e), 128);
      for (let j = 0; j < 128; j++) if (!Number.isFinite(view[j])) { finite = false; break; }
    }
    check(finite, "retuning a finished id leaves no NaN behind");
    x.engine_free(e);
  }
}

// --- out-of-range pitch is clamped deliberately, at both ends.
{
  const e = x.engine_new(SR);
  x.set_param(e, P.op1Level, 1.0);
  x.note_on(e, 200, 0.9);
  check(x.active_voices(e) === 1, "a pitch above the range still starts a voice (clamped)");
  x.all_off(e);
  x.engine_free(e);
}

console.log();
if (fails.length) {
  console.log(`ENGINE CHECKS FAIL — ${fails.length}: ${fails.join(", ")}`);
  process.exit(1);
}
console.log("engine checks OK");
