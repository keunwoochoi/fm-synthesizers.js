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

/**
 * A `.kbm` as it would exist ON DISK: real header comments, and the trailing newline
 * every editor writes.
 *
 * The first version of this suite built its fixtures with `join("\n")`, which has no
 * trailing newline — and that is precisely the shape no real file has. A short map plus
 * a trailing newline was rejected as a malformed file for two commits, passing a suite
 * that was self-consistently wrong about what a file looks like. Every mapping fixture
 * goes through here now so that cannot recur silently.
 */
const kbm = (size, overrides = {}, entries = [], eol = "\n") => {
  const f = {
    firstKey: 0, lastKey: 127, middleKey: 60,
    referenceKey: 69, referenceFrequency: 440, octaveDegree: 12, ...overrides,
  };
  return ["! generated fixture", String(size), String(f.firstKey), String(f.lastKey),
    String(f.middleKey), String(f.referenceKey), String(f.referenceFrequency),
    String(f.octaveDegree), "! mapping", ...entries].join(eol) + eol;
};

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

// A SLASH COMMITS THE VALUE TO BEING A RATIO. Before this was enforced, the optional
// denominator group simply failed to match and the numerator was taken alone, so every
// line below parsed as `n/1` and a corrupt file sounded a wrong pitch in silence. The
// `3/` case is the one that shows why it matters: a truncated `3/2` became a tritave.
for (const [value, wouldHaveBeen] of [
  ["1/", "1/1, 0 cents"],
  ["1/-2", "1/1, 0 cents"],
  ["1/x", "1/1, 0 cents"],
  ["3/", "3/1, a tritave where a fifth was written"],
  ["1//2", "1/1, 0 cents"],
]) {
  test(`scl: rejects "${value}" rather than reading it as ${wouldHaveBeen}`, () => {
    assert.throws(() => parseScale(`d\n1\n${value}\n`), /no denominator after its slash/);
  });
}

test("scl: trailing junk after a COMPLETE ratio is still ignored", () => {
  // The distinction the rule above turns on: `5/2x` is a valid 5/2 followed by text
  // that "should be ignored", where `5/x` is a ratio with no denominator. Over-strictness
  // here would reject the specification's own `5/4   E\\` example.
  near(parseScale("d\n1\n5/2x\n").degrees[0], 1200 * Math.log2(5 / 2), CENT, "5/2x is 5/2");
  near(parseScale("d\n1\n5/4   E\\\n").degrees[0], 1200 * Math.log2(5 / 4), CENT, "the spec example");
  near(parseScale("d\n1\n1/2/3\n").degrees[0], -1200, CENT, "a second slash is trailing junk");
});

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

test("kbm: a size-0 map is linear and matches the built-in default", () => {
  const parsed = parseKeyboardMapping(kbm(0, {}, []));
  assert.deepEqual({ ...parsed, keys: [...parsed.keys] }, { ...DEFAULT_MAPPING, keys: [] });
});

test("kbm: an explicit 12-entry map reproduces the linear case for a 12-note scale", () => {
  const explicit = parseKeyboardMapping(
    kbm(12, {}, Array.from({ length: 12 }, (_, i) => String(i))));
  const scale = parseScale(equalDivision(12));
  const a = createTuning(scale, explicit);
  const b = createTuning(scale);
  for (let key = 0; key <= 127; key++) near(a.pitch(key), b.pitch(key), 1e-9, `key ${key}`);
});

test("kbm: an 'x' leaves the key unmapped, and trailing entries may be left out", () => {
  // Seven keys per repeat, only five of them written down: a scale with fewer degrees
  // than the keyboard has keys, which is the case the field exists for.
  const mapping = parseKeyboardMapping(
    kbm(7, { middleKey: 60, referenceKey: 60, octaveDegree: 5 }, ["0", "x", "1", "2", "x"]));
  assert.deepEqual(mapping.keys, [0, null, 1, 2, null], "only what the file wrote down");
  const tuning = createTuning(parseScale(equalDivision(5)), mapping);
  assert.equal(tuning.pitch(61), null, "an x key sounds nothing");
  assert.equal(tuning.pitch(65), null, "a left-out trailing key is unmapped too");
  near(tuning.pitch(67) - tuning.pitch(60), 12, 1e-9, "seven keys is one repeat of the map");
});

// THE REGRESSION. A `.kbm` that leaves its trailing unmapped keys out -- which the format
// explicitly permits -- and ends with a newline, which every file on disk does. Splitting
// on newlines turned that final newline into an empty row, and a short map read it as a
// scale degree and rejected the file. A FULL map stops before the empty row, which is why
// the first version of this suite never saw it: its fixtures were `join("\n")`, so none of
// them had the trailing newline that every real file has.
test("kbm: a short map in a file that ends with a newline is legal", () => {
  for (const [what, eol] of [["LF", "\n"], ["CRLF", "\r\n"], ["CR", "\r"]]) {
    // The reference note has to be inside the entries that ARE written down; see the
    // test below for what happens when it is not.
    const text = kbm(12, { referenceKey: 60, referenceFrequency: 261.6255653 },
      ["0", "1", "2"], eol);
    assert.ok(text.endsWith(eol), `${what} fixture must end with its line ending`);
    const mapping = parseKeyboardMapping(text);
    assert.deepEqual(mapping.keys, [0, 1, 2], `${what}: the trailing newline is not a degree`);
    const tuning = createTuning(parseScale(equalDivision(12)), mapping);
    near(tuning.pitch(60), 60, 1e-6, `${what}: middle C still sounds middle C`);
    near(tuning.pitch(62), 62, 1e-6, `${what}: and the entries that exist still map`);
    assert.equal(tuning.pitch(64), null, `${what}: a left-out key is unmapped`);
  }
});

