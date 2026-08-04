// Scala scale files, turned into the fractional MIDI pitch the engine already takes.
//
// SHIPS AS A SUBPATH (`fm-synthesizers.js/tunings`). Nothing in the engine imports it,
// so a consumer who never loads a scale downloads none of it, and it imports nothing
// itself -- `createTunedKeyboard` duck-types the engine -- so the parser runs in Node
// with no AudioContext anywhere.
//
// IMPLEMENTED FROM THE FORMAT SPECIFICATION, not from a reference implementation:
//   .scl              huygens-fokker.org/scala/scl_format.html
//   .kbm              huygens-fokker.org/scala/help.htm#mappings   ("Mappings")
//   degrees, period   huygens-fokker.org/scala/help.htm#scales     ("Scales")
// The third is the one that is easy to get wrong and impossible to notice: "The last
// note (with the highest degree number) of a scale serves as the formal octave...
// IMPORTANT: Scala never assumes you are using the value 2/1 or 1200 cents as the period
// or interval of equivalence." Nothing below hardcodes 2/1, so Bohlen-Pierce's 3:1 and
// Carlos alpha's non-repeating step are ordinary cases rather than exceptions.
//
// User-facing documentation is in tunings.d.ts; what is here is why the code is shaped
// this way. See agentic-docs/licensing.md: nothing was ported.

const PREFIX = "fm-synthesizers tunings";

// MIDI 69 is A440 in the engine (`midi_to_hz(n) = 440 * 2^((n-69)/12)`), so this is the
// one place the cents world and the pitch world meet.
const A4_KEY = 69;
const A4_HZ = 440;

const fail = (line, message) => {
  throw new Error(line === null ? `${PREFIX}: ${message}`
    : `${PREFIX}: line ${line}: ${message}`);
};

// Every parse error names the line the user has to look at; a parser that says only
// "invalid file" about a 60-line scale has told them nothing.
//
// TRAILING BLANK ROWS ARE DROPPED, and only trailing ones: the final newline every real
// text file ends with would otherwise be an extra row, which a `.kbm` that leaves its
// trailing unmapped keys out reads as a scale degree, rejecting a legal file.
//
// Nowhere else. A `.scl` description may be empty, and a blank line among pitch or
// degree entries is ambiguous rather than harmless, so it stays an error with a line
// number. This trim can only reach the description of a file containing nothing else,
// which is rejected anyway for having no note count.
function lines(text, what) {
  if (typeof text !== "string") fail(null, `${what} must be a string, got ${typeof text}`);
  const rows = text.split(/\r\n|\r|\n/).map((text, i) => ({ text, line: i + 1 }));
  while (rows.length && rows[rows.length - 1].text.trim() === "") rows.pop();
  return rows;
}

// "Lines beginning with an exclamation mark are regarded as comments." Leading
// whitespace is tolerated because files in the wild indent them, and reading an indented
// `!` as the description is a worse failure than being lenient. Blank lines are NOT
// skipped: the description line is allowed to be empty.
const isComment = (row) => row.text.trimStart().startsWith("!");

// --- .scl ------------------------------------------------------------------------

// A cents value "may not start with a decimal point... They may however end with one",
// so `408.` and `-5.0` are values and `.5` is not. Negative CENTS are legal; negative
// RATIOS are a read error. That asymmetry is why these are two expressions.
const CENTS = /^[+-]?\d+\.\d*/;
const RATIO = /^(\d+)(?:\/(\d+))?/;

// A SLASH COMMITS THE VALUE TO BEING A RATIO. Without this, `RATIO`'s optional group
// just fails to match and the numerator is taken alone, so `1/`, `1/x` and `1/-2` read
// as 1/1 and `3/` -- a truncated `3/2` -- reads as 3/1 and sounds a tritave. A corrupt
// file silently sounding a wrong pitch is what "no silent fallbacks" forbids, and it is
// unfalsifiable by ear because the scale is someone else's.
//
// Not the same as trailing junk: `5/2x` is a valid 5/2 followed by text to ignore, while
// `5/x` has no denominator. Whether digits follow the slash is the whole distinction.
const DANGLING_SLASH = /^\d+\/(?!\d)/;

// "If the value contains a period, it is a cents value, otherwise a ratio", and
// "anything after a valid pitch value should be ignored" -- hence matching a prefix
// rather than the whole line, so ` 5/4   E\` and `100.0 cents` both read correctly.
function pitchLineToCents(row) {
  const text = row.text.trim();
  const asCents = CENTS.exec(text);
  if (asCents) return Number(asCents[0]);
  if (DANGLING_SLASH.test(text)) {
    fail(row.line, `ratio "${text.split(/\s+/)[0]}" has no denominator after its slash`);
  }
  const asRatio = RATIO.exec(text);
  if (!asRatio) {
    fail(row.line, text.startsWith("-")
      ? `negative ratio "${text}" -- the specification makes this a read error`
      : `"${text}" is neither a cents value nor a ratio`);
  }
  // "Integer values with no period or slash should be regarded as such, for example
  // '2' should be taken as '2/1'."
  const numerator = Number(asRatio[1]);
  const denominator = asRatio[2] === undefined ? 1 : Number(asRatio[2]);
  if (numerator === 0 || denominator === 0) {
    fail(row.line, `ratio "${asRatio[0]}" has a zero term and names no pitch`);
  }
  return 1200 * Math.log2(numerator / denominator);
}

