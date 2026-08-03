# Patch intent: piano-fm

Preset: `piano-fm`
Status: implemented
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A struck-keyboard tone — distinct from `e-piano-fm` by being more percussive and less
glassy. The FM piano-ish sound: a sharp attack transient over a decaying body.

## In words

Percussive and woody, with a clear struck attack and a fast decay to a thin body. Less
metallic than the e-piano — the ratio stack is tuned for attack transient rather than
sustained ring. Good for comping and rhythmic playing.

## The one committed target

The struck transient. If forced to choose between "glassy enough to be an electric
piano" and "percussive enough to read as a struck key", choose the strike. **A version
of this patch that offends nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | Attack reaches 90 % of peak within 3 ms | "sharp struck attack" |
| 2 | Amplitude decays to −60 dB within 1.0 s | "a fast decay to a thin body" |
| 3 | Spectral centroid falls by ≥ 1.5× from the first 50 ms to 400 ms | "attack transient rather than sustained ring" |
| 4 | Reverb mix < 0.25 | a comping keyboard sits dry |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

The two-centroid targets (3) distinguish this from the glassy e-piano: the character
is in the transient falling away, not in a sustained ring.
