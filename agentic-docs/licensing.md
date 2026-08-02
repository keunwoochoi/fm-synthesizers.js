# Licensing ledger & clean-room policy

fm-synthesizers.js is dual-licensed **MIT OR Apache-2.0** (user's choice, Rust-ecosystem
convention). The permissive license is part of the product. This file is the single owner of porting
policy, trademark policy, and provenance.

## Clean-room policy (papers-only for copyleft)

- **Permissive sources (MIT/BSD/similar): port freely.** Every ported file gets a ledger entry below
  and a header comment naming origin + license.
- **Copyleft sources (GPL/LGPL/AGPL): NEVER open the source.** Not "read for understanding" — never
  open. Algorithms from copyleft projects are reimplemented from published papers only. If you catch
  yourself with copyleft source in context, stop, note it in the incident log, and hand the
  implementation to a fresh context that has not seen it.

## Trademark policy — binds HARDEST for FM

The canonical FM sounds are inseparable from protected names — DX7, DX100, TX81Z, and the FM lineage
from Yamaha. **The marks of famous synthesizers may not be used in preset names, public API surface,
demo labels, product claims, or marketing copy that implies emulation, compatibility, endorsement,
or origin.** This includes but is not limited to Yamaha, DX7, DX100, TX81Z, DX9, and the "FM" brand
lineage as used by Yamaha.

Factual nominative references are permitted in the README's clearly identified historical/educational
section when they explain synthesis history or identify a sourced recording fact (the owner wants the
history — amendment 1.4.0 in the subtractive sibling). They must not name this product, a preset, or
a feature; suggest that a manufacturer is connected to the project; or claim that this engine
reproduces a specific circuit. Internal design documents may continue to name hardware when
discussing prior art (e.g. Chowning's original FM, the DX series).

**Describe our sounds, never brand them.** `e-piano-fm`, `bell`, `breathy-brass`, not a machine name.

**The patents are not the concern.** John Chowning's FM synthesis patent (filed 1974, granted 1979,
assigned to Stanford, licensed to Yamaha) has long expired; the mathematics is public domain.
Trademark is the live risk.

## Approved reference sources (papers and books — reimplementation, not porting)

| Source | License / status | What we may take |
|---|---|---|
| Chowning, "The Synthesis of Complex Audio Spectra by Means of Frequency Modulation" (Journal of the Audio Engineering Society, 1973) | Published paper | The FM equation: sidebands at *f_c ± k·f_m* with Bessel amplitudes *J_k(I)*. The primary reference |
| Chowning & Bristow, *FM Theory & Applications* (Yamaha, 1986) | Published book | Operator/algorithm theory, ratio conventions, envelope design. Papers-and-book, not source |
| Bessel functions of the first kind | Public mathematics | The closed-form amplitude of each FM sideband |
| Smith, *Physical Audio Signal Processing* (CCRMA, online) | Published | General DSP background |
| Välimäki & Huovilainen, BLIT/BLEP oscillator literature | Published papers | PolyBLEP and related band-limited step corrections (transfers from the subtractive sibling) |

The plumbing copied from `subtractive-synthesizers.js` (same owner, MIT OR Apache-2.0) is listed in
the port ledger below with its exact source SHA, per the family rule. With the owner's 2026-08-02
decision that no shared engine will ever be extracted, the "clean diff for a later extraction"
purpose of these rows is moot; provenance is recorded for license hygiene.

## Surveyed and NOT adopted

Recorded so these are not re-surveyed every few months.

| Thing | Verdict | Why |
|---|---|---|
| Reference corpora of FM synth multi-samples | **None known usable** (extrapolated from the 2026-07-28 subtractive survey, which found no verified CC0/CC-BY analog corpus) | Hardware FM recordings are calibration spot-checks, never convergence targets. "Royalty-free" is marketing, not a license. Any future use requires a license check first |

## Port ledger

Every ported file: `| path | origin file | origin license | date | PR | notes |`

| path | origin | license | date | PR | notes |
|---|---|---|---|---|---|
| `packages/core/worklet/processor.js` | `subtractive-synthesizers.js` `packages/core/worklet/processor.js` @ `91d64da` (M0 fork) | MIT OR Apache-2.0 (same owner) | 2026-08-02 | M0 | Plumbing host (worklet → WASM handshake). Copied then adapted: class renamed `FmProcessor`, worklet name `fm`, error prefixes changed; read-path logic follows the origin. |
| `packages/core/src/index.js` (createEngine surface) | `subtractive-synthesizers.js` `packages/core/src/index.js` @ `91d64da` (M0 fork) | MIT OR Apache-2.0 (same owner) | 2026-08-02 | M0 | The control plane (lazy/SSR-safe `createEngine`, `wasmUrl`/`workletUrl`/`initialEvents`/offline-render contract) with the shared public API kept identical by design. Error prefixes renamed. |
| `packages/core/scripts/build.mjs` | `subtractive-synthesizers.js` same path @ `91d64da` (M0 fork) | MIT OR Apache-2.0 (same owner) | 2026-08-02 | M0 | Build inlines the worklet as a string and stages README + licences. Renamed wasm output. |
| `scripts/audit/*`, `scripts/gen_parameters.mjs`, `scripts/gen_docs.py`, `scripts/gh-owner.sh`, `.githooks/*`, `.github/*` | `subtractive-synthesizers.js` same paths @ `91d64da` (M0 fork) | MIT OR Apache-2.0 (same owner) | 2026-08-02 | M0 | The agent-discipline harness and CI shape, copied with vocabulary changes only. Contains no audio. |

> M0 copies are from `subtractive-synthesizers.js` @ `91d64da` (HEAD at fork time, 2026-08-02).

## Incident log

_(none)_