test("kbm: a left-out key is unmapped, so a reference note among them is an error", () => {
  // A left-out trailing entry is equivalent to an explicit "x" — the format says
  // unmapped keys "may be left out at the end" — and the format also says an unmapped
  // reference note is an error. So this file is rejected, but for the RIGHT reason.
  // Before the trailing-newline fix it was rejected for the wrong one: the file's final
  // newline was read as a fourth entry and reported as a malformed scale degree.
  const text = kbm(12, { referenceKey: 69 }, ["0", "1", "2"]);
  assert.throws(() => parseKeyboardMapping(text), (error) => {
    assert.match(error.message, /reference note 69 is unmapped/);
    assert.doesNotMatch(error.message, /got ""/,
      "the trailing newline is being read as a degree again");
    return true;
  });
});

test("scl: a file that ends with a newline, in any line ending, parses the same", () => {
  for (const eol of ["\n", "\r\n", "\r"]) {
    const text = ["! generated", "just a fifth", " 2", " 3/2", " 2/1"].join(eol) + eol;
    const scale = parseScale(text);
    assert.equal(scale.size, 2);
    assert.equal(scale.description, "just a fifth");
    near(scale.degrees[0], 1200 * Math.log2(1.5), CENT, "the fifth survives the line ending");
    near(scale.period, 1200, CENT, "so does the period");
  }
});

test("scl: a blank line among the pitch values is still an error", () => {
  // The trailing-newline fix must not turn into "ignore blank lines", because a blank
  // line between entries is ambiguous rather than harmless.
  assert.throws(() => parseScale("d\n2\n100.0\n\n200.0\n"), /line 4:/);
});

test("kbm: an unmapped reference note is a read error", () => {
  assert.throws(
    () => parseKeyboardMapping(kbm(2, { middleKey: 60, referenceKey: 61, octaveDegree: 2 },
      ["0", "x"])),
    /reference note 61 is unmapped/);
});

test("kbm: the reference note sounds the reference frequency, whatever the scale", () => {
  for (const [n, hz, key] of [[12, 440, 69], [19, 432, 69], [31, 256, 60], [53, 415.3, 69]]) {
    const mapping = parseKeyboardMapping(
      kbm(0, { referenceKey: key, referenceFrequency: hz }, []));
    const tuning = createTuning(parseScale(equalDivision(n)), mapping);
    near(tuning.frequency(key), hz, 1e-9, `${n}-EDO reference`);
  }
});

test("kbm: keys outside the retune range keep the engine's own pitch", () => {
  const mapping = parseKeyboardMapping(kbm(0, { firstKey: 48, lastKey: 72 }, []));
  const tuning = createTuning(parseScale(equalDivision(19)), mapping);
  assert.equal(tuning.pitch(47), 47, "below the range");
  assert.equal(tuning.pitch(73), 73, "above the range");
  assert.notEqual(tuning.pitch(61), 61, "inside the range it is retuned");
});

test("kbm: a mapped key BELOW the middle key crosses the repeat boundary correctly", () => {
  // The suite had no case for this: the only lower key it touched was outside the retune
  // range and returned early. Offsets below the middle key are negative, and JavaScript's
  // `%` keeps the sign -- so a `%`-based implementation reads keys[-1], gets undefined,
  // and reports every key below middle C as unmapped while passing everything else here.
  const mapping = parseKeyboardMapping(
    kbm(12, { middleKey: 60, referenceKey: 60, referenceFrequency: 261.6255653 },
      Array.from({ length: 12 }, (_, i) => String(i))));
  const tuning = createTuning(parseScale(equalDivision(19)), mapping);
  const step = 1200 / 19;

  assert.notEqual(tuning.pitch(59), null, "key 59 is mapped, not off the end of the array");
  // Key 59 is one key below middle: entry 11 of the previous repeat, so degree 11 - 12.
  near((tuning.pitch(59) - tuning.pitch(60)) * 100, -step, 1e-6, "one 19-EDO step down");
  // Key 48 is exactly one repeat down: entry 0, degree -12.
  near((tuning.pitch(48) - tuning.pitch(60)) * 100, -12 * step, 1e-6, "twelve steps down");
  // And two repeats down, so the floor division is exercised past -1.
  near((tuning.pitch(36) - tuning.pitch(60)) * 100, -24 * step, 1e-6, "twenty-four steps down");
  // Symmetry: the same distance up and down must be the same interval.
  near(tuning.pitch(72) - tuning.pitch(60), tuning.pitch(60) - tuning.pitch(48), 1e-9,
    "up and down one repeat are the same interval");

  // An 'x' below the middle key must still be unmapped, so the index really is being
  // computed rather than clamped to something that happens to be in range.
  const sparse = parseKeyboardMapping(
    kbm(12, { middleKey: 60, referenceKey: 60, referenceFrequency: 261.6255653 },
      ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "x"]));
  assert.equal(createTuning(parseScale(equalDivision(19)), sparse).pitch(59), null,
    "entry 11 is x, so key 59 is unmapped");
});

