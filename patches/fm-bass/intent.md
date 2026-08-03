# Patch intent: fm-bass

Preset: `fm-bass`
Status: proposed
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A bass voice for basslines and low-end pads. FM basses are rounder and more
fundamental-forward than subtractive ones — the technique's strength is a clean, solid
low end with a controllable bite on the attack.

## In words

Round and solid, sitting under everything without being dull. A short index attack adds
a percussive click that cuts through a mix, then settles to a pure-ish sine body. No
upper-harmonic fizz — the modulator is at a low ratio so the sidebands stay near the
fundamental.

## The one committed target

The solid low end. If forced to choose between "bright enough to have character" and
"round enough to carry a bassline", choose round. **A version of this patch that
offends nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | At MIDI 36, ≥ 70 % of energy sits between 40–120 Hz | "sitting under everything" |
| 2 | Amplitude decays to −60 dB within 500 ms after the attack | "a percussive click that cuts through" |
| 3 | Spectral centroid rises ≥ 1.3× from velocity 40 → 110 | velocity → index brightness |
| 4 | At MIDI 36, the peak partial stays within 3 cents of 65.4 Hz | "solid low end" |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

The low-ratio modulator (0.5 or 1.0) is what keeps FM bass round: the first sidebands
land just above the fundamental instead of filling the upper register.
