# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file records what changed for **users of the package**. The engineering record — what was wrong, how it was found, what was tried and abandoned — lives in commit messages and is deliberately not duplicated here.

## [Unreleased]

The note boundary is no longer twelve-tone. Pitch is continuous, a sounding note has a name of its own, and that name can be used to retune it while it plays. Existing code is unaffected: integer notes sound exactly as they did, sample for sample.

### Added

- **Fractional pitch.** `noteOn` and `noteOff` take a continuous MIDI pitch, so any tuning is playable. `noteOn(69.5)` is the quarter-tone above A440; step *k* of an *n*-tone equal division of the octave is `69 + 12 * k / n`. Previously the value was truncated to an integer and `noteOn(60.7)` sounded note 60.
- **`noteId`**, optional on `noteOn`, `noteOff`, and scheduled events — a name for a sounding note, independent of its pitch. Two notes at the same pitch with different ids sound together: one key at two tunings, or a per-note expression channel. Omit it and the same pitch retriggers one voice, exactly as before.
- **`setNotePitch(note, pitch, noteId?)`** retunes a sounding note without retriggering it. Envelopes keep their stage and level, so nothing re-attacks and there is no click; operator ratios follow the new pitch, so the timbre tracks rather than detuning. This is what live retuning needs — a scale change under a held chord, MTS or MTS-ESP, an MPE channel bend — and it is also ordinary pitch bend, which was previously unimplementable at any resolution. Applied instantly, with no glide.
- **`fm-synthesizers.js/tunings`**, a new subpath entry point that reads Scala `.scl` scale files and `.kbm` keyboard mappings and turns them into the continuous pitch the engine already takes. `parseScale`, `parseKeyboardMapping`, `createTuning`, and `createTunedKeyboard`. Nothing in the engine imports it, so it costs nothing unless you import it, and it imports nothing itself — the parser runs in Node with no audio context. `createTunedKeyboard` uses the **key** as each note's identity rather than its pitch, which is what makes a scale with more than twelve degrees per period playable from a twelve-key controller, and what lets `setTuning` move held notes to a new scale without re-attacking them. A scale's period is its last entry, whatever it is, so non-octave scales are ordinary; a malformed file is rejected with its line number rather than repaired.

### Changed

- A non-finite pitch now throws a `TypeError` instead of sounding something arbitrary. `noteOn(undefined)` used to play MIDI 0 in silence. Scheduled events and `createEngine({ initialEvents })` are checked the same way.
- Pitch outside 0..127 is clamped at both ends. Negative input previously wrapped through the unsigned boundary and sounded MIDI 127.

## [0.1.0] — 2026-08-02

First public version. `npm install`, three lines, a synthesizer.

### Synthesis

- Polyphonic FM engine, 16 voices, in one AudioWorklet with a Rust/WASM core.
- 4 operators per voice, each a sine with its own ratio, output level, and ADSR envelope.
- Four curated algorithms: carrier + 1 modulator, carrier + 2 modulators, two stacked pairs, and feedback FM (self-modulating operator).
- Modulation index as the headline control, with velocity mapped to index so harder playing brightens the tone.
- 4× oversampled rendering with a two-stage half-band decimator; the final stage is a sharper 127-tap filter so FM's infinite sideband series stays below the alias gate.
- Per-voice character: bounded pitch drift (a slow random walk) and envelope-time jitter, so a chord breathes instead of phase-locking.
- Ensemble chorus, ping-pong delay with tone control, and stereo feedback-delay-network reverb, wired into the patch definitions.
- A curated bank of 19 patches with explicit prior-intent provenance: e-piano-fm, warm-keys, bell, glass-bell, stack-keys, organ, piano-fm, breathy-brass, brass-lead, fm-bass, sub-bass, pluck-bass, metal-pluck, marimba, steel-drums, twang, fb-pad, strings, calliope. The classic FM sound families — mallets (1:4 ratio), drawbar organ (1:2:3 stack), metallic pans (inharmonic ratios), pure leads, and held pads.
- Reverb is used sparingly and only where the tail is the sound: rhythm patches (bass, plucks) are dry; bells and pads carry the wet. The bank averages ~0.20 reverbMix.

### Verification

- The harness grades the shipped engine against the closed-form Bessel spectrum (sidebands at *f_c ± k·f_m* with amplitudes *J_k(I)*) — alias, sideband structure, tuning, stability, headroom, determinism.
- Alias gate: shipped 4× path clears -35 dB worst case across the ratio/index grid; the naive 1× path is rejected.
- Patch bank is loudness-matched (≤ 8 dB spread) and mutually distinct (fingerprint gate).
- Audio-thread cost: 16 voices within the 2.667 ms / 128-frame budget gate.
