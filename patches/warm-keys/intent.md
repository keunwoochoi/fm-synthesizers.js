# Patch intent: warm-keys

Preset: `warm-keys`
Status: proposed
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A warm, soft electric-keyboard-ish tone for chords and pads — the "polite" FM sound, in
contrast to the glassy `e-piano-fm`. Lower index, rounder sidebands, more body.

## In words

Warm and soft, not metallic. A low index keeps the sidebands gentle so the tone reads
as a mellow keyboard rather than a glassy tine. Slow attack, medium decay, some
sustain. Sits comfortably in a chord without poking out.

## The one committed target

The warm body. If forced to choose between "glassy enough to be an electric piano" and
"warm enough to be a soft pad", choose warm. **A version of this patch that offends
nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | Time-to-peak amplitude ≥ 20 ms | "slow attack" |
| 2 | Spectral centroid at MIDI 60 < 1.2 kHz | "warm and soft, not metallic" |
| 3 | Energy above the carrier < 40 % of total at index 1.0 | "gentle sidebands" |
| 4 | Amplitude decays to −60 dB within 1.5 s | "medium decay" |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

This is the curation counterweight to `e-piano-fm`: the same ratio family, voiced for
warmth instead of ring. The bank needs both, and the intent difference is what keeps
them distinct.
