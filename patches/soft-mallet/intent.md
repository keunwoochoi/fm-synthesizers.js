# Patch intent: soft-mallet

Preset: `soft-mallet`
Status: proposed
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A soft, rounded mallet — the gentler cousin of `marimba`. For delicate passages where
the wooden strike of the marimba would be too much. Uses the same 1:4 mallet ratio
family but voiced softer.

## In words

Soft and rounded, with a gentle attack and a fast decay. The mallet's upper partial is
present but subdued; the overall tone is warm rather than struck. It should feel like
a felt mallet rather than a wooden one.

## The one committed target

The soft strike. If forced to choose between "round enough to be a generic pluck" and
"unmistakably a felt mallet", choose the softness. **A version of this patch that
offends nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | Amplitude decays to −60 dB within 700 ms | "a fast decay" |
| 2 | Spectral centroid at MIDI 60 < 1.5 kHz | "warm rather than struck" |
| 3 | Energy above 4× the fundamental < 25 % at MIDI 60 | "the upper partial is present but subdued" |
| 4 | Reverb mix < 0.2 | a mallet is a dry instrument |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

The curation pairing with `marimba` is deliberate: same mallet family, opposite end of
the strike. The bank needs both.
