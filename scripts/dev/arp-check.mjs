// Prove the arpeggiator actually arpeggiates: holding a chord must produce a stream of
// SEPARATE notes over time, not one sustained cluster. "It didn't crash" is not a check.
import * as pw from "playwright";
const BROWSER = process.env.BROWSER ?? "chromium";
// --autoplay-policy is a Chromium-only flag; Linux WebKit refuses to start when
// handed an unknown option, while macOS WebKit ignored it. Hence green locally and
// red on CI. Select flags per engine rather than passing one set to all of them.
const launchArgs = BROWSER === "chromium"
  ? ["--autoplay-policy=no-user-gesture-required"] : [];
const chromium = pw[BROWSER];
import { spawn } from "node:child_process";
const PORT = 8187;

// Fail if the port is already held. A check that silently attaches to someone else's
// server tests someone else's files — and a stale server from another project held
// 8174 on this machine for six days without anyone noticing.
async function requireFreePort(port) {
  const { createServer } = await import("node:net");
  await new Promise((res, rej) => {
    const s = createServer();
    s.once("error", () => rej(new Error(`port ${port} is already in use`)));
    s.once("listening", () => s.close(res));
    s.listen(port, "127.0.0.1");
  });
}

await requireFreePort(PORT);
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { stdio: "ignore" });
const fail = (m) => { console.error("ARP FAIL: " + m); server.kill(); process.exit(1); };
await new Promise(r => setTimeout(r, 700));
const b = await chromium.launch({ args: launchArgs });
try {
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", e => errs.push(String(e)));
  p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(`http://127.0.0.1:${PORT}/apps/playground/`, { timeout: 15000 });
  await p.keyboard.press("a");
  // Wait on the ENGINE existing, not on UI copy. The first version waited for the
  // status line to read "ready…", which broke the moment that line was deleted at the
  // owner's request -- a check coupled to wording rather than to state.
  await p.waitForFunction(() => window.__playground?.engine != null,
                          null, { timeout: 20000 });

  // Instrument the port so we can see what the arp actually schedules.
  await p.evaluate(() => {
    window.__ev = [];
    const e = window.__playground.engine;
    const orig = e.node.port.postMessage.bind(e.node.port);
    e.node.port.postMessage = (m) => { window.__ev.push(m); return orig(m); };
  });

  await p.selectOption("#arpOn", "1");
  await p.selectOption("#arpMode", "up");
  await p.selectOption("#arpRate", "16");
  await p.evaluate(() => { for (const n of [60, 64, 67]) window.__playground.down(n); });
  await p.waitForTimeout(1600);

  const r = await p.evaluate(() => {
    const ons = window.__ev.filter(m => m.type === "schedule")
      .flatMap(m => m.events).filter(e => e.type === "noteOn");
    return {
      count: ons.length,
      distinct: [...new Set(ons.map(e => e.note))].sort((a, b) => a - b),
      ascending: ons.slice(0, 6).map(e => e.note),
      voices: window.__playground.engine.voices,
    };
  });
  console.log("arp:", JSON.stringify(r));

  // ~1.6 s of 16ths at 120 BPM is about 12 steps; allow slack for lookahead and startup.
  if (r.count < 6) fail(`expected a stream of notes, got ${r.count}`);
  if (r.distinct.length !== 3) fail(`expected 3 distinct notes, got ${r.distinct}`);
  if (String(r.distinct) !== "60,64,67") fail(`wrong notes: ${r.distinct}`);
  const a = r.ascending;
  const cyclesUp = a[0] === 60 && a[1] === 64 && a[2] === 67 && a[3] === 60;
  if (!cyclesUp) fail(`'up' mode did not cycle low→high: ${a}`);

  // Octave range must actually transpose.
  await p.evaluate(() => { window.__ev = []; document.getElementById("arpOct").value = 2;
                           document.getElementById("arpOct").dispatchEvent(new Event("input")); });
  await p.waitForTimeout(1200);
  const oct = await p.evaluate(() => [...new Set(window.__ev.filter(m => m.type === "schedule")
    .flatMap(m => m.events).filter(e => e.type === "noteOn").map(e => e.note))].sort((a, b) => a - b));
  if (!oct.includes(72)) fail(`octaves=2 did not add the upper octave: ${oct}`);

  // Turning the arp off must stop the stream.
  await p.selectOption("#arpOn", "0");
  await p.evaluate(() => { window.__ev = []; });
  await p.waitForTimeout(700);
  const after = await p.evaluate(() => window.__ev.filter(m => m.type === "schedule").length);
  if (after > 0) fail("arp kept scheduling after being switched off");

  // Loading a patch from the bank must write the ENGINE and the CONTROLS. If only the
  // engine were written, every slider would still show the previous patch and the editor
  // would be lying about the sound it is making.
  const readCtl = () => p.evaluate(() => ({
    index: document.getElementById("index").value,
    op1Ratio: document.getElementById("op1Ratio").value,
    algorithm: document.getElementById("algorithm").value,
    blurb: document.getElementById("presetBlurb").textContent,
  }));
  const bell = await p.evaluate(() => { window.__playground.loadPreset("bell"); }).then(readCtl);
  const pad = await p.evaluate(() => { window.__playground.loadPreset("fb-pad"); }).then(readCtl);
  if (bell.index === pad.index) fail(`loading a patch did not move index (${bell.index})`);
  if (bell.op1Ratio === pad.op1Ratio) fail(`loading a patch did not move op1Ratio (${bell.op1Ratio})`);
  if (!bell.blurb) fail("loading a patch did not show its description");
  if (Number(bell.index) !== 1.1) fail(`bell should load index 1.1, got ${bell.index}`);

  // The ratio is a range control, taking the input path to the engine. Sweep it across
  // the editor's range and prove the engine accepts a value past the editor ceiling
  // (op1Ratio's supported range reaches 8; the control stops at 4). An "unknown
  // parameter" on any of these means the editor and engine have drifted apart.
  for (let r = 0.5; r <= 4.0001; r += 0.5) {
    await p.evaluate((v) => {
      const el = document.getElementById("op1Ratio");
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, r);
    await p.waitForTimeout(40);
  }
  const ratioErr = errs.filter((e) => /unknown parameter|op1Ratio/.test(e));
  if (ratioErr.length) fail("op1Ratio wiring: " + ratioErr[0]);
  await p.evaluate(() => { window.__playground.engine.setParam("op1Ratio", 8); });
  await p.waitForTimeout(60);
  const deepErr = errs.filter((e) => /unknown parameter/.test(e));
  if (deepErr.length) fail("engine rejected a valid op1Ratio: " + deepErr[0]);

  // The algorithm selector is a <select>, not a range, so it takes a separate code path
  // to the engine. Exercising every algorithm here catches a wiring break that would
  // otherwise only show up as "the algorithm menu does nothing".
  for (let k = 0; k < 4; k++) {
    await p.selectOption("#algorithm", String(k));
    await p.waitForTimeout(60);
  }
  const algErr = errs.filter((e) => /unknown parameter|algorithm/.test(e));
  if (algErr.length) fail("algorithm wiring: " + algErr[0]);

  if (errs.length) fail("page errors: " + errs.slice(0, 3).join(" | "));
  console.log("ARP OK — cycles held notes, respects mode and octave range, stops cleanly; index/op1Ratio/algorithm all wire through; patch bank loads into the controls");
} finally { await b.close(); server.kill(); }
