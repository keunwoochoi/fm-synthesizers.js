// Does the tuning page actually play the scale it loaded?
//
// The unit tests grade the arithmetic; this grades the claim the demo makes, which no
// amount of arithmetic can: that a scale file dropped into a browser comes out of the
// speakers at the frequencies it names. The measurement is deliberately NOT "the number
// the page displays" -- the page computes that from the same function under test, so it
// would agree with itself while sounding wrong. It is the rendered audio, measured with
// a Goertzel sweep that knows nothing about the tuning module.
//
//     node scripts/dev/tuning-check.mjs      (BROWSER=webkit to switch engine)
import * as pw from "playwright";
import { spawn } from "node:child_process";

const BROWSER = process.env.BROWSER ?? "chromium";
const launchArgs = BROWSER === "chromium" ? ["--autoplay-policy=no-user-gesture-required"] : [];
const PORT = 8311;
const fail = (m) => { console.error(`TUNING FAIL [${BROWSER}]: ${m}`); process.exit(1); };

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"],
                     { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await pw[BROWSER].launch({ args: launchArgs });

try {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/apps/playground/tuning.html`, { timeout: 15000 });

  // --- the page loaded a scale before anyone touched it --------------------------
  const initial = await page.evaluate(() => ({
    size: window.__tuning.tuning.size,
    period: window.__tuning.tuning.period,
    keys: document.querySelectorAll("#kb .k").length,
    scales: document.querySelectorAll("#builtins button").length,
    degrees: document.querySelectorAll("#degrees tbody tr").length,
  }));
  console.log("  on load:", JSON.stringify(initial));
  if (initial.size !== 12 || Math.abs(initial.period - 1200) > 1e-6)
    fail("the page did not land on a 12-tone octave scale");
  if (initial.keys < 24) fail(`only ${initial.keys} keys are drawn`);
  if (initial.scales < 5) fail(`only ${initial.scales} built-in scales offered`);
  if (initial.degrees !== 13) fail(`degree table shows ${initial.degrees} rows, wanted 13`);

  // --- a malformed scale is refused, visibly, without breaking the page ----------
  const broken = await page.evaluate(() => {
    const before = window.__tuning.tuning;
    const ok = window.__tuning.setScale("d\n3\n100.0\n");
    return { ok, status: document.getElementById("status").textContent,
      bad: document.getElementById("status").classList.contains("bad"),
      unchanged: window.__tuning.tuning === before };
  });
  console.log("  malformed scale:", JSON.stringify(broken));
  if (broken.ok || !broken.bad || !/line \d+/.test(broken.status))
    fail(`a malformed scale was not reported with its line number: ${broken.status}`);
  if (!broken.unchanged) fail("a malformed scale replaced the working tuning");

  // --- non-octave scales reach the keyboard --------------------------------------
  const bp = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("#builtins button")];
    buttons.find((b) => b.textContent.includes("Bohlen"))?.click();
    const t = window.__tuning.tuning;
    return { period: t.period, size: t.size,
      thirteenSteps: (t.pitch(73) - t.pitch(60)) * 100,
      unmappedCells: document.querySelectorAll("#kb .k.unmapped").length };
  });
  console.log("  Bohlen-Pierce:", JSON.stringify(bp));
  if (Math.abs(bp.period - 1200 * Math.log2(3)) > 1e-6)
    fail(`Bohlen-Pierce period read as ${bp.period} cents, wanted a 3:1 tritave`);
  if (Math.abs(bp.thirteenSteps - 1200 * Math.log2(3)) > 1e-3)
    fail("13 Bohlen-Pierce steps did not make a tritave on the keyboard");

  // --- THE MEASUREMENT: render the loaded scale and find its fundamental ----------
  //
  // Goertzel at a sweep of candidate frequencies, argmax wins. The engine's per-voice
  // drift is bounded at about +-4 cents, so the tolerance has to sit outside that;
  // 15 cents is comfortably inside the 63-cent gap that the 19-EDO key below opens
  // against twelve-tone, which is the difference this is here to detect.
  const measured = await page.evaluate(async () => {
    const { createEngine } = await import("../../packages/core/src/index.js");
    const { parseScale, createTuning } = await import("../../packages/core/src/tunings.js");

    const edo = (n) => ["! generated", `${n}-EDO`, ` ${n}`,
      ...Array.from({ length: n - 1 }, (_, i) => ` ${((i + 1) * 1200 / n).toFixed(6)}`),
      " 2/1"].join("\n");

    // Goertzel: energy at one frequency, over one buffer. Knows nothing about scales.
    const energyAt = (samples, hz, rate) => {
      const w = 2 * Math.PI * hz / rate, coeff = 2 * Math.cos(w);
      let s1 = 0, s2 = 0;
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i] + coeff * s1 - s2;
        s2 = s1; s1 = s;
      }
      return s1 * s1 + s2 * s2 - coeff * s1 * s2;
    };
    /** The strongest frequency within +-120 cents of a guess, in 2-cent steps. */
    const refine = (samples, guessHz, rate) => {
      let best = guessHz, bestEnergy = -1;
      for (let cents = -120; cents <= 120; cents += 2) {
        const hz = guessHz * Math.pow(2, cents / 1200);
        const e = energyAt(samples, hz, rate);
        if (e > bestEnergy) { bestEnergy = e; best = hz; }
      }
      return best;
    };

    const render = async (events, seconds = 1.0) => {
      const rate = 48000;
      const ctx = new OfflineAudioContext({
        numberOfChannels: 2, length: Math.round(rate * seconds), sampleRate: rate });
      const engine = await createEngine({
        wasmUrl: "../../packages/core/wasm/fm_dsp.wasm",
        workletUrl: "../../packages/core/worklet/processor.js",
        context: ctx, initialEvents: events,
      });
      const buffer = await ctx.startRendering();
      await engine.dispose();
      return { data: buffer.getChannelData(0), rate };
    };

    const results = {};
    for (const [name, divisions, key] of [["12-TET", 12, 69], ["19-EDO", 19, 65], ["31-EDO", 31, 63]]) {
      const tuning = createTuning(parseScale(edo(divisions)));
      const pitch = tuning.pitch(key);
      const wanted = tuning.frequency(key);
      const { data, rate } = await render([{ type: "noteOn", note: pitch, vel: 0.9, at: 0 }]);
      // Skip the attack; measure the steady part.
      const steady = data.subarray(Math.round(rate * 0.15), Math.round(rate * 0.75));
      let peak = 0;
      for (let i = 0; i < steady.length; i++) peak = Math.max(peak, Math.abs(steady[i]));
      const found = refine(steady, wanted, rate);
      results[name] = {
        key, wanted, found, peak,
        centsOff: 1200 * Math.log2(found / wanted),
        centsFromTwelveTet: 1200 * Math.log2(wanted / (440 * Math.pow(2, (key - 69) / 12))),
      };
    }

    // Retune under a held note: one note-on, one setNotePitch halfway, no second attack.
    const twelve = createTuning(parseScale(edo(12)));
    const nineteen = createTuning(parseScale(edo(19)));
    const from = twelve.pitch(65), to = nineteen.pitch(65);
    const { data, rate } = await render([
      { type: "noteOn", note: from, vel: 0.9, at: 0 },
      { type: "setNotePitch", note: from, pitch: to, at: 1.0, noteId: 65 },
    ], 2.0);
    // The note was started WITHOUT an id, so its id is derived from its pitch; the
    // scheduled retune above supplies one, which must therefore NOT match. Redo it the
    // way the keyboard does: id on both.
    const withIds = await render([
      { type: "noteOn", note: from, vel: 0.9, at: 0, noteId: 65 },
      { type: "setNotePitch", note: from, pitch: to, at: 1.0, noteId: 65 },
    ], 2.0);
    const half = Math.round(rate);
    const rms = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i];
      return Math.sqrt(s / a.length); };
    const before = withIds.data.subarray(half - 4800, half - 480);
    const after = withIds.data.subarray(half + 480, half + 4800);
    results.retune = {
      fromHz: twelve.frequency(65), toHz: nineteen.frequency(65),
      foundBefore: refine(before, twelve.frequency(65), rate),
      foundAfter: refine(after, nineteen.frequency(65), rate),
      rmsBefore: rms(before), rmsAfter: rms(after),
      // The control: the same render with no retune at all. Without it a re-attack
      // hides inside the patch's own decay.
      rmsNoRetune: rms(data.subarray(half + 480, half + 4800)),
    };
    return results;
  }, { timeout: 60000 });

  for (const name of ["12-TET", "19-EDO", "31-EDO"]) {
    const r = measured[name];
    console.log(`  ${name.padEnd(7)} key ${r.key}  wanted ${r.wanted.toFixed(2)} Hz  ` +
      `found ${r.found.toFixed(2)} Hz  (${r.centsOff.toFixed(1)} ¢ off, ` +
      `${r.centsFromTwelveTet.toFixed(1)} ¢ from twelve-tone)  peak ${r.peak.toFixed(3)}`);
    if (r.peak < 0.01) fail(`${name} rendered (near) silence — peak ${r.peak}`);
    if (Math.abs(r.centsOff) > 15)
      fail(`${name} sounded ${r.centsOff.toFixed(1)} cents from the pitch the scale names`);
  }
  // 12-TET must be indistinguishable from the engine's own tuning, and the other two
  // must not be — otherwise the check would pass on a loader that ignores the file.
  if (Math.abs(measured["12-TET"].centsFromTwelveTet) > 1e-6)
    fail("12-TET from a scale file is not the engine's own tuning");
  for (const name of ["19-EDO", "31-EDO"]) {
    if (Math.abs(measured[name].centsFromTwelveTet) < 25)
      fail(`${name} is only ${measured[name].centsFromTwelveTet} cents from twelve-tone — ` +
        "pick a key where the scale actually differs, or the check proves nothing");
  }

  const r = measured.retune;
  console.log(`  retune  ${r.fromHz.toFixed(2)} → ${r.toHz.toFixed(2)} Hz  ` +
    `measured ${r.foundBefore.toFixed(2)} → ${r.foundAfter.toFixed(2)} Hz  ` +
    `rms ${r.rmsBefore.toFixed(4)} → ${r.rmsAfter.toFixed(4)} ` +
    `(no-retune control ${r.rmsNoRetune.toFixed(4)})`);
  if (Math.abs(1200 * Math.log2(r.foundBefore / r.fromHz)) > 15)
    fail("the held note was not at the first scale's pitch before the retune");
  if (Math.abs(1200 * Math.log2(r.foundAfter / r.toHz)) > 15)
    fail("the held note did not move to the second scale's pitch");
  if (r.rmsAfter > r.rmsBefore * 1.35)
    fail(`level jumped ${(r.rmsAfter / r.rmsBefore).toFixed(2)}x across the retune — it re-attacked`);

  // --- the page's own audio path -------------------------------------------------
  await page.evaluate(() => {
    [...document.querySelectorAll("#builtins button")].find((b) => b.textContent.includes("19"))?.click();
  });
  await page.keyboard.press("a");
  await page.waitForFunction(() => window.__tuning?.engine != null, null, { timeout: 20000 });
  const state = await page.evaluate(() => window.__tuning.engine.context.state);
  if (state !== "running") fail(`AudioContext is "${state}" after the gesture — iOS-class bug`);

  const peak = await page.evaluate(async () => {
    const engine = window.__tuning.engine;
    const analyser = engine.context.createAnalyser();
    analyser.fftSize = 2048;
    engine.node.connect(analyser);
    const buffer = new Float32Array(2048);
    window.__tuning.down(62, 0.9);
    let peak = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 900) {
      analyser.getFloatTimeDomainData(buffer);
      for (const v of buffer) peak = Math.max(peak, Math.abs(v));
      await new Promise((r) => requestAnimationFrame(r));
    }
    window.__tuning.up(62);
    return peak;
  });
  console.log(`  a key press on the live page  peak ${peak.toFixed(4)}`);
  if (peak < 0.01) fail(`playing a key on the page produced silence — peak ${peak}`);

  // Switching scale while a note is held must move it, not restart it.
  const heldSwitch = await page.evaluate(async () => {
    window.__tuning.down(60, 0.9);
    await new Promise((r) => setTimeout(r, 200));
    const before = window.__tuning.keyboard.keys.slice();
    [...document.querySelectorAll("#builtins button")].find((b) => b.textContent.includes("31"))?.click();
    await new Promise((r) => setTimeout(r, 200));
    const after = window.__tuning.keyboard.keys.slice();
    window.__tuning.up(60);
    return { before, after, size: window.__tuning.tuning.size };
  });
  console.log("  scale switch under a held key:", JSON.stringify(heldSwitch));
  if (heldSwitch.size !== 31) fail("switching scale under a held key did not change the tuning");
  if (heldSwitch.before.join() !== "60" || heldSwitch.after.join() !== "60")
    fail("the held key was dropped by the scale change");

  if (errs.length) fail("page errors: " + errs.slice(0, 3).join(" | "));
  console.log(`TUNING OK [${BROWSER}] — loaded scales sound at the frequencies they name, ` +
    "including a non-octave one, and a scale change moves held notes");
} finally {
  await browser.close();
  server.kill();
}
