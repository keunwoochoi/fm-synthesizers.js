// Grade the Scala loader against values that can be computed by hand.
//
// The whole layer is arithmetic with an exact answer, so this is a spec gate in the
// house style rather than a smoke test: every expected number below is derived from the
// interval, never copied from a run of the code it grades.
//
// Two halves matter more than the rest:
//
//   1. THE REJECTIONS. A parser that repairs a malformed scale silently produces a
//      tuning nobody chose, which is unfalsifiable by ear. Each deliberately broken
//      input below must throw, and must name the line -- an audit never observed to
//      fail is not evidence of anything.
//   2. THE NON-OCTAVE SCALES. Bohlen-Pierce repeats at 3:1 and Carlos alpha never
//      repeats at all. Anything that assumes 2/1 passes every octave-scale test here
//      and fails those two, which is exactly why they are in the suite.
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseScale, parseKeyboardMapping, createTuning, createTunedKeyboard, DEFAULT_MAPPING,
} from "../../packages/core/src/tunings.js";

const CENT = 1e-9;
const near = (actual, expected, tol, what) =>
  assert.ok(Math.abs(actual - expected) <= tol,
    `${what}: got ${actual}, wanted ${expected} (tolerance ${tol})`);

/** An equal division written as a real `.scl`, so the tests exercise the parser too.
 *  `period` is the closing entry verbatim, which is how a scale declares its own repeat. */
const equalDivision = (n, period = "2/1", periodCents = 1200) =>
  [`! generated ${n}-fold equal division of ${period}`, `${n} equal steps of ${period}`, ` ${n}`,
    ...Array.from({ length: n - 1 }, (_, i) => ` ${((i + 1) * periodCents / n).toFixed(6)}`),
    ` ${period}`].join("\n");

const TRITAVE_CENTS = 1200 * Math.log2(3);          // 1901.9550008653874

// The example file printed in the .scl format specification itself: quarter-comma
// meantone, and the one case that mixes cents lines and ratio lines in one scale.
const MEANTONE = `! meanquar.scl
!
1/4-comma meantone scale. Pietro Aaron's temperament (1523)
 12
!
 76.04900
 193.15686
 310.26471
 5/4
 503.42157
 579.47057
 696.57843
 25/16
 889.73529
 1006.84314
 1082.89214
 2/1
`;

// --- the format, as specified ----------------------------------------------------

test("scl: comments, an empty description, and a zero-note scale are all legal", () => {
  const scale = parseScale("! only a comment\n!\n\n0\n");
  assert.equal(scale.description, "");
  assert.equal(scale.size, 0);
  assert.deepEqual(scale.degrees, []);
});

test("scl: a period makes it cents, its absence makes it a ratio", () => {
  const scale = parseScale(["d", " 6", " 100.0", " 408.", " -5.0", " 3/2", " 2", " 10/20"].join("\n"));
  assert.equal(scale.size, 6);
  near(scale.degrees[0], 100, CENT, "100.0 cents");
  near(scale.degrees[1], 408, CENT, "trailing-period cents");
  near(scale.degrees[2], -5, CENT, "negative cents are legal");
  near(scale.degrees[3], 1200 * Math.log2(1.5), CENT, "3/2");
  near(scale.degrees[4], 1200, CENT, "a bare 2 means 2/1");
  near(scale.degrees[5], -1200, CENT, "10/20 is an octave down");
});

test("scl: anything after a valid pitch value is ignored", () => {
  const scale = parseScale(["d", "2", "100.0 cents", "5/4   E\\"].join("\n"));
  near(scale.degrees[0], 100, CENT, "trailing word after cents");
  near(scale.degrees[1], 1200 * Math.log2(1.25), CENT, "trailing note name after a ratio");
});

