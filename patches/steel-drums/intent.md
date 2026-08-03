# Patch intent: steel-drums

Preset: `steel-drums`
Status: proposed
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A steel-drum / pan tone — bright, inharmonic, percussive. FM's inharmonic ratios are
the only practical way to get the pan's non-harmonic partials; a harmonic stack cannot
place a partial at a non-integer multiple of the fundamental.

## In words

Bright and ringing, with a metallic body. Inharmonic partials give it the pan's
characteristic "ping"; a medium decay lets it ring just long enough. Festive, sharp,
and unmistakable.

## The one committed target

The metallic ping. If forced to choose between "smooth enough to be a generic pluck"
and "unmistakably a steel pan", choose the pan. **A version of this patch that offends
nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | At least 2 partials that are NOT integer multiples of the fundamental | "inharmonic partials" |
| 2 | Amplitude decays to −60 dB within 1.0 s | "a medium decay" |
| 3 | Spectral centroid at MIDI 60 > 2 kHz | "bright" |
| 4 | Reverb mix < 0.2 | a pan is a struck object, not a pad |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

Inharmonic ratios (e.g. 1.5 or 2.5 on the modulator) are the textbook FM recipe for
metallic struck tones.