/** Parse a Scala `.scl` scale file. Throws with the offending line number. */
export function parseScale(text) {
  const rows = lines(text, "scale file").filter((row) => !isComment(row));
  if (!rows.length) fail(null, "scale file has no content, only comments");

  const description = rows[0].text.trim();
  if (rows.length < 2) fail(rows[0].line, "scale file ends before its note count");
  const countRow = rows[1];
  // "Spaces before or after the number are allowed" -- and nothing else is. A wrong
  // count is the classic corrupt scale file, so this one line is matched strictly.
  if (!/^\d+$/.test(countRow.text.trim())) {
    fail(countRow.line, `note count must be a non-negative integer, got "${countRow.text.trim()}"`);
  }
  const size = Number(countRow.text.trim());

  const body = rows.slice(2);
  if (body.length < size) {
    fail(countRow.line,
      `note count says ${size} but the file holds ${body.length} pitch line(s)`);
  }
  const degrees = body.slice(0, size).map(pitchLineToCents);
  return { description, size, degrees, period: size ? degrees[size - 1] : 0 };
}

// --- .kbm ------------------------------------------------------------------------

/** The mapping a scale gets when it arrives alone: Scala's own `example.kbm` values. */
export const DEFAULT_MAPPING = Object.freeze({
  size: 0, firstKey: 0, lastKey: 127, middleKey: 60,
  referenceKey: 69, referenceFrequency: 440, octaveDegree: 12,
  keys: Object.freeze([]),
});

const HEADER = [
  ["size", "size of map"],
  ["firstKey", "first MIDI note to retune"],
  ["lastKey", "last MIDI note to retune"],
  ["middleKey", "middle note, where the map's first entry lands"],
  ["referenceKey", "reference note"],
  ["referenceFrequency", "reference frequency"],
  ["octaveDegree", "scale degree to treat as the formal octave"],
];

function intField(row, label, min) {
  const token = row.text.trim().split(/\s+/)[0];
  if (!/^[+-]?\d+$/.test(token) || (min !== undefined && Number(token) < min)) {
    fail(row.line, `${label} must be an integer${min === 0 ? " >= 0" : ""}, got "${token}"`);
  }
  return Number(token);
}

/** Parse a Scala `.kbm` keyboard mapping. Throws with the line number. */
export function parseKeyboardMapping(text) {
  const rows = lines(text, "keyboard mapping").filter((row) => !isComment(row));
  if (rows.length < HEADER.length) {
    fail(null, `keyboard mapping needs ${HEADER.length} header values, found ${rows.length}`);
  }
  const map = {};
  HEADER.forEach(([field, label], i) => {
    const row = rows[i];
    if (field !== "referenceFrequency") {
      map[field] = intField(row, label, field === "size" ? 0 : undefined);
      return;
    }
    const token = row.text.trim().split(/\s+/)[0];
    const hz = Number(token);
    if (!Number.isFinite(hz) || hz <= 0) {
      fail(row.line, `${label} must be a positive number of hertz, got "${token}"`);
    }
    map[field] = hz;
  });

  // "For an unmapped key, put in an 'x'. At the end, unmapped keys may be left out."
  //
  // Left-out entries are NOT padded in. `mapKeyToDegree` already reads a missing index
  // as unmapped, so padding would only turn the file's declared `size` into an
  // allocation -- which then needs a limit the format does not set. Note that a size
  // larger than 128 is meaningful rather than absurd: offsets below the middle key are
  // negative, so with a middle key of 60 a size of 200 puts key 0 on entry 140.
  const keys = [];
  for (const row of rows.slice(HEADER.length, HEADER.length + map.size)) {
    const token = row.text.trim().split(/\s+/)[0];
    // Degrees may be "any number, also negative, also lie outside the scale range".
    keys.push(token === "x" || token === "X" ? null : intField(row, "scale degree"));
  }
  map.keys = keys;

  // "If this is done with the frequency reference note it will be considered an error."
  // Rejected at parse time because it makes the whole file meaningless: every other
  // key's pitch is anchored to this one.
  if (mapKeyToDegree(map, map.referenceKey) === null) {
    fail(null, `reference note ${map.referenceKey} is unmapped ("x"), so no key has a frequency`);
  }
  return map;
}

