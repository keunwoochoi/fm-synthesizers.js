# Patch intent: glass-bell

Preset: `glass-bell`
Status: implemented
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A glassy, sustained bell tone — the "bell that keeps ringing" FM signature, distinct
from the struck bell by its longer body and cleaner partials. For held notes and slow
passages.

## In words

Glassy and clean, with a slow attack and a very long tail. Inharmonic partials that
ring against each other — the beating is the sound. Softer and rounder than the struck
bell; it glows rather than clangs.

## The one committed target

The glassy ring. If forced to choose between "round enough to be a generic pad" and
"unmistakably a ringing glass bell", choose the ring. **A version of this patch that
offends nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | Time-to-peak amplitude ≥ 40 ms | "a slow attack" |
| 2 | After a 0.2 s note-on, the tail remains ≥ −30 dB at 1.0 s after release | "a very long tail" |
| 3 | At least 3 partials that are NOT integer multiples of the fundamental | "inharmonic partials that ring" |
| 4 | Spectral centroid > 1 kHz at MIDI 60 | "glassy" |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

The distinction from the struck `bell` patch is the envelope: this one attacks slowly
and holds, where the bell is a transient. Both are inharmonic; the curation difference
is the shape.