test("scl: the specification's own example file parses, mixing cents and ratios", () => {
  const scale = parseScale(MEANTONE);
  assert.equal(scale.description, "1/4-comma meantone scale. Pietro Aaron's temperament (1523)");
  assert.equal(scale.size, 12);
  near(scale.degrees[3], 1200 * Math.log2(5 / 4), CENT, "degree 4 given as 5/4");
  near(scale.period, 1200, CENT, "the closing 2/1 is the period");
  // Meantone's defining property: four fifths make a pure 5/4 two octaves up. The
  // tempered fifth is 696.578 cents, so 4 x that - 2400 is the major third.
  near(4 * scale.degrees[6] - 2400, scale.degrees[3], 1e-4, "four fifths make a just third");
});

test("scl: the last entry is the period, whatever it is", () => {
  near(parseScale(equalDivision(12)).period, 1200, CENT, "octave scale");
  near(parseScale(equalDivision(13, "3/1", TRITAVE_CENTS)).period, TRITAVE_CENTS, CENT, "tritave");
  near(parseScale("carlos alpha\n1\n 78.0\n").period, 78, CENT, "a scale that never repeats");
});

// --- the rejections --------------------------------------------------------------

for (const [what, text] of [
  ["a note count that disagrees with the file", "d\n3\n100.0\n200.0\n"],
  ["a missing note count", "just a description\n"],
  ["a non-numeric note count", "d\ntwelve\n100.0\n"],
  ["a negative ratio", "d\n1\n-3/2\n"],
  ["a zero ratio", "d\n1\n0/1\n"],
  ["a value that is neither", "d\n1\nfifth\n"],
  ["a file of nothing but comments", "! a\n! b\n"],
  ["a cents value starting with a decimal point", "d\n1\n.5\n"],
]) {
  test(`scl: rejects ${what}`, () => {
    assert.throws(() => parseScale(text), (error) => {
      assert.match(error.message, /^fm-synthesizers tunings:/);
      return true;
    });
  });
}

test("scl: a rejection names the line to look at", () => {
  assert.throws(() => parseScale("d\n2\n100.0\n-3/2\n"), /line 4:/);
});

test("createTuning: refuses a scale that cannot define a pitch", () => {
  assert.throws(() => createTuning(parseScale("d\n0\n")), /no period/);
  assert.throws(() => createTuning(parseScale("d\n1\n 0.0\n")), /must be finite and non-zero/);
});

// --- the tuning, on scales whose intervals are known -------------------------------

test("12-TET reproduces plain MIDI pitch on every key", () => {
  const tuning = createTuning(parseScale(equalDivision(12)));
  for (let key = 0; key <= 127; key++) {
    near(tuning.pitch(key), key, 1e-9, `key ${key}`);
  }
  near(tuning.frequency(69), 440, 1e-9, "A440");
  near(tuning.frequency(60), 440 * Math.pow(2, -9 / 12), 1e-9, "middle C");
});

test("19-EDO puts degree k at 12k/19 semitones", () => {
  const tuning = createTuning(parseScale(equalDivision(19)));
  for (const k of [1, 5, 11, 19, 26]) {
    near(tuning.pitch(60 + k) - tuning.pitch(60), 12 * k / 19, 1e-6, `degree ${k}`);
  }
  // The reason anyone plays 19: degree 6 is its major third, and it is FLAT of just,
  // where 12-TET's is 13.69 cents sharp. The sign is the whole point, so assert it.
  const third = (tuning.pitch(66) - tuning.pitch(60)) * 100;
  near(third, 6 * 1200 / 19, 1e-6, "degree 6 of 19");
  const error = third - 1200 * Math.log2(5 / 4);
  assert.ok(error > -8 && error < -7, `19-EDO third is ${error.toFixed(3)} cents off just`);
});

