# Verification and harness: how this project decides it is right

Date: 2026-08-02
Status: **accepted (owner, 2026-08-02)** — authorises the FM-specific verification
regime below and the M0 harness-first order, inheriting everything in the subtractive
sibling's `2026-07-28-verification-and-harness.md` that is not FM-specific. The
subtractive document owns the three-tier model, Loop A / Loop B, the evaluator-integrity
six rules, the patch intent statement, and the process. This document owns only what FM
changes.

## The inheritance, stated once

The subtractive sibling proved the core move: **no reference recording, because there is
a reference equation.** That transfers to FM unchanged — and FM's equations are if
anything more exact than subtractive's. What changes:

1. **The analytic prototype is the Bessel sideband equation, not a harmonic series.** A
   carrier at *f_c* modulated by a modulator at *f_m* with modulation index *I* produces
   sidebands at *f_c ± k·f_m* with amplitudes *J_k(I)* (Bessel functions of the first
   kind). That is closed-form ground truth of the same kind subtractive used for a saw.
2. **Alias is FM's crown-jewel tripwire, twice over.** The Bessel series is infinite, so
   there is always sideband content above Nyquist to fold back. The alias gate from
   subtractive transfers and becomes *more* central — sweep operator ratio × index ×
   algorithm across the range, grade the worst case, hold oversampling honest.
3. **Stability is a real failure mode again.** Feedback FM (an operator modulating itself)
   can blow up or go chaotic. The stability aspect transfers verbatim plus a
   self-modulation blow-up probe.
4. **Tune has an FM-specific twist.** A ratio mismatch changes the *timbre* (sideband
   placement), not just the pitch. Tuning checks cover operator-frequency accuracy *and*
   ratio quantization effects.
5. **Dynamics transfers.** FM's classic expressive move is velocity → index (brightness),
   the analog of velocity → cutoff. Velocity 20 vs 100 must move loudness AND spectral
   centroid.

## The quality matrix, adapted

**stability → headroom → alias → tune → envelope → dynamics → character** — the
subtractive order, inherited unchanged. The aspect-level verdicts:

| Aspect | FM verdict |
|---|---|
| **stability** | Keep, raised priority. Feedback FM is a genuine blow-up mode; probe with a self-modulating operator sustained 60 s. |
| **headroom** | Keep. A high index folds dozens of sidebands into a single dense spectrum; peaks are enormous and invisible to RMS. |
| **alias** | Keep, and it is the headline gate. Infinite Bessel series → always folding; oversampling is not optional. Worst case over ratio × index × algorithm. |
| **tune** | Keep, narrowed: carrier frequency accuracy AND ratio quantization (a ratio of 1.001 vs 1.0 changes sidebands, not pitch). |
| **envelope** | Keep. Per-operator ADSR; the envelope is what shapes an FM tone from bell to pad. |
| **dynamics** | Keep, more central. Velocity → index is FM's defining gesture. |
| **character** | Replace voice, inherit "pick one target tone and commit". FM's recognizable signatures (electric-piano-ish, bell, breathy brass) are the roster. |

## Tier 1 analytic gates (closed-form, hard CI)

| Gate | Analytic ground truth | What we measure |
|---|---|---|
| Sideband placement | sidebands at *f_c ± k·f_m* | Energy where a sideband is predicted vs where nothing should be |
| Bessel amplitude | amplitude ∝ *J_k(I)* | Measured sideband magnitude vs Bessel value, normalised to the carrier |
| Alias | infinite Bessel series, only content below Nyquist is real | Energy at frequencies that are neither predicted sidebands nor harmonics — the worst case over the grid |
| Index response | a pure FM pair's spectrum as a function of *I* | Sideband count and balance track *I*; at *I*=0 the output is a pure sine |
| Tuning | requested MIDI pitch → f_c; ratio → f_m | Cents deviation of carrier and modulator |
| Stability | feedback FM must stay bounded | No NaN/inf/denormal at max index and max feedback, sustained |
| Headroom | nothing clips | Sample peak across every patch, every velocity |
| Determinism | frozen render contract | Fixed patches, fixed notes, hashed output |

## The evaluator-integrity six rules — inherited verbatim

1. The DSP returns a buffer; the harness computes every number.
2. Grade the worst case, never the average.
3. The cheat suite ships before the DSP.
4. Visible grid for iteration, hidden grid for the gate.
5. Differential-test against the prototype on randomized inputs.
6. Immutable skeleton.

The FM cheat suite is the subtractive one plus the FM-specific degenerate optimum:

- **silence** — perfect alias, no sound → must fail rms.
- **pure sine** — perfect alias, but no sidebands → must fail the sideband/Bessel gate
  (this is the cheat a carrier-only oscillator is; the harness must reject it).
- **brickwall** — an FM pair with everything above 4 kHz removed → kills alias and the
  upper sidebands together → must fail.
- **special-cased grid** — correct on the visible frequencies, naive elsewhere → must fail
  on the hidden grid.
- **carrier-with-zero-index** — *I* = 0 is a pure sine *by the equation*; it must PASS the
  index-response gate at *I* = 0 (it is not a cheat, it is the definition) but must not
  pass at *I* > 0. This is the FM-specific "honest optimization must be accepted" case.

## The reference-corpus question — settled in advance

FM hardware recordings are **calibration spot-checks, never convergence targets**;
scratchpad only, never committed, license verified first. No verified CC0/CC-BY corpus of
FM synthesizer multi-samples is known to exist (the subtractive survey of 2026-07-28
found none for analog; expect the same for FM). This is recorded so it is not re-litigated.
`PRINCIPLES.md` states the reference-corpus non-goal verbatim.

## M0 gate (harness before DSP, owner direction inherited)

M0 is done when all of this is true and CI is green on an empty build:

1. `PRINCIPLES.md` — FM constitution, including specification-not-recording, the
   reference-corpus non-goal, and a bundle ceiling owned by a script.
2. `AGENTS.md` — constitution + routing only, no repo map.
3. This doc and `2026-08-02-architecture.md`, accepted.
4. `scripts/audit/harness-audit.sh` + doc-vs-code checker + pre-commit hook (copied).
5. `scripts/audit/bundle-size-audit.sh`, owning the ceiling (copied).
6. The Tier-1 FM harness skeleton — `verify-spec` runnable and reporting real numbers on
   a stub FM pair, so the loop exists before the DSP it will judge. The stub must
   implement the *equation* (Bessel sidebands synthesized directly) as the "honest"
   candidate that passes, so the harness is proven against its own answer key before any
   real DSP exists.
7. The patch intent schema + one worked example (FM electric-piano-ish, named without
   the brand).
8. Skills, reframed for FM.
9. `.github/` issue forms, PR template, CI, and the journey-log tracker issue opened.
10. `agentic-docs/licensing.md` seeded with the copied-plumbing provenance and source SHAs.
11. The report scaffold, with generated-number discipline wired in.
12. Single-source id generation, proven by the fake-patch test.

## The cascade — unchanged

```
stage 1  NaN, denormal, DC offset, not-silent, clipping     → binary
stage 2  tuning cents; sideband/Bessel match vs prototype   → binary
stage 3  alias and inharmonic energy, WORST case            → continuous (fitness lives here)
stage 4  CPU budget (interleaved, warmed, min-of-N)         → binary
stage 5  Loop B listening — stage-4 survivors only          → human veto + next metric
```

Listening is still the scarcest resource; nothing that fails an analytic gate gets a
listening trial.
