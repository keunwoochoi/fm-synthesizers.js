# Patch intent: stack-keys

Preset: `stack-keys`
Status: proposed
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A big, bright, layered keyboard tone from the 4-operator stacked-pairs algorithm — two
carrier/modulator pairs summed, for a thicker voice than the single-pair patches.

## In words

Big and layered. Two harmonic stacks (one at ratio 1:1, one with a higher ratio
modulator) sum into a voice that is wider and brighter than a single pair. Medium
decay, usable for both chords and single-note lines.

## The one committed target

The layered width. If forced to choose between "clean enough to be a single keyboard"
and "unmistakably two stacks", choose the layered. **A version of this patch that
offends nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | Spectral centroid at MIDI 60 > 1.2 kHz | "brighter than a single pair" |
| 2 | Time-to-peak amplitude < 10 ms | "usable for single-note lines" |
| 3 | Amplitude decays to −60 dB within 1.2 s | "medium decay" |
| 4 | Total energy above 1 kHz > 30 % at MIDI 60 | "big and bright" |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

This is the only 4-operator-pair patch in the first roster, so it is also the proof
that the `stack2` algorithm is a distinct sound, not just the two modulators summed.
