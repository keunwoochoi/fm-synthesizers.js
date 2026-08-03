<p align="center">
  <img src="https://raw.githubusercontent.com/keunwoochoi/fm-synthesizers.js/main/assets/logo/logo-256.png" width="140" alt="fm-synthesizers.js — [=] tile-mosaic logo">
</p>

# fm-synthesizers.js

[![npm](https://img.shields.io/npm/v/fm-synthesizers.js.svg)](https://www.npmjs.com/package/fm-synthesizers.js)
[![license](https://img.shields.io/npm/l/fm-synthesizers.js.svg)](LICENSE-MIT)

<!-- generated:product-summary -->
A 26.1 KB gzipped browser FM synthesizer with 10 curated patches and 40 documented controls. Audio is synthesized at runtime in a WebAssembly AudioWorklet; the package contains no samples and needs no network access while playing.
<!-- /generated:product-summary -->

[npm package](https://www.npmjs.com/package/fm-synthesizers.js) | [Patch showcase](https://keunwoochoi.github.io/fm-synthesizers.js/apps/playground/showcase.html) | [Playground](https://keunwoochoi.github.io/fm-synthesizers.js/apps/playground/index.html) | [Changelog](https://github.com/keunwoochoi/fm-synthesizers.js/blob/main/CHANGELOG.md)

## Install

```sh
npm install fm-synthesizers.js
```

<!-- generated:quickstart -->
```js
import { createEngine } from "fm-synthesizers.js";
import { applyPreset } from "fm-synthesizers.js/presets";

const engine = await createEngine();   // resolves its own WASM and worklet
applyPreset(engine, "e-piano-fm");
engine.noteOn(60, 0.9);
```
<!-- /generated:quickstart -->

Call `createEngine()` from a user gesture because browsers control when audio may start. The engine resolves its packaged WASM and inlined worklet itself, and `applyPreset()` sends a complete patch so no state carries over from the previous sound.

## What is included

- A voice of **4 operators** (sine oscillators, each with its own ratio, level, and ADSR) routed through **fixed, curated algorithms** — carrier+modulator, carrier+2 modulators, stacked pairs, and a feedback topology.
- **Modulation index** as the headline control — FM's "drive" — with velocity mapped to index so harder playing brightens the tone.
- 4× oversampled rendering: FM's Bessel sideband series is infinite, so the alias problem is the whole game, and the shipped path is measured against the closed-form spectrum.
- Ensemble chorus, ping-pong delay with tone control, and stereo feedback-delay-network reverb.
- A curated patch bank with explicit intent provenance (roster landing in M3) rather than a sample download or external asset service.

<!-- generated:roster -->
| group | patches |
|---|---:|
| keys | 5 |
| pluck | 2 |
| brass | 1 |
| bass | 1 |
| pad | 1 |
| **total** | **10** |
<!-- /generated:roster -->

## Compatibility and lifecycle

The ESM imports are SSR-safe: importing the package does not touch `window` or construct an `AudioContext`. Packed-package checks install the tarball into clean projects and render audio in Chromium and Playwright WebKit; separate fixtures build it without library-specific configuration in Vite, webpack 5, and Next.

`createEngine({ context })` shares a caller-owned `BaseAudioContext`, while `createEngine({ connect: false })` leaves `engine.output` unconnected for caller-controlled routing. `engine.resume()` recovers any non-running, non-closed context state, including WebKit's `interrupted` state. `engine.dispose()` is idempotent, frees the worklet's WASM engine, disconnects output, and closes only a context created by the library. Construction failures reject `createEngine()`; later worklet, processor, and message errors reach `engine.onError` and the console.

No CDN, sample, or network request is made while playing. The only runtime fetch is the WASM file installed with the package unless the caller supplies `wasmUrl`; the worklet is inlined into the JavaScript build.

## API

<!-- generated:api -->
**`createEngine(options?)` → `Promise<Engine>`**

| option | meaning |
|---|---|
| `wasmUrl?: string \| URL` | Override where the WASM is fetched from. Defaults to the packaged asset. |
| `workletUrl?: string \| URL` | Override the worklet module URL. Defaults to inlined source via a Blob URL. |
| `context?: BaseAudioContext` | Supply your own context — required for an OfflineAudioContext render. |
| `connect?: boolean` | Connect the output to `context.destination`. Defaults to true; pass false for caller-controlled routing. |
| `initialEvents?: ScheduledEvent[]` | Events applied at node construction. Required for offline rendering: an OfflineAudioContext can finish rendering without ever servicing the message port. |

**`Engine`**

| member | meaning |
|---|---|
| `readonly context: BaseAudioContext` | The context the engine was created on — yours, or one it made. |
| `readonly node: AudioWorkletNode` | The engine's output node. Connected to the destination unless `connect: false` was requested. |
| `readonly output: AudioWorkletNode` | Unambiguous output handle. This is the same AudioWorkletNode as `node`. |
| `readonly voices: number` | Voices currently sounding. Updated ~10 times a second. |
| `onStats?: (stats: { voices: number }) => void` | Called with engine stats as they arrive. |
| `onError?: (error: Error) => void` | Called when the worklet reports a runtime, message-deserialization, or processor error. |
| `resume(): Promise<void>` | Resume any non-running, non-closed context state, including WebKit's `interrupted`. Safe to call from a user gesture. |
| `noteOn(note: number, vel?: number): void` | Start a note now. `note` is MIDI (60 = middle C), `vel` is 0..1. |
| `noteOff(note: number): void` | Release a note now; its amp release still rings out. |
| `allOff(): void` | Release every sounding note, tails intact. |
| `schedule(events: ScheduledEvent[]): void` | Queue events at absolute context times; applied on the exact frame. |
| `clear(): void` | Drop everything pending and silence. |
| `setParam(name: ParamName, value: number): void` | Set one patch parameter, effective on the next block. |
| `dispose(): Promise<void>` | Free the WASM engine and disconnect its output. Idempotent; closes only a context the library created. |

`PARAMETERS` is the authoritative metadata for all 40 controls; `PARAM`, `ALGORITHM`, `RATIOS`, preset defaults, declarations, the playground, and the parameter table below derive from it.
<!-- /generated:api -->

For deterministic offline rendering, pass an `OfflineAudioContext` and `initialEvents` to `createEngine()`, then call `context.startRendering()`. A live engine instead accepts `noteOn()`, `noteOff()`, `schedule()`, and `setParam()` messages after construction.

## Parameters

`PARAMETERS` is exported from the main entry point and is the source of every parameter id, preset-reset default, supported range, increment, unit, and enum value. `DEFAULTS` from `fm-synthesizers.js/presets` is generated from the same definitions. Presets merge their partial overrides over those defaults before applying all controls. Values outside the supported range are not part of the public contract. An optional `editorMax` is a preferred slider ceiling for fine control; the playground expands it when a loaded preset uses a larger supported value.

<!-- generated:parameters -->
| parameter | id | preset default | supported range | step | unit / values |
|---|---:|---:|---:|---:|---|
| `algorithm` | 0 | 0 | 0 … 3 | 1 | `mod1` = 0, `mod2` = 1, `stack2` = 2, `feedback` = 3 |
| `index` | 1 | 0.5 | 0 … 2 | 0.01 | ratio |
| `feedback` | 2 | 0 | 0 … 0.9 | 0.01 | ratio |
| `velToIndex` | 3 | 0.3 | 0 … 1 | 0.01 | ratio |
| `gain` | 4 | 0.32 | 0 … 0.85 | 0.01 | linear gain |
| `op1Ratio` | 5 | 1 | 0.5 … 8 | 0.1 | ratio |
| `op1Level` | 6 | 0.7 | 0 … 1 | 0.01 | linear gain |
| `op1Attack` | 7 | 0.005 | 0.001 … 2 | 0.001 | seconds |
| `op1Decay` | 8 | 0.3 | 0.005 … 2 | 0.005 | seconds |
| `op1Sustain` | 9 | 0.5 | 0 … 1 | 0.01 | ratio |
| `op1Release` | 10 | 0.2 | 0.005 … 3 | 0.005 | seconds |
| `op2Ratio` | 11 | 2 | 0.5 … 8 | 0.1 | ratio |
| `op2Level` | 12 | 0.6 | 0 … 1 | 0.01 | linear gain |
| `op2Attack` | 13 | 0.005 | 0.001 … 2 | 0.001 | seconds |
| `op2Decay` | 14 | 0.3 | 0.005 … 2 | 0.005 | seconds |
| `op2Sustain` | 15 | 0.5 | 0 … 1 | 0.01 | ratio |
| `op2Release` | 16 | 0.2 | 0.005 … 3 | 0.005 | seconds |
| `op3Ratio` | 17 | 3 | 0.5 … 8 | 0.1 | ratio |
| `op3Level` | 18 | 0.5 | 0 … 1 | 0.01 | linear gain |
| `op3Attack` | 19 | 0.005 | 0.001 … 2 | 0.001 | seconds |
| `op3Decay` | 20 | 0.3 | 0.005 … 2 | 0.005 | seconds |
| `op3Sustain` | 21 | 0.5 | 0 … 1 | 0.01 | ratio |
| `op3Release` | 22 | 0.2 | 0.005 … 3 | 0.005 | seconds |
| `op4Ratio` | 23 | 4 | 0.5 … 8 | 0.1 | ratio |
| `op4Level` | 24 | 0.5 | 0 … 1 | 0.01 | linear gain |
| `op4Attack` | 25 | 0.005 | 0.001 … 2 | 0.001 | seconds |
| `op4Decay` | 26 | 0.3 | 0.005 … 2 | 0.005 | seconds |
| `op4Sustain` | 27 | 0.5 | 0 … 1 | 0.01 | ratio |
| `op4Release` | 28 | 0.2 | 0.005 … 3 | 0.005 | seconds |
| `chorusMix` | 29 | 0 | 0 … 1 | 0.01 | ratio |
| `chorusRate` | 30 | 0.6 | 0.05 … 6 | 0.01 | Hz |
| `chorusDepth` | 31 | 3 | 0 … 12 | 0.1 | milliseconds |
| `delayMix` | 32 | 0 | 0 … 1 | 0.01 | ratio |
| `delayTime` | 33 | 0.25 | 0.02 … 1 | 0.005 | seconds |
| `delayFeedback` | 34 | 0.35 | 0 … 0.92 | 0.01 | ratio |
| `delayTone` | 35 | 3200 | 400 … 16000 | 100 | Hz |
| `reverbMix` | 36 | 0 | 0 … 1 | 0.01 | ratio |
| `reverbSize` | 37 | 0.6 | 0 … 1 | 0.01 | ratio |
| `reverbDamp` | 38 | 4200 | 800 … 14000 | 100 | Hz |
| `reverbPredelay` | 39 | 18 | 0 … 100 | 1 | milliseconds |
<!-- /generated:parameters -->

## Known limits

- This is a browser AudioWorklet library, not a Node audio renderer, DAW, sequencer, arpeggiator, sampler, Web MIDI adapter, or plugin format.
- Chromium and Playwright WebKit are blocking release targets. Firefox and direct mobile-device performance tiers are not currently release gates.
- The voice pool steals the oldest voice when exhausted. Under load the engine degrades by shedding a voice rather than increasing its fixed allocation.
- `setParam()` rejects unknown names, but callers are responsible for keeping values inside the exported `PARAMETERS` ranges.

Alias suppression is a hard CI gate with the shipped 4× path clearing -35 dB worst case across the ratio/index grid; the residual ceiling sits below -40 dB and is driven by the final-stage decimation filter (see `scripts/verify/verify_spec.py` and `crates/dsp/src/filter.rs`).

## Size

<!-- generated:bundle -->
| artifact | raw | gzipped |
|---|---:|---:|
| `packages/core/wasm/fm_dsp.wasm` | 45,836 B | 18,216 B |
| `packages/core/src/index.js` | 7,870 B | 2,815 B |
| `packages/core/src/parameters.js` | 4,554 B | 1,586 B |
| `packages/core/src/presets.js` | 6,497 B | 1,961 B |
| `packages/core/worklet/processor.js` | 5,766 B | 2,169 B |
| **total** | | **26,747 B (26.1 KB)** |

Budget is 60 KB gzipped for the whole library — currently **43%**.
<!-- /generated:bundle -->

## Runtime cost

<!-- generated:bench -->
| | |
|---|---|
| voices in the reference arrangement | 16 (pad + bass + lead, chorus on) |
| audio-thread budget used | **17.4 %** of the 2.667 ms / 128-frame budget |
| real-time factor | 5.8x |
<!-- /generated:bench -->

The benchmark saturates the voice pool with the reference arrangement and enables the feedback algorithm and full index, which is the worst case this build can produce. The measurement describes the machine that regenerated the table; performance on other devices, including mobile devices, is not claimed.

## Verification

An FM carrier/modulator pair has an exact closed-form spectrum — sidebands at *f_c ± k·f_m* with Bessel amplitudes *J_k(I)* — so the harness grades the shipped engine against the analytic prototype, checks alias energy, stability, headroom, tuning, patch-bank loudness and distinctness, audio-thread cost, artifact size, package installation, browser audio, lifecycle failure paths, and real consumer builds.

<!-- generated:verdicts -->
| candidate | alias dB | sideband err | verdict |
|---|---:|---:|---|
| `honest_fm` | -58.9 | 0.7 | **PASS** |
| `wasm_fm` | -41.3 | 0.7 | **PASS** |
| `wasm_fm_1x` | -17.9 | 0.7 | REJECT (passed visible) |
| `naive_fm` | -17.9 | 0.7 | REJECT (passed visible) |
| `cheat_silence` | inf | inf | REJECT |
| `cheat_pure_sine` | -57.9 | 75.3 | REJECT |
| `cheat_brickwall` | -57.8 | 75.3 | REJECT |
| `cheat_special_cased` | -17.9 | 0.7 | REJECT (passed visible) |
<!-- /generated:verdicts -->

`wasm_fm` is the shipped path. The remaining candidates include deliberate cheats: silence, a pure sine (a carrier-only oscillator has no sidebands at index > 0), a brick-wall construction, and a candidate special-cased to the visible grid. Their rejection demonstrates that an alias metric cannot pass by deleting the intended sideband structure or overfitting published cases.

### Measured alias suppression

<!-- generated:alias-table -->
| ratio | naive FM | honest Bessel | shipped WASM |
|---:|---:|---:|---:|
| 1.0 | -119.8 dB | -119.8 dB | -102.3 dB |
| 2.0 | -119.9 dB | -119.9 dB | -103.3 dB |
| 3.0 | -119.7 dB | -119.7 dB | -104.1 dB |
| 7.0 | -90.0 dB | -120.2 dB | -98.2 dB |
<!-- /generated:alias-table -->

## Patch intent coverage

Every exported preset is bound to exactly one checked intent artifact. `prior` means Git history proves the intent predates implementation. The bank starts empty and presets land with a prior intent committed first; there is no retrospective migration because the checker exists from day one.

<!-- generated:intent-coverage -->
| intent coverage | count |
|---|---:|
| exported presets | 10 |
| exactly mapped implemented intents | 10 |
| written before implementation | 10 |
| reconstructed after implementation | 0 |
| proposed before implementation | 0 |
<!-- /generated:intent-coverage -->

## Harness

<!-- generated:harness-stats -->
| | |
|---|---|
| harness audit assertions | 21 |
| Python harness/spec tests | 20 |
| public metadata/README tests | 9 |
| deliberately-broken fixtures | 8 |
<!-- /generated:harness-stats -->

Rules are enforced as hooks, generated artifacts, or failing tests rather than prose alone. That includes deliberately broken fixtures proving the audit can fail for the defect it claims to catch.

- [`PRINCIPLES.md`](https://github.com/keunwoochoi/fm-synthesizers.js/blob/main/PRINCIPLES.md) — project constitution.
- [`AGENTS.md`](https://github.com/keunwoochoi/fm-synthesizers.js/blob/main/AGENTS.md) — operating rules and task routing.
- [`agentic-docs/design/`](https://github.com/keunwoochoi/fm-synthesizers.js/tree/main/agentic-docs/design) — architecture, verification, release criteria, and harness evidence.
- [`agentic-docs/build-usage-log.md`](https://github.com/keunwoochoi/fm-synthesizers.js/blob/main/agentic-docs/build-usage-log.md) — token cost of the build, by session.

## Development

```sh
rustup target add wasm32-unknown-unknown
npm install
git config core.hooksPath .githooks

cargo build -p fm-dsp --target wasm32-unknown-unknown --release
npm run audit:harness
npm run verify:spec
npm run audit:bundle
npm run check:install
npm run check:types
npm run check:bundlers
```

## A short build log

This project is the third sibling in the `sets-of-instruments-js` family, after
[`physical-instruments.js`](https://github.com/keunwoochoi/physical-instruments.js) and
[`subtractive-synthesizers.js`](https://github.com/keunwoochoi/subtractive-synthesizers.js).
The plumbing and the harness were copied from the subtractive sibling byte-identical
where possible, with provenance recorded in the licensing ledger; what FM adds is the
operator model and a harder alias problem.

FM builds a tone by using one oscillator to modulate the phase of another. A carrier at
*f_c* modulated by a modulator at *f_m* with index *I* produces sidebands at *f_c ± k·f_m*
with amplitudes given by Bessel functions — an exact, closed-form spectrum. That is why
FM is the cleanest specification project in the family: the verification harness can
grade the engine against the mathematics itself, no recording required. It is also why
the alias problem is harder than in subtractive: the sideband series is infinite, so
there is always content above Nyquist folding back, and the shipped path runs 4×
oversampled to keep it honest.

The technique has a well-documented history. John Chowning's original work at Stanford
established the mathematics, and the first commercial instruments based on it — the
Yamaha DX series, starting with the DX7 in 1983 — made FM the sound of a decade's pop
and its electric-piano-ish and bell signatures the most recognisable synthesizer
timbre after the analog classics. The DX7's popularity turned FM into a specific
cultural memory while its patents were still live; both the patents and the marketing
hype are long gone, and what remains is a genuinely distinct way to shape a spectrum.

## License

Dual-licensed under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option. Porting and trademark policy is recorded in the repository's [licensing ledger](https://github.com/keunwoochoi/fm-synthesizers.js/blob/main/agentic-docs/licensing.md).
