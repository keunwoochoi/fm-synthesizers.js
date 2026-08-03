# Patch intent: pluck-bass

Preset: `pluck-bass`
Status: implemented
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A short, plucked FM bass — percussive and tight, for fast basslines. Distinct from the
rounder `fm-bass` by having an instant attack and no sustain.

## In words

Tight and percussive, with an instant attack and a fast decay to silence. A low ratio
modulator (0.5) adds just enough upper sparkle on the transient to cut through, then
drops to a clean low body. No sustain at all.

## The one committed target

The tight pluck. If forced to choose between "round enough to be a sustained bass" and
"tight enough to play fast sixteenths", choose the tight. **A version of this patch
that offends nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | Amplitude decays to −60 dB within 350 ms | "a fast decay to silence" |
| 2 | Attack reaches 90 % of peak within 3 ms | "instant attack" |
| 3 | At MIDI 36, ≥ 65 % of energy sits between 40–120 Hz | "a clean low body" |
| 4 | Reverb mix < 0.1 | a tight bassline must be dry |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

The 0.5 ratio modulator is the transient sparkle; the near-zero sustain is what makes
it a pluck rather than a bass.
