# Architecture: fm-synthesizers.js — an FM sibling

Date: 2026-08-02
Status: **accepted (owner, 2026-08-02)** — authorises the thesis, architecture, roster,
and phasing below, and the name **`fm-synthesizers.js`**. Does NOT authorise writing DSP
code before the M0 harness exists (owner direction, inherited from subtractive M0).

## Thesis

**FM has the most exact analytic ground truth in the family, and the hardest alias
problem.** Every classic FM signature — electric-piano-ish, bell, breathy brass — is a
known ratio + index + envelope combination, and the spectrum of a carrier/modulator pair
is closed form (Bessel functions). That makes FM the cleanest *specification* project of
the three. It also makes alias the dominant engineering problem: the Bessel series is
infinite, so sidebands above Nyquist always fold back, and oversampling is not optional.

The product is still curation. There is no reference recording we are failing to match; a
bell patch that offends nobody has failed.

## What FM changes about the engine

### The voice: operators → algorithm → envelopes

The subtractive voice is osc → filter → amp. The FM voice is a **set of operators** in a
**fixed, curated algorithm**, each operator being:

- a sine oscillator at `ratio × note_freq` (or a fixed frequency),
- an output level (which, combined with the downstream operator's sensitivity, IS the
  modulation index — FM's "drive"),
- its own ADSR envelope.

The **algorithm** decides who modulates whom. Patches select the algorithm; the user gets
the classic panel controls (index, ratio, envelope times). The signal path is fixed and
curated, not a modular environment — the family rule applies unchanged.

### The two structural differences from subtractive

1. **No filter in the voice.** FM shapes timbre with ratio and index, not cutoff. The
   FX rack (chorus/delay/reverb) still lives on the track; the reverb is still required
   for pads.
2. **Oversampling is the per-voice cost.** The subtractive voice oversampled 2× to lift
   the PolyBLEP ceiling. FM oversamples because it *must*: a high index generates dozens
   of sidebands, and folding is the whole alias problem. Budget for the FM voice to be
   the heaviest per-voice cost, like the supersaw was in subtractive. Measure first, set
   the gate after.

### Operator model, first pass

- 4 operators per voice (enough for the classic 2- and 3-operator signatures plus a
  simple feedback topology), expandable to 6.
- Ratios relative to the note, in the classic set (0.5, 1.0, 1.4, 1.5, 2.0, 3.0, 4.0, 5.0,
  6.0, 7.0, 8.0) plus a free ratio.
- A small set of fixed algorithms (e.g. carrier+modulator, carrier+2 modulators,
  parallel pair, feedback), selected per patch.
- **Modulation index is the headline control** — the parameter players reach for — so it
  belongs in the "deep escape hatches" API surface alongside the panel controls.
- **Per-voice character** (drift, phase spread) transfers and matters more: FM operators
  phase-lock readily without it.

## The roster

The classic FM signatures, ordered by wow ÷ effort, named WITHOUT the brand (trademark
policy binds hardest for FM — see `agentic-docs/licensing.md`):

1. **Electric-piano-ish** (ratio 1:1, sharp index attack, slow decay) — the most
   recognisable FM signature.
2. **Bell** (inharmonic ratios, percussive index envelope) — unmistakable.
3. **Breathy brass** (multiple modulators, high index).
4. **Bass** (low carrier, sine-ish, fast).
5. **Pluck / key** (short index envelope).

## Bundle budget

Subtractive used 60 KB gz for the whole library; FM has no reason to need more — the
primitive set is small and the "data" is a preset table. Proposal: **60 KB gz**, owned by
`scripts/audit/bundle-size-audit.sh`, never restated from memory. Set the number after
measuring a first voice (the subtractive M1 lesson: pick a threshold after measuring, or
it's theatre).

## Phasing

- **M0 — Bootstrap.** Copy the plumbing from the shipped sibling byte-identical where
  possible, record source SHAs in the licensing ledger, adapt the constitution and
  design docs, CI green on an empty build, harness audit clean, the FM verify harness
  runnable against a stub FM pair (Bessel sidebands synthesized directly) so the loop
  exists before the DSP. Gate: single-source id generation proven by a fake-patch test;
  the alias/cheat suite proven to reject cheats.
- **M1 — First sound.** 4 operators, a carrier+modulator algorithm, ADSR, through the
  copied worklet host, playable in a minimal playground. Gate: a note sounds; the alias
  harness reports a real number; dsp-bench reports per-voice cost.
- **M2 — The full operator set + character + oversampling.** All classic ratios, the
  curated algorithm set, per-voice drift, the general-purpose oversampling wrapper. Gate:
  alias suppression ≥ target across ratio × index × algorithm; no NaN at max feedback
  sustained 60 s.
- **M3 — The roster.** Patches 1–5. Curation-heavy. Gate: `audit-character` honest grade
  per patch; owner ear on the e-piano-ish and bell.
- **M4 — The effects that make it.** Chorus, delay, reverb wired into patch definitions
  (a bell without its tail is not that bell).
- **M5 — Evals, playground, release candidate.** Multi-track arrangement benchmark, alias
  gate in CI, bundle audit owning the published number, playground deploy. Gate: 32
  voices across ≥4 tracks ≤ 50 % of the 2.67 ms budget on M1 desktop.

## Deferred until demanded

Wavetable engine (yet another sibling). MPE. Modulation matrix beyond the fixed
routings. User-authored patch format. Sequencer/arpeggiator (this is an instrument
library, not a groovebox). SIMD. Threads/SharedArrayBuffer. Per-instrument WASM
splitting. Shared engine extraction — **permanently off** (owner decision 2026-08-02;
each sibling ships its own hard copy of the plumbing).

## Open questions for the owner

1. **Algorithm surface** — fixed curated algorithms (patch selects) vs a DX-style
   algorithm-number escape hatch. Proposal: fixed set, decided at M2; the escape hatch is
   the panel controls, not a modular matrix.
2. **Operator count** — 4 first (proposal) vs 6 up front. 4 covers the roster; 6 is a
   larger surface for the same classic sounds.
3. **Feedback FM** — include a self-modulating operator in M2? It is the classic
   "feedback" FM character but it is the stability risk.
4. **The GM handoff** — the physical sibling routes GM programs to a SynthPad stub; FM is
   a candidate real implementation for the FM-ish GM programs. Post-release question.
