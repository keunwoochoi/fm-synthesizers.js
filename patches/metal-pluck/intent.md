# Patch intent: metal-pluck

Preset: `metal-pluck`
Status: proposed
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A short, metallic pluck — percussive, inharmonic, gone in under half a second. FM's
inharmonic ratios (like 1.414) give the "metal" quality that a harmonic stack cannot.

## In words

Short and metallic. The attack is instant, the decay fast, no sustain. A high ratio
modulator (1.4–1.5) puts the first sideband at a non-harmonic position, which is the
metal. Bright enough to cut through a mix without a filter.

## The one committed target

The metallic ping. If forced to choose between "warm enough to be a generic pluck" and
"unmistakably struck metal", choose the metal. **A version of this patch that offends
nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | Amplitude decays to −60 dB within 400 ms | "gone in under half a second" |
| 2 | At least 2 partials whose frequencies are NOT integer multiples of the fundamental | "inharmonic ratios" |
| 3 | At MIDI 60, spectral centroid > 1.5 kHz | "bright enough to cut through a mix" |
| 4 | Attack reaches 90 % of peak within 5 ms | "the attack is instant" |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

The inharmonic-ratio target is the whole point of FM for percussive tones: no harmonic
oscillator stack can place a partial at 1.414× the fundamental.
