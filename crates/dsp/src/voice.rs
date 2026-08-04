//! One FM voice: a fixed set of operators in a curated algorithm.
//!
//! PRINCIPLES: the signal path is fixed and curated, not a modular environment. What
//! varies is the patch -- which algorithm, which ratios, which indices, which envelopes.
//! The classic FM signatures (electric-piano-ish, bell, breathy brass) are known
//! combinations of those, and this module is the machine that produces them.

use crate::filter::{HalfBand, HalfBandFinal};
use crate::op::Operator;

/// Four operators cover the classic 2-op and 4-op signatures. The roster needs no more.
pub const MAX_OPS: usize = 4;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Algorithm {
    /// Carrier + 1 modulator. The classic 2-op FM signature.
    Mod1,
    /// Carrier + 2 parallel modulators. Brass and rich plucks.
    Mod2,
    /// Two stacked modulator->carrier pairs summed. The e-piano-ish 4-op stack.
    Stack2,
    /// The first modulator modulates itself (feedback), then the carrier.
    Feedback,
}

impl Algorithm {
    pub fn from_u32(v: u32) -> Self {
        match v {
            1 => Algorithm::Mod2,
            2 => Algorithm::Stack2,
            3 => Algorithm::Feedback,
            _ => Algorithm::Mod1,
        }
    }
}

#[derive(Clone, Copy)]
pub struct Patch {
    pub algorithm: Algorithm,
    /// The headline FM control: scales how hard modulators drive carriers. Velocity
    /// opens it further via `vel_to_index`.
    pub index: f32,
    pub feedback: f32,
    pub vel_to_index: f32,
    /// Per-operator: ratio to the note pitch, output level, and ADSR.
    pub ratio: [f32; MAX_OPS],
    pub level: [f32; MAX_OPS],
    pub adsr: [(f32, f32, f32, f32); MAX_OPS],
}

impl Patch {
    /// A usable default: the classic e-piano-ish ratio set, so the first note anyone
    /// plays is recognisable rather than a mistake.
    pub const fn init() -> Self {
        Patch {
            algorithm: Algorithm::Mod1,
            index: 0.5,
            feedback: 0.0,
            vel_to_index: 0.3,
            ratio: [1.0, 2.0, 3.0, 4.0],
            level: [0.7, 0.6, 0.5, 0.5],
            adsr: [
                (0.005, 0.30, 0.50, 0.20),
                (0.005, 0.30, 0.50, 0.20),
                (0.005, 0.30, 0.50, 0.20),
                (0.005, 0.30, 0.50, 0.20),
            ],
        }
    }
}

#[derive(Clone, Copy)]
pub struct Voice {
    /// MIDI pitch, continuous. A whole number is the MIDI note of the same value; the
    /// fraction is the part of a semitone above it, so 60.5 is a quarter-tone above
    /// middle C. `midi_to_hz` has always taken an f32 -- what was integer was the
    /// boundary this value arrives through, never the arithmetic below it.
    pub pitch: f32,
    /// What the caller calls this voice. Independent of `pitch`, which is what lets two
    /// voices hold the same nominal key at different tunings, and what lets a sounding
    /// voice be referred to in order to change its pitch.
    pub id: u32,
    pub active: bool,
    pub age: u32,
    ops: [Operator; MAX_OPS],
    /// Decimators for the 4x-oversampled path (4x -> 2x, then 2x -> 1x). The FIRST
    /// stage uses the cheap 23-tap; the FINAL stage is the sharper 127-tap, because the
    /// final 2x->1x decimation is where a strong sideband just above 24 kHz folds back
    /// into the audible band (measured: -21.6 dB at 23012 Hz for a ratio-7 patch at
    /// full index; the 127-tap attenuates the folded source by -23 dB vs -8 dB).
    pub hb: [HalfBand; 1],
    pub hb_final: HalfBandFinal,
    /// The previous output sample of the feedback operator, for self-modulation.
    fb_last: f32,
    f0: f32,
    vel: f32,
    /// Per-voice drift: a slow bounded random walk in cents, so a chord breathes
    /// instead of phase-locking. FM operators lock even more readily than a VCO
    /// bank, so this matters more here, not less.
    drift_cents: f32,
    drift_target: f32,
    drift_seed: u32,
    /// Per-voice envelope-time jitter: a fixed per-note offset applied to operator
    /// envelope times, so two voices of the same patch do not attack in lockstep.
    env_jitter: f32,
}

