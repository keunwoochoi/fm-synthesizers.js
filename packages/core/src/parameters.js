/**
 * Authoritative public parameter metadata.
 *
 * Parameter ids, preset-reset defaults, supported control ranges, increments, units,
 * and enum values are defined here once. The public constants, preset defaults,
 * playground controls, TypeScript declarations, and README table all derive from this
 * object. A `default` is the value applied for an omitted field whenever a preset is
 * loaded; it is not a request to mutate the engine during construction.
 */

/** Fixed, curated algorithms. Patches select one; the user gets the panel controls. */
export const ALGORITHM = Object.freeze({
  /** Carrier + 1 modulator: the classic 2-op FM signature. */
  mod1: 0,
  /** Carrier + 2 parallel modulators: brass and rich plucks. */
  mod2: 1,
  /** Two stacked modulator->carrier pairs: the e-piano-ish 4-op stack. */
  stack2: 2,
  /** Feedback: the first modulator modulates itself, then the carrier. */
  feedback: 3,
});

/** Classic FM ratio set, relative to the note pitch. */
export const RATIOS = Object.freeze({
  half: 0.5,
  one: 1,
  fourteen: 1.4,
  fifteen: 1.5,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
});

const define = (id, defaultValue, min, max, step, unit, values, editorMax) => Object.freeze({
  id,
  default: defaultValue,
  min,
  max,
  step,
  unit,
  ...(values ? { values } : {}),
  ...(editorMax === undefined ? {} : { editorMax }),
});
const enumeration = (id, defaultValue, values) => define(
  id, defaultValue, Math.min(...Object.values(values)), Math.max(...Object.values(values)), 1, "enum", values,
);

export const PARAMETERS = Object.freeze({
  algorithm: enumeration(0, 0, ALGORITHM),
  /** The headline FM control: how hard the modulators drive the carrier. */
  index: define(1, 0.5, 0, 2, 0.01, "ratio", undefined, 1),
  /** Self-modulation depth of the feedback operator. */
  feedback: define(2, 0, 0, 0.9, 0.01, "ratio"),
  /** Velocity -> index: FM's defining expressive gesture (brightness, not just level). */
  velToIndex: define(3, 0.3, 0, 1, 0.01, "ratio"),
  gain: define(4, 0.32, 0, 0.85, 0.01, "linear gain", undefined, 0.8),

  op1Ratio: define(5, 1, 0.5, 8, 0.1, "ratio", undefined, 4),
  op1Level: define(6, 0.7, 0, 1, 0.01, "linear gain"),
  op1Attack: define(7, 0.005, 0.001, 2, 0.001, "seconds"),
  op1Decay: define(8, 0.3, 0.005, 2, 0.005, "seconds"),
  op1Sustain: define(9, 0.5, 0, 1, 0.01, "ratio"),
  op1Release: define(10, 0.2, 0.005, 3, 0.005, "seconds"),

  op2Ratio: define(11, 2, 0.5, 8, 0.1, "ratio", undefined, 4),
  op2Level: define(12, 0.6, 0, 1, 0.01, "linear gain"),
  op2Attack: define(13, 0.005, 0.001, 2, 0.001, "seconds"),
  op2Decay: define(14, 0.3, 0.005, 2, 0.005, "seconds"),
  op2Sustain: define(15, 0.5, 0, 1, 0.01, "ratio"),
  op2Release: define(16, 0.2, 0.005, 3, 0.005, "seconds"),

  op3Ratio: define(17, 3, 0.5, 8, 0.1, "ratio", undefined, 4),
  op3Level: define(18, 0.5, 0, 1, 0.01, "linear gain"),
  op3Attack: define(19, 0.005, 0.001, 2, 0.001, "seconds"),
  op3Decay: define(20, 0.3, 0.005, 2, 0.005, "seconds"),
  op3Sustain: define(21, 0.5, 0, 1, 0.01, "ratio"),
  op3Release: define(22, 0.2, 0.005, 3, 0.005, "seconds"),

  op4Ratio: define(23, 4, 0.5, 8, 0.1, "ratio", undefined, 4),
  op4Level: define(24, 0.5, 0, 1, 0.01, "linear gain"),
  op4Attack: define(25, 0.005, 0.001, 2, 0.001, "seconds"),
  op4Decay: define(26, 0.3, 0.005, 2, 0.005, "seconds"),
  op4Sustain: define(27, 0.5, 0, 1, 0.01, "ratio"),
  op4Release: define(28, 0.2, 0.005, 3, 0.005, "seconds"),

  chorusMix: define(29, 0, 0, 1, 0.01, "ratio"),
  chorusRate: define(30, 0.6, 0.05, 6, 0.01, "Hz"),
  chorusDepth: define(31, 3, 0, 12, 0.1, "milliseconds"),
  delayMix: define(32, 0, 0, 1, 0.01, "ratio"),
  delayTime: define(33, 0.25, 0.02, 1, 0.005, "seconds"),
  delayFeedback: define(34, 0.35, 0, 0.92, 0.01, "ratio"),
  delayTone: define(35, 3200, 400, 16000, 100, "Hz"),
  reverbMix: define(36, 0, 0, 1, 0.01, "ratio"),
  reverbSize: define(37, 0.6, 0, 1, 0.01, "ratio"),
  reverbDamp: define(38, 4200, 800, 14000, 100, "Hz"),
  reverbPredelay: define(39, 18, 0, 100, 1, "milliseconds"),
});

/** Numeric ids sent across the AudioWorklet boundary. */
export const PARAM = Object.freeze(Object.fromEntries(
  Object.entries(PARAMETERS).map(([name, definition]) => [name, definition.id]),
));

/** Complete preset-reset state. Exported as `DEFAULTS` from the presets entry point. */
export const PARAM_DEFAULTS = Object.freeze(Object.fromEntries(
  Object.entries(PARAMETERS).map(([name, definition]) => [name, definition.default]),
));