/** Which scale degree a MIDI key sounds, or null where the map says `x`. */
function mapKeyToDegree(mapping, key) {
  const offset = key - mapping.middleKey;
  if (mapping.size === 0) return offset;          // linear: one key per degree
  const repeat = Math.floor(offset / mapping.size);
  const degree = mapping.keys[offset - repeat * mapping.size];
  return degree === null || degree === undefined
    ? null
    : degree + repeat * mapping.octaveDegree;
}

// --- tuning ----------------------------------------------------------------------

// "There is no restriction to the degree numbers... they can be any number, also
// negative, also lie outside the scale range. It means pitches are always calculated
// based on octave extension." The extension is by the scale's OWN period -- the last
// listed entry -- which is the whole reason non-octave scales work here.
function degreeToCents(scale, degree) {
  const repeat = Math.floor(degree / scale.size);
  const index = degree - repeat * scale.size;
  return repeat * scale.period + (index === 0 ? 0 : scale.degrees[index - 1]);
}

/** Bind a scale to a keyboard mapping. */
export function createTuning(scale, mapping = DEFAULT_MAPPING) {
  if (!scale || !Array.isArray(scale.degrees)) fail(null, "createTuning needs a parsed scale");
  if (scale.size === 0) fail(null, "a scale with no notes has no period, so no key has a pitch");
  if (!Number.isFinite(scale.period) || scale.period === 0) {
    fail(null, `scale period is ${scale.period} cents; it must be finite and non-zero`);
  }

  const referenceCents = degreeToCents(scale, mapKeyToDegree(mapping, mapping.referenceKey));
  // Where the reference frequency sits on the continuous MIDI axis. Not necessarily an
  // integer: a reference of 432 Hz lands at 68.68.
  const referencePitch = A4_KEY + 12 * Math.log2(mapping.referenceFrequency / A4_HZ);

  // Outside [firstKey, lastKey] the key is NOT RETUNED -- those fields mean exactly
  // "first/last MIDI note number to retune" -- so it sounds the engine's own twelve-tone
  // pitch, which is the key number. Returning null instead would silence a range the
  // file only declined to change.
  //
  // This applies to the REFERENCE KEY too: a file whose reference sits outside its own
  // retune range still anchors every retuned key against `referenceFrequency`, but the
  // reference key itself sounds twelve-tone. Legal, so not rejected; documented on
  // `referenceFrequency` and pinned by a test.
  const pitch = (key) => {
    if (key < mapping.firstKey || key > mapping.lastKey) return key;
    const degree = mapKeyToDegree(mapping, key);
    if (degree === null) return null;
    return referencePitch + (degreeToCents(scale, degree) - referenceCents) / 100;
  };

  return {
    scale, mapping, pitch, period: scale.period, size: scale.size,
    frequency: (key) => {
      const p = pitch(key);
      return p === null ? null : A4_HZ * Math.pow(2, (p - A4_KEY) / 12);
    },
  };
}

// --- playing it ------------------------------------------------------------------

// Below 0 or above 127 the engine clamps, which would sound a pitch the scale does not
// contain. A key the tuning pushes off the end is refused, never quietly moved.
const playable = (p) => p !== null && p >= 0 && p <= 127;

/**
 * Play a tuning from a keyboard, using the KEY as each note's identity.
 *
 * This is the part that stops being optional once a scale has more than twelve degrees
 * per period. On a 12-key-per-octave controller the key number and the pitch it sounds
 * are then different things, and two keys can land on the same pitch -- at which point
 * `noteOff(pitch)` cannot tell which of them to release, and a scale change cannot find
 * the note it needs to move. Passing the key as `noteId` fixes all of it: identity is
 * the key, pitch is a function of the key, and the two are free to disagree.
 */
export function createTunedKeyboard(engine, tuning) {
  if (!engine || typeof engine.noteOn !== "function") {
    fail(null, "createTunedKeyboard needs an engine from createEngine()");
  }
  let current = tuning;
  const sounding = new Map();          // key -> the pitch it is currently sounding

  return {
    get tuning() { return current; },
    get keys() { return [...sounding.keys()]; },

    noteOn(key, vel = 0.8) {
      const p = current.pitch(key);
      if (!playable(p)) return false;
      engine.noteOn(p, vel, key);
      sounding.set(key, p);
      return true;
    },

    noteOff(key) {
      const p = sounding.get(key);
      if (p === undefined) return false;
      sounding.delete(key);
      engine.noteOff(p, key);
      return true;
    },

    allOff() {
      for (const [key, p] of sounding) engine.noteOff(p, key);
      sounding.clear();
    },

    // Held notes MOVE rather than retrigger. A held key the new tuning cannot play is
    // released rather than left ringing at the old scale's pitch.
    setTuning(next) {
      current = next;
      for (const key of [...sounding.keys()]) {
        const p = next.pitch(key);
        if (playable(p)) {
          engine.setNotePitch(sounding.get(key), p, key);
          sounding.set(key, p);
        } else {
          engine.noteOff(sounding.get(key), key);
          sounding.delete(key);
        }
      }
    },
  };
}