impl Voice {
    pub const fn new() -> Self {
        Voice {
            pitch: 0.0,
            id: 0,
            active: false,
            age: 0,
            ops: [Operator::new(); MAX_OPS],
            hb: [HalfBand::new(); 1],
            hb_final: HalfBandFinal::new(),
            fb_last: 0.0,
            f0: 440.0,
            vel: 1.0,
            drift_cents: 0.0,
            drift_target: 0.0,
            drift_seed: 1,
            env_jitter: 0.0,
        }
    }

    pub fn start(&mut self, pitch: f32, vel: f32, id: u32, patch: &Patch, sr: f32, seed: u32) {
        self.pitch = pitch;
        self.id = id;
        self.active = true;
        self.age = 0;
        self.vel = vel.clamp(0.0, 1.0);
        self.f0 = midi_to_hz(pitch);
        self.hb[0].reset();
        self.hb_final.reset();

        // Per-voice character, seeded from the engine so no two voices share a drift
        // path. Bounded: drift stays inside ~+-4 cents, the walk target re-rolls within
        // it, and envelope times jitter by a fixed +-4% per voice.
        // `pitch as u32` truncates, so the drift path a voice draws is the same for every
        // pitch inside a semitone. Deliberate, and it is also what keeps this bit-identical
        // to the u8 version for whole-numbered pitches: a float-to-int cast in Rust
        // saturates rather than wrapping, so a negative or huge pitch lands on 0 or u32::MAX
        // instead of being undefined. Seeding from the fraction as well would give every
        // microtonal degree its own drift path, which is not obviously better and is not
        // free -- it would change the sound of every existing note.
        let mut s = seed.wrapping_mul(2654435761).wrapping_add(pitch as u32);
        s ^= s << 13; s ^= s >> 17; s ^= s << 5;
        self.drift_seed = s;
        self.drift_cents = (s as f32 / u32::MAX as f32 - 0.5) * 4.0;
        self.drift_target = self.drift_cents;
        s ^= s << 13; s ^= s >> 17; s ^= s << 5;
        self.env_jitter = (s as f32 / u32::MAX as f32 - 0.5) * 0.04;

        for i in 0..MAX_OPS {
            // Random start phases: operators that begin aligned add into one loud
            // transient and then comb-filter each other.
            s ^= s << 13; s ^= s >> 17; s ^= s << 5;
            self.ops[i].set_phase(s as f32 / u32::MAX as f32);
            let (a, d, ss, r) = patch.adsr[i];
            let j = 1.0 + self.env_jitter;
            self.ops[i].env.set(a * j, d * j, ss, r * j, sr);
            self.ops[i].env.gate_on();
        }
        self.fb_last = 0.0;

        self.update_freqs(patch, sr);
    }

    /// Advance the drift random walk. Called once per voice tick, and each tick is one
    /// of the four 4x-rate samples per output sample -- so at 48 kHz this fires 192 kHz,
    /// and a re-roll chance of 1/48000 retargets the walk about every 0.25 s. A chord of
    /// N voices then has N independent bounded walks instead of one shared pitch wobble.
    #[inline]
    fn step_drift(&mut self) {
        self.drift_seed = self.drift_seed.wrapping_mul(1664525).wrapping_add(1013904223);
        let dice = self.drift_seed as f32 / u32::MAX as f32;
        if dice < 1.0 / 48_000.0 {
            // Hash again so the target is a full-range draw, not the truncated top of
            // the same seed. The first version used (seed >> 8), which caps the draw at
            // ~0.0625 and biases every target toward the negative edge of the bound.
            self.drift_seed = self.drift_seed.wrapping_mul(1664525).wrapping_add(1013904223);
            self.drift_target = (self.drift_seed as f32 / u32::MAX as f32 - 0.5) * 8.0;
        }
        self.drift_cents += (self.drift_target - self.drift_cents) * 0.0001;
    }

    fn update_freqs(&mut self, patch: &Patch, sr: f32) {
        self.step_drift();
        let drift = cents(self.drift_cents);
        for i in 0..MAX_OPS {
            self.ops[i].set_freq(self.f0 * patch.ratio[i] * drift, sr);
        }
    }