test("kbm: a reference note outside the retune range still anchors the keys that are in it", () => {
  // Legal, and surprising enough to pin: the reference key itself is NOT retuned, so it
  // sounds its twelve-tone pitch rather than referenceFrequency -- while every key that
  // IS retuned is still anchored against that frequency. Documented on
  // referenceFrequency in tunings.d.ts.
  const mapping = parseKeyboardMapping(
    kbm(0, { firstKey: 70, lastKey: 72, referenceKey: 69, referenceFrequency: 432 }));
  const tuning = createTuning(parseScale(equalDivision(12)), mapping);
  assert.equal(tuning.pitch(69), 69, "the reference key is outside its own retune range");
  near(tuning.frequency(69), 440, 1e-9, "so it sounds twelve-tone, not 432 Hz");
  near(tuning.pitch(70), 69 + 12 * Math.log2(432 / 440) + 1, 1e-9,
    "but an in-range key is still anchored against 432 Hz");
  near(tuning.frequency(70), 432 * Math.pow(2, 1 / 12), 1e-9, "a semitone above the reference");
});

test("kbm: a map longer than 128 keys still indexes meaningfully", () => {
  // Offsets below the middle key are negative, so a map far larger than MIDI's key range
  // is not nonsense: with a middle key of 60, key 0 lands on entry 140 of 200. An earlier
  // version capped size at 128 on the opposite reasoning and rejected this file.
  const entries = Array.from({ length: 200 }, (_, i) => String(i));
  const mapping = parseKeyboardMapping(
    kbm(200, { middleKey: 60, referenceKey: 60, octaveDegree: 12 }, entries));
  assert.equal(mapping.keys.length, 200);
  const tuning = createTuning(parseScale(equalDivision(12)), mapping);
  assert.equal(mapping.keys[140], 140, "entry 140 is the one key 0 reads");
  assert.ok(Number.isFinite(tuning.pitch(0)), "key 0 has a pitch, from the far end of the map");
  // Entry 12 is degree 12, which is one period up in a 12-note scale.
  near(tuning.pitch(72) - tuning.pitch(60), 12, 1e-9, "entry 12 is a period above entry 0");
});

test("kbm: a non-repeating 128-key map is accepted", () => {
  const entries = Array.from({ length: 128 }, (_, i) => String(i));
  const mapping = parseKeyboardMapping(
    kbm(128, { middleKey: 0, referenceKey: 0, octaveDegree: 128 }, entries));
  assert.equal(mapping.keys.length, 128);
});

for (const [what, text] of [
  ["a truncated header", kbm(0, {}, []).split("\n").slice(0, 4).join("\n") + "\n"],
  ["a non-integer map size", "half\n0\n127\n60\n69\n440.0\n12\n"],
  ["a negative map size", "-1\n0\n127\n60\n69\n440.0\n12\n"],
  ["a zero reference frequency", "0\n0\n127\n60\n69\n0\n12\n"],
  ["a blank line inside the map entries", "3\n0\n127\n60\n60\n440.0\n3\n0\n\n2\n"],
]) {
  test(`kbm: rejects ${what}`, () => {
    assert.throws(() => parseKeyboardMapping(text), /^Error: fm-synthesizers tunings:/);
  });
}

test("kbm: a reference frequency is decimal, not whatever Number() will swallow", () => {
  // Same class as a ratio with no denominator: `Number()` also parses 0x/0b/0o literals,
  // so a corrupt line reads as a plausible frequency instead of an error -- in the one
  // field every other key's pitch is anchored to. 0x1B8 is 440, 0o660 is 432, 0b101 is 5.
  for (const bad of ["0x1B8", "0b101", "0o660", "440abc", "", "-440", "0"]) {
    assert.throws(() => parseKeyboardMapping(kbm(0, { referenceFrequency: bad })),
      /reference frequency must be a positive number of hertz/, `"${bad}" must be rejected`);
  }
  for (const [good, hz] of [["440.0", 440], ["432", 432], ["4.4e2", 440], ["261.6255653", 261.6255653]]) {
    assert.equal(parseKeyboardMapping(kbm(0, { referenceFrequency: good })).referenceFrequency, hz,
      `"${good}" must still parse`);
  }
});

test("kbm: degrees may be negative and may lie outside the scale", () => {
  const mapping = parseKeyboardMapping(
    kbm(3, { middleKey: 60, referenceKey: 60, octaveDegree: 3 }, ["-2", "0", "7"]));
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
