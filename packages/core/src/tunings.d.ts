import type { Engine } from "./index.js";

/** A parsed Scala `.scl` file. */
export interface Scale {
  /** The file's description line. May be empty; the format allows that. */
  description: string;
  /** Number of listed degrees. Degree 0 is the implicit 1/1 and is never listed. */
  size: number;
  /** `degrees[i]` is degree `i + 1`, in cents above 1/1. */
  degrees: number[];
  /**
   * The interval the scale repeats at, in cents — the last listed entry, whatever it is.
   * 1200 for an octave scale, 1901.955 for Bohlen–Pierce's 3:1 tritave, 78 for a scale
   * of one 78-cent step that never returns to an octave at all. Nothing assumes 2/1.
   */
  period: number;
}

/** A parsed Scala `.kbm` keyboard mapping. */
export interface KeyboardMapping {
  /** Keys per repeat of the map. 0 is a linear map: one key per scale degree. */
  size: number;
  /** First MIDI key to retune. Keys below it are left at the engine's own tuning. */
  firstKey: number;
  /** Last MIDI key to retune. */
  lastKey: number;
  /** The key the map's first entry lands on. */
  middleKey: number;
  /** The key whose frequency is given. */
  referenceKey: number;
  /**
   * Hertz. This anchors the whole tuning: every retuned key's pitch is computed as an
   * interval from `referenceKey` at this frequency, whatever the scale.
   *
   * `referenceKey` itself sounds this frequency **only if it is inside
   * `[firstKey, lastKey]`.** A file may put the reference outside its own retune range —
   * that is legal, and it still anchors every key that *is* retuned — but the reference
   * key then sounds the engine's untouched twelve-tone pitch rather than this value. It
   * is legal enough not to reject and surprising enough to state.
   */
  referenceFrequency: number;
  /** The degree whose interval separates adjacent repeats of the map. Unused when `size` is 0. */
  octaveDegree: number;
  /**
   * One entry per key in a repeat: a scale degree, or `null` for an unmapped key (`x`).
   * Shorter than `size` when the file left its trailing unmapped keys out, which the
   * format permits — an index past the end is unmapped, exactly like an explicit `x`.
   */
  keys: (number | null)[];
}

export interface Tuning {
  readonly scale: Scale;
  readonly mapping: KeyboardMapping;
  /**
   * The fractional MIDI pitch this key sounds — the value to hand to `noteOn`. `null`
   * when the mapping leaves the key unmapped. Outside the mapping's retune range the
   * key is returned unchanged, because that is what "first/last note to retune" means.
   */
  pitch(key: number): number | null;
  /** The same answer in hertz, or `null` for an unmapped key. */
  frequency(key: number): number | null;
  /** Cents per repeat of the scale. */
  readonly period: number;
  /** Degrees per repeat. More than 12 is what makes note ids compulsory. */
  readonly size: number;
}

/**
 * A keyboard that plays a tuning, using the KEY as each note's identity.
 *
 * Once a scale has more than twelve degrees per period, the key number and the pitch it
 * sounds are different things and two keys can land on one pitch — so `noteOff(pitch)`
 * becomes ambiguous and a scale change cannot find the note it needs to move. Passing
 * the key as `noteId` resolves both.
 */
export interface TunedKeyboard {
  readonly tuning: Tuning;
  /** The keys currently down. */
  readonly keys: number[];
  /**
   * Start `key`. Returns false and starts nothing when the tuning leaves the key
   * unmapped, or puts it outside the engine's 0..127 pitch range.
   */
  noteOn(key: number, vel?: number): boolean;
  /** Release `key`. Returns false if it was not sounding. */
  noteOff(key: number): boolean;
  /** Release everything. */
  allOff(): void;
  /**
   * Change the scale under whatever is already sounding. Held notes move to their new
   * pitch through `setNotePitch`, so nothing re-attacks and there is no click. A held
   * key the new tuning cannot play is released.
   */
  setTuning(next: Tuning): void;
}

/**
 * Parse a Scala `.scl` scale file. Throws with the offending line number rather than
 * repairing anything: a malformed scale that half-loads is a tuning nobody chose.
 */
export declare function parseScale(text: string): Scale;

/** Parse a Scala `.kbm` keyboard mapping. Throws with the line number on malformed input. */
export declare function parseKeyboardMapping(text: string): KeyboardMapping;

/**
 * The mapping a scale gets when it arrives without a `.kbm`: linear, one key per degree,
 * counting from middle C, with key 69 tuned to 440 Hz.
 */
export declare const DEFAULT_MAPPING: Readonly<KeyboardMapping>;

/** Bind a scale to a keyboard mapping. */
export declare function createTuning(scale: Scale, mapping?: KeyboardMapping): Tuning;

/** Play a tuning from an engine, with the key as each note's identity. */
export declare function createTunedKeyboard(engine: Engine, tuning: Tuning): TunedKeyboard;