    /// Move a sounding voice to a new pitch, disturbing nothing else.
    ///
    /// Only `f0` changes. `update_freqs` recomputes every operator from it once per block,
    /// so ratios and per-voice drift follow the new pitch by themselves — the stack stays
    /// in tune with its carrier instead of detuning. Envelopes are not touched, so nothing
    /// re-attacks; phases are not reset, so there is no click.
    ///
    /// Applied instantly, with no glide. That is right for a discrete retune — a scale
    /// change, or an MTS single-note tuning message — and it will zipper under a
    /// continuously-swept bend. Smoothing is deliberately not invented here; it needs a
    /// ramp time nobody has chosen, and choosing one silently is the failure mode the
    /// constitution names.
    pub fn set_pitch(&mut self, pitch: f32) {
        self.pitch = pitch;
        self.f0 = midi_to_hz(pitch);
    }

    pub fn release(&mut self) {
        for i in 0..MAX_OPS {
            self.ops[i].env.gate_off();
        }
    }

    /// Decimate four 4x-rate samples down to one 1x-rate sample, via two half-band
    /// stages (4x -> 2x with the cheap 23-tap, 2x -> 1x with the sharper 127-tap).
    /// Each stage removes the upper octave of its input.
    #[inline]
    pub fn decimate4(&mut self, a: f32, b: f32, c: f32, d: f32) -> f32 {
        let ab = self.hb[0].decimate(a, b);
        let cd = self.hb[0].decimate(c, d);
        self.hb_final.decimate(ab, cd)
    }

    /// Render one output sample at the OVER- (or under-) sampled rate.
    ///
    /// `sr` here is the rate the voice is actually running at (2x when oversampled).
    /// The index an operator drives downstream with is `level * env`; the carrier's
    /// own output is amplitude, not phase deviation, so it does not feed back.
    #[inline]
    pub fn tick(&mut self, patch: &Patch, sr: f32) -> f32 {
        if !self.active {
            return 0.0;
        }
        self.update_freqs(patch, sr);

        let idx = patch.index * (1.0 + patch.vel_to_index * (self.vel * 2.0 - 1.0));
        let out = match patch.algorithm {
            Algorithm::Mod1 => {
                // op1 modulates op2; op2 is the carrier.
                let mod_out = self.ops[0].tick(0.0) * patch.level[0] * idx;
                self.ops[1].tick(mod_out) * patch.level[1]
            }
            Algorithm::Mod2 => {
                // op1 and op3 both modulate op2, summed; op2 is the carrier.
                let m1 = self.ops[0].tick(0.0) * patch.level[0] * idx;
                let m2 = self.ops[2].tick(0.0) * patch.level[2] * idx;
                self.ops[1].tick(m1 + m2) * patch.level[1]
            }
            Algorithm::Stack2 => {
                // op1 -> op2 and op3 -> op4, the two carriers summed.
                let m1 = self.ops[0].tick(0.0) * patch.level[0] * idx;
                let c1 = self.ops[1].tick(m1) * patch.level[1];
                let m2 = self.ops[2].tick(0.0) * patch.level[2] * idx;
                let c2 = self.ops[3].tick(m2) * patch.level[3];
                c1 + c2
            }
            Algorithm::Feedback => {
                // op1 modulates ITSELF (its own previous output), then op2. The
                // self-modulation is the classic feedback FM character, and the
                // stability risk the verification doc warns about.
                let fb = self.fb_last * patch.feedback;
                let m1 = self.ops[0].tick(fb) * patch.level[0] * idx;
                self.fb_last = m1;
                self.ops[1].tick(m1) * patch.level[1]
            }
        };

        if self.ops.iter().all(|o| o.env.is_idle()) {
            // Done only when EVERY operator has released to silence. With per-operator
            // envelopes, one operator ringing while others are idle is a real sound (a
            // bell's modulator outlasting its carrier is the tail).
            self.active = false;
        }
        self.age = self.age.saturating_add(1);
        out * 0.5
    }
}

#[inline]
pub fn midi_to_hz(n: f32) -> f32 {
    440.0 * ((n - 69.0) / 12.0).exp2()
}

#[inline]
fn cents(c: f32) -> f32 {
    (c / 1200.0).exp2()
}

/// Master limiter: value- and slope-continuous at the knee, so it never introduces a
/// discontinuity of its own. Degradation is acceptable; corruption is not.
#[inline]
pub fn soft_clip(x: f32) -> f32 {
    const KNEE: f32 = 0.7;
    if x.abs() <= KNEE {
        x
    } else {
        let s = x.signum();
        let over = x.abs() - KNEE;
        s * (KNEE + (1.0 - KNEE) * crate::filter::tanh_fast(over / (1.0 - KNEE)))
    }
}
