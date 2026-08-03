# Patch intent: calliope

Preset: `calliope`
Status: proposed
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A pure, whistling lead — the "steam calliope" FM tone that sits on top of everything.
FM's clean sine-based spectrum makes this trivial, where a subtractive saw would need
heavy filtering.

## In words

Pure and piercing, almost a sine with a hint of warmth. A low index keeps the spectrum
thin so it cuts through without harshness. Slow vibrato makes it human; fast attack
makes it a lead.

## The one committed target

The piercing purity. If forced to choose between "warm enough to be a generic lead" and
"unmistakably a pure whistle", choose the purity. **A version of this patch that
offends nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | Energy above 2× the fundamental < 30 % of total at MIDI 60 | "almost a sine" |
| 2 | Spectral centroid at MIDI 60 < 2 kHz | "pure" |
| 3 | Amplitude decays to −60 dB within 300 ms of release | "fast attack" |
| 4 | Reverb mix < 0.2 | a whistle is a dry instrument |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

A near-sine FM lead is the counterexample to "FM is always metallic": a low index on a
1:1 pair gives pure harmonics that read as a whistle, not a bell.
