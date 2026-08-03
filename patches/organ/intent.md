# Patch intent: organ

Preset: `organ`
Status: proposed
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A drawbar-style organ tone — sustained, harmonic, and bright. FM can make an organ
with pure stacked harmonics (the ratio 1:2:3 stack is the textbook recipe) and no
filter at all, which is exactly the kind of thing FM is good at and subtractive is not.

## In words

Sustained and reedy, with the harmonic clarity of a drawbar organ. The modulator stack
at integer ratios (1:2:3) fills in the odd harmonics that make an organ sound like an
organ. No decay to speak of — it holds as long as the key is held.

## The one committed target

The reedy clarity. If forced to choose between "smooth enough to be a generic pad" and
"unmistakably a drawbar organ", choose the reed. **A version of this patch that offends
nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | Sustained amplitude stays within 3 dB of its peak for the first 2 s | "it holds as long as the key is held" |
| 2 | Partials present at 2× and 3× the fundamental at MIDI 60 | "the ratio 1:2:3 stack" |
| 3 | Spectral centroid at MIDI 60 > 1 kHz | "bright" |
| 4 | Reverb mix < 0.2 | a drawbar organ is a close-mic'd instrument |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

The 1:2:3 integer stack is textbook FM organ design — pure harmonics, no inharmonic
content, which is precisely what a drawbar organ needs.
