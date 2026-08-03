# Patch intent: twang

Preset: `twang`
Status: implemented
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A short nasal stab — the plucked-string-adjacent FM sound. A ratio-2 modulator on a
carrier gives the characteristic sharp, slightly hollow attack.

## In words

Short, nasal, percussive. The ratio-2 sidebands add an upper "twang" that decays fast,
leaving a near-sine body. Gone in a third of a second. Good for fast rhythmic figures.

## The one committed target

The twang. If forced to choose between "smooth enough to be a generic pluck" and
"unmistakably that nasal FM stab", choose the twang. **A version of this patch that
offends nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | Amplitude decays to −60 dB within 300 ms | "gone in a third of a second" |
| 2 | Attack reaches 90 % of peak within 5 ms | "short, percussive" |
| 3 | Spectral centroid at MIDI 60 > 1.5 kHz in the first 50 ms | "the upper twang" |
| 4 | After 200 ms, spectral centroid < 1 kHz | "leaving a near-sine body" |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

The two-centroid targets (3 and 4) capture the whole character: bright attack, sine
body. A patch that holds its brightness has missed the twang.
