# Patch intent: strings

Preset: `strings`
Status: proposed
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A sustained string-section pad. FM's approach — stacked pairs with slight detune — gives
the ensemble shimmer without samples. A different animal from `fb-pad` (no feedback,
more conventional harmony).

## In words

Warm, sustained, and slightly wide. Two stacked pairs (a 1:1 pair and a 1:2 pair)
create a richer spectrum than a single pair; a slow attack and long release make it a
pad. The whole point is that it holds and breathes.

## The one committed target

The ensemble warmth. If forced to choose between "smooth enough to be a generic pad"
and "unmistakably a string section", choose the strings. **A version of this patch that
offends nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | Time-to-peak amplitude ≥ 100 ms | "slow attack" |
| 2 | After a 0.3 s note-on, the tail remains ≥ −30 dB at 0.8 s after release | "long release" |
| 3 | Sustained amplitude stays within 3 dB of its peak for 2 s | "it holds and breathes" |
| 4 | Energy above 1 kHz < 40 % at MIDI 55 | "warm" |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

The stacked-pair warm pad is the FM answer to a string machine; the 1:1 + 1:2 pairing
is a textbook ensemble recipe.
