# Patch intent: sub-bass

Preset: `sub-bass`
Status: implemented
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A nearly pure sine bass — the sub-bass that underpins a track. FM's cleanest output:
a low carrier with almost no index, felt more than heard. Distinct from `fm-bass` by
having almost no upper content at all.

## In words

Pure and low, almost a sine wave. The index is minimal so there are few sidebands; the
fundamental does all the work. It should sit under a mix without poking out and be felt
in the chest.

## The one committed target

The pure low end. If forced to choose between "round enough to have character" and
"clean enough to be a pure sine", choose the clean. **A version of this patch that
offends nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | At MIDI 36, ≥ 80 % of energy sits between 40–100 Hz | "felt in the chest" |
| 2 | Energy above 2× the fundamental < 15 % at MIDI 36 | "almost a sine wave" |
| 3 | Amplitude decays to −60 dB within 400 ms | short, percussive low end |
| 4 | Reverb mix < 0.1 | a sub-bass must not smear into the mix |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

This is the extreme end of the "FM can be clean" spectrum: near-zero index, pure
carrier, nothing else. It earns its place by being the bass that holds a track together.
