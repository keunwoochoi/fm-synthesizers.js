# Report — fm-synthesizers.js (draft)

> Milestone report scaffold. Exists from M0 so the write-up is never written from memory
> at the end (the stale-draft lesson, `07-lessons-learned.md`). **Every number in this
> report is generated between markers and refreshed per milestone — never typed.**

## Product summary

<!-- generated:product-summary -->
A 26.1 KB gzipped browser FM synthesizer with 10 curated patches and 40 documented controls. Audio is synthesized at runtime in a WebAssembly AudioWorklet; the package contains no samples and needs no network access while playing.
<!-- /generated:product-summary -->

## Bundle

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

## Alias suppression (the M1 gate)

<!-- generated:alias-table -->
| ratio | naive FM | honest Bessel | shipped WASM |
|---:|---:|---:|---:|
| 1.0 | -119.8 dB | -119.8 dB | -102.3 dB |
| 2.0 | -119.9 dB | -119.9 dB | -103.3 dB |
| 3.0 | -119.7 dB | -119.7 dB | -104.1 dB |
| 7.0 | -90.0 dB | -120.2 dB | -98.2 dB |
<!-- /generated:alias-table -->

## Spec harness verdicts

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

## Patch bank

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

## Audio-thread budget

<!-- generated:bench -->
| | |
|---|---|
| voices in the reference arrangement | 16 (pad + bass + lead, chorus on) |
| audio-thread budget used | **17.1 %** of the 2.667 ms / 128-frame budget |
| real-time factor | 5.8x |
<!-- /generated:bench -->
