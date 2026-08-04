import type { ParamName } from "./parameters.js";
export { ALGORITHM, PARAM, PARAMETERS, RATIOS } from "./parameters.js";
export type { ParameterDefinition, ParamName } from "./parameters.js";

/** An event applied at an absolute AudioContext time. */
export interface ScheduledEvent {
  type: "noteOn" | "noteOff" | "allOff" | "param";
  /**
   * MIDI pitch, for noteOn / noteOff. Continuous, not an integer: 60 is middle C and
   * 60.5 is the quarter-tone above it. Must be finite; anything else throws.
   */
  note?: number;
  /** 0..1, for noteOn. */
  vel?: number;
  /**
   * A name for this note, for noteOn / noteOff. Omit it and one is derived from the
   * pitch. Supply it to hold two notes at the same pitch, or to release one of them.
   */
  noteId?: number;
  /** Parameter id, for `param`. See {@link PARAM}. */
  id?: number;
  value?: number;
  /** AudioContext time in seconds. */
  at: number;
}

export interface Engine {
  /** The context the engine was created on — yours, or one it made. */
  readonly context: BaseAudioContext;
  /** The engine's output node. Connected to the destination unless `connect: false` was requested. */
  readonly node: AudioWorkletNode;
  /** Unambiguous output handle. This is the same AudioWorkletNode as `node`. */
  readonly output: AudioWorkletNode;
  /** Voices currently sounding. Updated ~10 times a second. */
  readonly voices: number;
  /** Called with engine stats as they arrive. */
  onStats?: (stats: { voices: number }) => void;
  /** Called when the worklet reports a runtime, message-deserialization, or processor error. */
  onError?: (error: Error) => void;
  /** Resume any non-running, non-closed context state, including WebKit's `interrupted`. Safe to call from a user gesture. */
  resume(): Promise<void>;
  /**
   * Start a note now. `note` is MIDI pitch (60 = middle C), `vel` is 0..1. Pitch is
   * continuous, so any tuning is playable — `noteOn(69.5)` is the quarter-tone above
   * A440. Outside 0..127 it is clamped; non-finite throws.
   *
   * `noteId` names the note. Omit it and the same pitch retriggers one voice, as before.
   * Supply distinct ids to hold the same pitch twice — two tunings of one key, or a
   * per-note expression channel.
   */
  noteOn(note: number, vel?: number, noteId?: number): void;
  /**
   * Release a note now; its amp release still rings out. Pass the `noteId` it was started
   * with, or omit it to release the note started at this pitch.
   */
  noteOff(note: number, noteId?: number): void;
  /** Release every sounding note, tails intact. */
  allOff(): void;
  /** Queue events at absolute context times; applied on the exact frame. */
  schedule(events: ScheduledEvent[]): void;
  /** Drop everything pending and silence. */
  clear(): void;
  /** Set one patch parameter, effective on the next block. */
  setParam(name: ParamName, value: number): void;
  /** Free the WASM engine and disconnect its output. Idempotent; closes only a context the library created. */
  dispose(): Promise<void>;
}

export interface CreateEngineOptions {
  /** Override where the WASM is fetched from. Defaults to the packaged asset. */
  wasmUrl?: string | URL;
  /** Override the worklet module URL. Defaults to inlined source via a Blob URL. */
  workletUrl?: string | URL;
  /** Supply your own context — required for an OfflineAudioContext render. */
  context?: BaseAudioContext;
  /** Connect the output to `context.destination`. Defaults to true; pass false for caller-controlled routing. */
  connect?: boolean;
  /**
   * Events applied at node construction. Required for offline rendering: an
   * OfflineAudioContext can finish rendering without ever servicing the message port.
   */
  initialEvents?: ScheduledEvent[];
}

/** Create the engine. Call from a user gesture; browsers refuse to start audio otherwise. */
export declare function createEngine(options?: CreateEngineOptions): Promise<Engine>;
