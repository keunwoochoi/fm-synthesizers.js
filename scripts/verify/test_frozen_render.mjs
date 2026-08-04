// The frozen-render gate, proven to fail.
//
// The renderer is not the risk here -- if it breaks, every other check breaks with it.
// The risk is the COMPARATOR: a comparison that returns "no differences" for inputs that
// differ passes forever while grading nothing, and nothing else in the repo would notice.
// So these tests hand it inputs that differ in each way a real regression can differ, and
// assert it says so. PRINCIPLES: "an audit never observed to fail is not evidence of
// anything."
//
//     node --test scripts/verify/test_frozen_render.mjs
import assert from "node:assert/strict";
import test from "node:test";

import { compare, digest, renderProgram, SEGMENTS } from "./frozen_render.mjs";

const baseline = {
  sampleRate: 48000,
  maxVoices: 16,
  segments: [
    { name: "a", preset: "p", frames: 1000, digest: "aaaa", peak: 0.5, rms: 0.1 },
    { name: "b", preset: "q", frames: 2000, digest: "bbbb", peak: 0.4, rms: 0.2 },
  ],
};
const clone = (o) => JSON.parse(JSON.stringify(o));

test("an identical render reports no differences", () => {
  assert.deepEqual(compare(baseline, clone(baseline)), []);
});

test("a changed digest is reported, and names the segment", () => {
  const current = clone(baseline);
  current.segments[1].digest = "cccc";
  const diffs = compare(baseline, current);
  assert.equal(diffs.length, 1);
  assert.match(diffs[0], /"b"/);
});

test("a changed frame count is reported", () => {
  const current = clone(baseline);
  current.segments[0].frames = 999;
  assert.match(compare(baseline, current).join("\n"), /1000 frames -> 999/);
});

test("a missing segment is reported rather than skipped", () => {
  const current = clone(baseline);
  current.segments.pop();
  assert.match(compare(baseline, current).join("\n"), /"b" is missing/);
});

test("an unexpected extra segment is reported", () => {
  const current = clone(baseline);
  current.segments.push({ ...baseline.segments[0], name: "c" });
  assert.match(compare(baseline, current).join("\n"), /"c" is in the render but not/);
});

test("a changed sample rate or voice count is reported", () => {
  const sr = clone(baseline); sr.sampleRate = 44100;
  assert.match(compare(baseline, sr).join("\n"), /sample rate 48000 -> 44100/);
  const mv = clone(baseline); mv.maxVoices = 8;
  assert.match(compare(baseline, mv).join("\n"), /MAX_VOICES 16 -> 8/);
});

// Segments are only ever added, never silently dropped: reordering must not be a
// difference, because the comparator matches on name.
test("reordering segments is not a difference", () => {
  const current = clone(baseline);
  current.segments.reverse();
  assert.deepEqual(compare(baseline, current), []);
});

test("the digest changes when a single sample changes", () => {
  const a = new Float32Array([0.1, -0.2, 0.3, 0.4]);
  const b = Float32Array.from(a);
  // One ULP, the smallest change the format can express at this magnitude.
  b[2] = Math.fround(b[2] + Math.pow(2, -25));
  assert.notEqual(b[2], a[2], "the perturbation must actually change the sample");
  assert.notEqual(digest(a), digest(b));
});

// The gate is worthless if the program it renders does not reach the code the
// note-boundary work changes. These assert the program's SHAPE, so a future edit that
// quietly drops the steal or the retrigger fails here rather than passing silently.
test("the program exercises retrigger, note-off tails, and voice stealing", async () => {
  const chord = SEGMENTS.find((s) => s.name === "chord");
  const ons = chord.events.filter((e) => e[1] === "on");
  assert.ok(new Set(ons.map((e) => e[2])).size < ons.length,
    "the chord segment must play some note twice while it is still sounding");

  const tail = SEGMENTS.find((s) => s.name === "tail");
  const lastOff = Math.max(...tail.events.filter((e) => e[1] === "off").map((e) => e[0]));
  assert.ok(tail.seconds - lastOff > 1.0, "the tail segment must render well past its note-off");

  const steal = SEGMENTS.find((s) => s.name === "steal");
  const { maxVoices } = await renderProgram();
  assert.ok(steal.events.length > maxVoices,
    `the steal segment must open more than ${maxVoices} notes`);
});