test("a 5-limit just scale puts 3/2 at exactly 701.955 cents", () => {
  const scale = parseScale(["Ptolemy's intense diatonic, 5-limit just", "7",
    "9/8", "5/4", "4/3", "3/2", "5/3", "15/8", "2/1"].join("\n"));
  const tuning = createTuning(scale);
  near((tuning.pitch(64) - tuning.pitch(60)) * 100, 1200 * Math.log2(3 / 2), 1e-9, "the fifth");
  near((tuning.pitch(62) - tuning.pitch(60)) * 100, 1200 * Math.log2(5 / 4), 1e-9, "the third");
  // A linear mapping is one key per DEGREE, not per semitone: seven keys is an octave.
  near(tuning.pitch(67) - tuning.pitch(60), 12, 1e-9, "seven keys make the octave");
});

test("Bohlen-Pierce repeats at 3:1, not at 2:1", () => {
  const tuning = createTuning(parseScale(equalDivision(13, "3/1", TRITAVE_CENTS)));
  near((tuning.pitch(73) - tuning.pitch(60)) * 100, TRITAVE_CENTS, 1e-6, "13 steps make a tritave");
  near((tuning.pitch(86) - tuning.pitch(60)) * 100, 2 * TRITAVE_CENTS, 1e-6, "26 steps make two");
  assert.ok(Math.abs((tuning.pitch(73) - tuning.pitch(60)) - 12) > 6,
    "13 BP steps must not land on an octave — something is assuming 2/1");
  near(tuning.period, TRITAVE_CENTS, CENT, "the tuning reports its own period");
});

test("Carlos alpha never returns to an octave", () => {
  const tuning = createTuning(parseScale("carlos alpha, 78.0-cent steps\n1\n 78.0\n"));
  near((tuning.pitch(61) - tuning.pitch(60)) * 100, 78, 1e-9, "one step");
  for (let k = 1; k <= 64; k++) {
    const cents = 78 * k;
    const nearestOctave = 1200 * Math.round(cents / 1200);
    assert.ok(Math.abs(cents - nearestOctave) > 1,
      `${k} alpha steps is ${cents} cents, within a cent of ${nearestOctave} — not alpha`);
  }
});

// --- keyboard mappings -------------------------------------------------------------

const LINEAR_KBM = ["! template", "0", "0", "127", "60", "69", "440.0", "12"].join("\n");

test("kbm: a size-0 map is linear and matches the built-in default", () => {
  const parsed = parseKeyboardMapping(LINEAR_KBM);
  assert.deepEqual({ ...parsed, keys: [...parsed.keys] }, { ...DEFAULT_MAPPING, keys: [] });
});

test("kbm: an explicit 12-entry map reproduces the linear case for a 12-note scale", () => {
  const explicit = parseKeyboardMapping(
    ["12", "0", "127", "60", "69", "440.0", "12",
      ...Array.from({ length: 12 }, (_, i) => String(i))].join("\n"));
  const scale = parseScale(equalDivision(12));
  const a = createTuning(scale, explicit);
  const b = createTuning(scale);
  for (let key = 0; key <= 127; key++) near(a.pitch(key), b.pitch(key), 1e-9, `key ${key}`);
});

test("kbm: an 'x' leaves the key unmapped, and trailing entries may be left out", () => {
  // Seven keys per repeat, only five of them mapped: a scale with fewer degrees than
  // the keyboard has keys, which is the case the field exists for.
  const mapping = parseKeyboardMapping(
    ["7", "0", "127", "60", "60", "440.0", "5", "0", "x", "1", "2", "x"].join("\n"));
  assert.deepEqual(mapping.keys, [0, null, 1, 2, null, null, null]);
  const tuning = createTuning(parseScale(equalDivision(5)), mapping);
  assert.equal(tuning.pitch(61), null, "an x key sounds nothing");
  assert.equal(tuning.pitch(65), null, "a left-out trailing key is unmapped too");
  near(tuning.pitch(67) - tuning.pitch(60), 12, 1e-9, "seven keys is one repeat of the map");
});

test("kbm: an unmapped reference note is a read error", () => {
  assert.throws(
    () => parseKeyboardMapping(["2", "0", "127", "60", "61", "440.0", "2", "0", "x"].join("\n")),
    /reference note 61 is unmapped/);
});

