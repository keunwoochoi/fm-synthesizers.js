//! One FM operator: a sine oscillator with its own envelope and output level.
//!
//! FM is operators -> algorithm -> envelopes. An operator is a sine at
//! `ratio * note_hz` (or a fixed frequency), whose phase can be modulated by the
//! outputs of other operators. The product of an operator's envelope and level IS the
//! modulation index it drives the downstream operator with -- FM's "drive".

use crate::flush_denormal;

/// Analog-style ADSR, inherited from the subtractive voice unchanged: exponential
/// approach rather than linear ramps. A linear decay is one of the reliable giveaways
/// that a synth is digital.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Stage {
    Idle,
    Attack,
    Decay,
    Sustain,
    Release,
}

#[derive(Clone, Copy)]
pub struct Adsr {
    stage: Stage,
    level: f32,
    a: f32,
    d: f32,
    s: f32,
    r: f32,
}

impl Adsr {
    pub const fn new() -> Self {
        Adsr { stage: Stage::Idle, level: 0.0, a: 0.0, d: 0.0, s: 0.7, r: 0.0 }
    }

    /// Times in seconds, converted to one-pole coefficients.
    pub fn set(&mut self, a: f32, d: f32, s: f32, r: f32, sr: f32) {
        self.a = 1.0 - (-1.0 / (a.max(0.0005) * sr)).exp();
        self.d = 1.0 - (-1.0 / (d.max(0.0005) * sr)).exp();
        self.s = s.clamp(0.0, 1.0);
        self.r = 1.0 - (-1.0 / (r.max(0.0005) * sr)).exp();
    }

    pub fn gate_on(&mut self) {
        self.stage = Stage::Attack;
    }

    pub fn gate_off(&mut self) {
        if self.stage != Stage::Idle {
            self.stage = Stage::Release;
        }
    }

    pub fn is_idle(&self) -> bool {
        self.stage == Stage::Idle
    }

    #[inline]
    pub fn tick(&mut self) -> f32 {
        match self.stage {
            Stage::Idle => return 0.0,
            Stage::Attack => {
                self.level += (1.2 - self.level) * self.a;
                if self.level >= 1.0 {
                    self.level = 1.0;
                    self.stage = Stage::Decay;
                }
            }
            Stage::Decay => {
                self.level += (self.s - self.level) * self.d;
                if (self.level - self.s).abs() < 1e-4 {
                    self.stage = Stage::Sustain;
                }
            }
            Stage::Sustain => self.level = self.s,
            Stage::Release => {
                self.level -= self.level * self.r;
                if self.level < 1e-4 {
                    self.level = 0.0;
                    self.stage = Stage::Idle;
                }
            }
        }
        self.level = flush_denormal(self.level);
        self.level
    }
}

/// A sine operator. The only waveform FM needs: every FM timbre is ratios of sines.
#[derive(Clone, Copy)]
pub struct Operator {
    phase: f32,
    dt: f32,
    pub env: Adsr,
}

impl Operator {
    pub const fn new() -> Self {
        Operator { phase: 0.0, dt: 0.0, env: Adsr::new() }
    }

    /// Randomise start phase so voices do not phase-lock.
    pub fn set_phase(&mut self, p: f32) {
        self.phase = p.fract().abs();
    }

    /// `freq` in Hz, `sr` in Hz. Clamped below Nyquist.
    #[inline]
    pub fn set_freq(&mut self, hz: f32, sr: f32) {
        self.dt = (hz / sr).clamp(0.0, 0.49);
    }

    /// Render one sample. `phase_in` is the accumulated phase contribution from any
    /// modulating operators (zero for an unmodulated carrier). Returns the product of
    /// the sine and the envelope, so the level controls the modulation index when this
    /// operator drives another one.
    #[inline]
    pub fn tick(&mut self, phase_in: f32) -> f32 {
        let v = (core::f32::consts::TAU * self.phase + phase_in).sin() * self.env.tick();
        self.phase += self.dt;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
        }
        flush_denormal(v)
    }
}
