# Patch intent: brass-lead

Preset: `brass-lead`
Status: proposed
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A bright, aggressive brass lead — distinct from the `breathy-brass` pad by being
sharper and faster. For single-note lines and stabs.

## In words

Sharp and cutting, with a fast attack. A high index with a 1:1 and 2:1 modulator pair
gives it the brass-like brightness, but the envelope is fast — it speaks immediately
instead of swelling. Less air than the pad, more edge.

## The one committed target

The cutting edge. If forced to choose between "smooth enough to be a breathy pad" and
"sharp enough to lead a line", choose the cut. **A version of this patch that offends
nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | Attack reaches 90 % of peak within 15 ms | "fast attack" |
| 2 | Spectral centroid at MIDI 60 > 1.8 kHz | "sharp and cutting" |
| 3 | Partials present at 2× the fundamental | "the 1:1 and 2:1 modulator pair" |
| 4 | Reverb mix < 0.25 | a lead sits close in the mix |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

The 1:1 + 2:1 modulator pair is the textbook FM brass recipe; the curation difference
from `breathy-brass` is entirely the envelope and the lower air.