test("kbm: the reference note sounds the reference frequency, whatever the scale", () => {
  for (const [n, hz, key] of [[12, 440, 69], [19, 432, 69], [31, 256, 60]]) {
    const mapping = parseKeyboardMapping(
      ["0", "0", "127", "60", String(key), String(hz), "12"].join("\n"));
    const tuning = createTuning(parseScale(equalDivision(n)), mapping);
    near(tuning.frequency(key), hz, 1e-9, `${n}-EDO reference`);
  }
});

test("kbm: keys outside the retune range keep the engine's own pitch", () => {
  const mapping = parseKeyboardMapping(["0", "48", "72", "60", "69", "440.0", "12"].join("\n"));
  const tuning = createTuning(parseScale(equalDivision(19)), mapping);
  assert.equal(tuning.pitch(47), 47, "below the range");
  assert.equal(tuning.pitch(73), 73, "above the range");
  assert.notEqual(tuning.pitch(61), 61, "inside the range it is retuned");
});

test("kbm: a non-repeating 128-key map is accepted, a longer one is not", () => {
  const body = Array.from({ length: 128 }, (_, i) => String(i));
  const mapping = parseKeyboardMapping(
    ["128", "0", "127", "0", "0", "440.0", "128", ...body].join("\n"));
  assert.equal(mapping.keys.length, 128);
  assert.throws(() => parseKeyboardMapping(["129", "0", "127", "0", "0", "440.0", "128"].join("\n")),
    /never repeats/);
});

for (const [what, text] of [
  ["a truncated header", "0\n0\n127\n60\n"],
  ["a non-integer map size", "half\n0\n127\n60\n69\n440.0\n12"],
  ["a negative map size", "-1\n0\n127\n60\n69\n440.0\n12"],
  ["a zero reference frequency", "0\n0\n127\n60\n69\n0\n12"],
]) {
  test(`kbm: rejects ${what}`, () => {
    assert.throws(() => parseKeyboardMapping(text), /^Error: fm-synthesizers tunings:/);
  });
}

test("kbm: degrees may be negative and may lie outside the scale", () => {
  const mapping = parseKeyboardMapping(
    ["3", "0", "127", "60", "60", "440.0", "3", "-2", "0", "7"].join("\n"));
  const tuning = createTuning(parseScale(equalDivision(5)), mapping);
  near((tuning.pitch(61) - tuning.pitch(60)) * 100, 2 * 1200 / 5, 1e-6, "degree -2 below degree 0");
  near((tuning.pitch(62) - tuning.pitch(61)) * 100, 7 * 1200 / 5, 1e-6, "degree 7 above degree 0");
});

// --- playing it --------------------------------------------------------------------

/** Records what the engine was told, so the note-id contract can be asserted directly. */
function fakeEngine() {
  const calls = [];
  return {
    calls,
    noteOn: (note, vel, noteId) => calls.push(["noteOn", note, vel, noteId]),
    noteOff: (note, noteId) => calls.push(["noteOff", note, noteId]),
    setNotePitch: (note, pitch, noteId) => calls.push(["setNotePitch", note, pitch, noteId]),
  };
}

test("the keyboard names each note by its KEY, not by its pitch", () => {
  const engine = fakeEngine();
  const tuning = createTuning(parseScale(equalDivision(31)));
  const keyboard = createTunedKeyboard(engine, tuning);

  assert.equal(keyboard.noteOn(60, 0.9), true);
  assert.equal(keyboard.noteOn(61, 0.9), true);
  const [first, second] = engine.calls;
  assert.equal(first[3], 60, "the note id is the key");
  assert.equal(second[3], 61);
  // 31-EDO has more degrees than the keyboard has keys per octave, so pitch and key
  // have genuinely parted company. This is the assertion that fails if they have not.
  near(second[1] - first[1], 12 / 31, 1e-6, "one 31-EDO step apart");
  assert.deepEqual(keyboard.keys, [60, 61]);

  keyboard.noteOff(60);
  assert.deepEqual(engine.calls.at(-1), ["noteOff", first[1], 60]);
  assert.equal(keyboard.noteOff(60), false, "releasing twice does nothing");
});

