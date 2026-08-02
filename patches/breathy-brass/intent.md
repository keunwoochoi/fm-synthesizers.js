# Patch intent: breathy-brass

Preset: `breathy-brass`
Status: proposed
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A breathy, brassy tone for held lines and pads — the FM brass signature. Multiple
modulators (a rich harmonic stack) driving a carrier, with a slow attack that swells.

## In words

Warm and breathy, not nasal. The attack is a slow swell — there is air before the note
arrives. Bright enough to carry a lead line, smooth enough to sit in a pad. A slightly
unstable body so a held note breathes instead of freezing.

## The one committed target

The breathy swell. If forced to choose between "clean and smooth like a generic string
pad" and "unmistakably a breathy brass section", choose the breath. **A version of this
patch that offends nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | Time-to-peak amplitude ≥ 150 ms at the default envelope | "a slow swell" |
| 2 | Spectral centroid rises by ≥ 1.3× from velocity 40 → 110 | "bright enough to carry a lead line" |
| 3 | At MIDI 60, partials exist at ratios 1:1, 2:1 AND 3:1 (mod2 algorithm) | "a rich harmonic stack" |
| 4 | Render the same note twice; not bit-identical but within 0.5 % RMS | "a slightly unstable body" |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

Target 4 is the family's analog-character check applied to FM: a breathy body needs
controlled imperfection, and "controlled" is the measurable half.
