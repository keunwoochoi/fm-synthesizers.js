# Patch intent: bell

Preset: `bell`
Status: implemented
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A struck bell — inharmonic, percussive, with a long glassy tail. The second most
recognisable FM signature, and the one that proves FM's real advantage: inharmonic
spectra are trivial here and hard everywhere else.

## In words

Inharmonic partials that do not sit on a harmonic grid. A sharp index attack, a fast
decay to a long thin sustain, and a tail that outlasts the note by a full second. Bright
enough to cut, glassy rather than clangy.

## The one committed target

The inharmonic ring. If forced to choose between "warm enough to pass for a vibraphone"
and "unmistakably a struck bell", choose the bell. **A version of this patch that
offends nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | At least 3 partials whose frequencies are NOT integer multiples of the fundamental | "inharmonic partials" |
| 2 | Amplitude decays to −60 dB within 1.2 s at the default envelope | "a fast decay" |
| 3 | With a 0.15 s note-on, the tail remains ≥ −40 dB at 0.5 s after release | "a tail that outlasts the note" |
| 4 | At MIDI 60, spectral centroid > 1.2 kHz | "bright enough to cut" |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

The inharmonic-ratio target (1) is what a subtractive synth structurally cannot do
without a table; an FM bell is the technique showing its hand.
