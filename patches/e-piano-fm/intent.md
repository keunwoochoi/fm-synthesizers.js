# Patch intent: e-piano-fm

Preset: `e-piano-fm`
Status: proposed
Provenance: prior
Written: 2026-08-02

## Historical provenance

This intent was written before implementation.

## For

The most recognisable FM signature: an electric-piano-ish tone for chords, stabs, and
ballad pads. Everyone knows the sound without needing the machine named (see
`agentic-docs/licensing.md` — trademarks are the live risk).

## In words

Metallic, glassy, percussive at the attack, with a slow woody decay. Ratio 1:1
(carrier and modulator at the note) with a sharp index attack that rings then decays —
the beating between the carrier and its first sideband is the character. Soft, not
brittle; a pad when held, a stab when played short.

## The one committed target

The glassy ring. If forced to choose between "round and warm enough to be a generic
keyboard" and "unmistakably FM electric piano", choose the FM ring. **A version of this
patch that offends nobody has failed.**

## Measurable targets

| # | Target | From which phrase |
|---|---|---|
| 1 | Amplitude decays to −60 dB within ~1.5 s after the attack at the default envelope | "slow woody decay" |
| 2 | Spectral centroid falls by ≥ 2× from the first 50 ms to 500 ms | "percussive at the attack" |
| 3 | Sidebands present at ratio 1:1, index 1.5: energy above the carrier ≥ 20 % of total | "the beating between the carrier and its first sideband" |
| 4 | At MIDI 60, the peak partial stays within 3 cents of 261.63 Hz | "soft, not brittle" |
| 5 | Alias energy meets the Tier-1 gate with index **and** feedback at maximum | the hardest alias case this patch can produce |

## Notes

Target 5 exists because writing this down forced the question *"what is this patch's
worst alias case?"* before any DSP was written. That is the intent statement doing its
job — FM's alias risk is the whole reason the oversampling strategy exists.