test("two keys landing on one pitch stay two notes", () => {
  // A map that sends both keys to degree 0: without ids the second note-on would
  // retrigger the first, and one note-off would silence both.
  const mapping = parseKeyboardMapping(
    ["2", "0", "127", "60", "60", "440.0", "1", "0", "0"].join("\n"));
  const engine = fakeEngine();
  const keyboard = createTunedKeyboard(engine, createTuning(parseScale(equalDivision(12)), mapping));
  keyboard.noteOn(60);
  keyboard.noteOn(61);
  assert.equal(engine.calls[0][1], engine.calls[1][1], "same pitch");
  assert.notEqual(engine.calls[0][3], engine.calls[1][3], "different ids");
  keyboard.noteOff(60);
  assert.deepEqual(keyboard.keys, [61], "the other key is still sounding");
});

test("changing the scale under a held chord moves notes instead of retriggering them", () => {
  const engine = fakeEngine();
  const twelve = createTuning(parseScale(equalDivision(12)));
  const nineteen = createTuning(parseScale(equalDivision(19)));
  const keyboard = createTunedKeyboard(engine, twelve);
  for (const key of [60, 64, 67]) keyboard.noteOn(key);
  engine.calls.length = 0;

  keyboard.setTuning(nineteen);
  assert.equal(engine.calls.length, 3);
  for (const call of engine.calls) assert.equal(call[0], "setNotePitch");
  assert.ok(!engine.calls.some((call) => call[0] === "noteOn"), "nothing re-attacked");
  assert.deepEqual(engine.calls.map((call) => call[3]), [60, 64, 67], "identified by key");
  near(engine.calls[1][2], nineteen.pitch(64), 1e-9, "moved to the new scale's pitch");
  assert.equal(keyboard.tuning, nineteen);

  // And a second change must move from the CURRENT pitch, not the original one.
  engine.calls.length = 0;
  keyboard.setTuning(twelve);
  near(engine.calls[1][1], nineteen.pitch(64), 1e-9, "the from-pitch is where the note is now");
});

test("a key the tuning cannot play is refused, never clamped", () => {
  const engine = fakeEngine();
  // 5-EDO under a linear map spreads five keys over an octave, so key 127 is far above
  // MIDI 127 and the engine would clamp it onto a pitch the scale does not contain.
  const tuning = createTuning(parseScale(equalDivision(5)));
  const keyboard = createTunedKeyboard(engine, tuning);
  assert.ok(tuning.pitch(127) > 127, "the scale really does run off the end");
  assert.equal(keyboard.noteOn(127), false);
  assert.equal(engine.calls.length, 0, "nothing was sent");

  const mapping = parseKeyboardMapping(["2", "0", "127", "60", "60", "440.0", "2", "0", "x"].join("\n"));
  const sparse = createTunedKeyboard(engine, createTuning(parseScale(equalDivision(12)), mapping));
  assert.equal(sparse.noteOn(61), false, "an unmapped key sounds nothing");
});

test("a held key the new scale cannot play is released, not left ringing", () => {
  const engine = fakeEngine();
  const mapped = createTuning(parseScale(equalDivision(12)));
  const gap = parseKeyboardMapping(["2", "0", "127", "60", "60", "440.0", "2", "0", "x"].join("\n"));
  const keyboard = createTunedKeyboard(engine, mapped);
  keyboard.noteOn(61);
  engine.calls.length = 0;
  keyboard.setTuning(createTuning(parseScale(equalDivision(12)), gap));
  assert.equal(engine.calls[0][0], "noteOff");
  assert.deepEqual(keyboard.keys, []);
});

test("createTunedKeyboard refuses something that is not an engine", () => {
  assert.throws(() => createTunedKeyboard({}, createTuning(parseScale(equalDivision(12)))),
    /needs an engine/);
});
