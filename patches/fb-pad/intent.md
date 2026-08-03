# Patch intent: fb-pad

Preset: `fb-pad`
Status: proposed
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

A feedback-FM pad — the unstable, vocal, living sound that only a self-modulating
operator produces. For slow chords and held notes that need to move on their own.

## In words

Slow, unstable, and vocal. The feedback operator adds a wobbling, almost formant-like
character that no static stack can reproduce. Long attack, long release, chorused and
reverberant. It should sound alive, not synthetic-clean.

## The one committed target

The unstable life. If forced to choose between "stable enough to be a clean pad" and
"unmistakably feedback FM", choose the instability — bounded, but unmistakable. **A
version of this patch that offends nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | Time-to-peak amplitude ≥ 250 ms | "long attack" |
| 2 | Envelope coefficient of variation > 0.1 (the level moves) | "unstable, vocal, alive" |
| 3 | After a 0.3 s note-on, the tail remains ≥ −30 dB at 0.8 s after release | "long release" |
| 4 | Spectral centroid at MIDI 55 < 2.5 kHz | "slow ... and vocal" |
| 5 | Alias energy meets the Tier-1 gate AND no NaN at feedback max (sustained) | the stability + alias case for feedback FM |

## Notes

Target 5 is the reason feedback FM ships at all: it is the one algorithm with a real
stability failure mode, and the intent says up front that the stability probe is part of
the patch's definition, not an afterthought.
