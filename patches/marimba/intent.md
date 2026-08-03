# Patch intent: marimba

Preset: `marimba`
Status: implemented
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A struck mallet instrument — the classic FM marimba. The 1:4 carrier/modulator ratio is
the textbook recipe for wooden mallet tones, and it is a sound FM does better than
subtractive.

## In words

Wooden and rounded, not metallic. The 1:4 ratio puts a strong partial above the
fundamental that reads as the struck bar; a fast decay drops it to a short body. Dry —
a marimba does not ring into a hall.

## The one committed target

The wooden strike. If forced to choose between "round enough to be a generic mallet"
and "unmistakably a struck wooden bar", choose the wood. **A version of this patch that
offends nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | Amplitude decays to −60 dB within 500 ms | "a fast decay" |
| 2 | At MIDI 60, a partial sits near 4× the fundamental | "the 1:4 ratio" |
| 3 | Attack reaches 90 % of peak within 3 ms | "struck" |
| 4 | Reverb mix < 0.15 | "dry" |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

The 1:4 ratio is the documented FM mallet recipe (carrier at f, modulator at 4f), a
textbook ratio rather than a transcribed factory value.
