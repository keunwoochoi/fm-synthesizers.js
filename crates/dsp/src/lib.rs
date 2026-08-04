//! fm-synthesizers.js DSP core.
//!
//! One engine, rendered inside a single AudioWorklet, allocation-free after init.
//! The public boundary is a hand-rolled C ABI -- no wasm-bindgen on the hot path.
//!
//! PRINCIPLES: the audio thread is sacred. Nothing below allocates, locks, or calls
//! into JS once `engine_new` has returned.

#![deny(unsafe_op_in_unsafe_fn)]

pub mod filter;
pub mod fx;
pub mod op;
pub mod voice;

use fx::{Chorus, Delay, Reverb};
use voice::{Algorithm, Patch, Voice};

pub const MAX_BLOCK: usize = 128;
pub const MAX_VOICES: usize = 16;

/// WASM has no hardware flush-to-zero, and denormals in a recursive filter are the
/// single largest performance cliff in browser audio. Every recursive state variable
/// passes through this once per sample.
#[inline(always)]
pub fn flush_denormal(x: f32) -> f32 {
    if x.abs() < 1e-20 {
        0.0
    } else {
        x
    }
}

pub struct Engine {
    sr: f32,
    voices: [Voice; MAX_VOICES],
    patch: Patch,
    seed: u32,
    gain: f32,
    out_l: [f32; MAX_BLOCK],
    out_r: [f32; MAX_BLOCK],
    /// Measurement-only FM pair. Persistent because phase MUST be continuous across
    /// blocks: a probe that restarts every 128 samples manufactures a discontinuity at
    /// each boundary, and the alias metric would then be measuring the harness rather
    /// than the oscillator.
    probe: [op::Operator; 2],
    probe_fc: f32,
    probe_ratio: f32,
    probe_index: f32,
    probe_hb: [filter::HalfBand; 1],
    probe_hb_final: filter::HalfBandFinal,
    probe_os: bool,
    chorus: Chorus,
    chorus_rate: f32,
    chorus_depth: f32,
    chorus_mix: f32,
    delay: Delay,
    delay_time: f32,
    delay_fb: f32,
    delay_tone: f32,
    delay_mix: f32,
    reverb: Reverb,
    rev_size: f32,
    rev_damp: f32,
    rev_predelay: f32,
    rev_mix: f32,
}

impl Engine {
    pub fn new(sample_rate: f32) -> Self {
        let sr = if sample_rate > 0.0 { sample_rate } else { 48_000.0 };
        Engine {
            sr,
            voices: [Voice::new(); MAX_VOICES],
            patch: Patch::init(),
            seed: 0x2545_F491,
            gain: 0.32,
            out_l: [0.0; MAX_BLOCK],
            out_r: [0.0; MAX_BLOCK],
            probe: [op::Operator::new(); 2],
            probe_fc: -1.0,
            probe_ratio: 1.0,
            probe_index: 0.5,
            probe_hb: [filter::HalfBand::new(); 1],
            probe_hb_final: filter::HalfBandFinal::new(),
            probe_os: true,
            chorus: Chorus::new(),
            chorus_rate: 0.6,
            chorus_depth: 3.0,
            chorus_mix: 0.0,
            delay: Delay::new(sr),
            delay_time: 0.25,
            delay_fb: 0.35,
            delay_tone: 3200.0,
            delay_mix: 0.0,
            reverb: Reverb::new(sr),
            rev_size: 0.6,
            rev_damp: 4200.0,
            rev_predelay: 18.0,
            rev_mix: 0.0,
        }
    }

    /// Start or retrigger the voice named `id`.
    ///
    /// A voice's name is now separate from its pitch. That separation is the whole point:
    /// while they were the same value, two voices could not hold the same nominal key at
    /// different tunings (the ordinary case under MPE, and under any scale with more
    /// degrees than the controller has keys), and a sounding voice could not be referred
    /// to except by the pitch one wanted to change.
    pub fn note_on(&mut self, pitch: f32, vel: f32, id: u32) {
        // Retrigger the voice with this id rather than stacking two.
        if let Some(i) = self.voices.iter().position(|v| v.active && v.id == id) {
            self.seed = self.seed.wrapping_mul(1664525).wrapping_add(1013904223);
            self.voices[i].start(pitch, vel, id, &self.patch, self.sr, self.seed);
            return;
        }
        let idx = self
            .voices
            .iter()
            .position(|v| !v.active)
            // Steal the oldest. Degradation is acceptable; corruption is not.
            .unwrap_or_else(|| {
                let mut oldest = 0;
                for i in 1..MAX_VOICES {
                    if self.voices[i].age > self.voices[oldest].age {
                        oldest = i;
                    }
                }
                oldest
            });
        self.seed = self.seed.wrapping_mul(1664525).wrapping_add(1013904223);
        self.voices[idx].start(pitch, vel, id, &self.patch, self.sr, self.seed);
    }

    /// Release the voice named `id`. An id that names nothing sounding is a no-op.
    pub fn note_off(&mut self, id: u32) {
        for v in self.voices.iter_mut() {
            if v.active && v.id == id {
                v.release();
            }
        }
    }

    pub fn all_off(&mut self) {
        for v in self.voices.iter_mut() {
            v.release();
        }
    }

    fn sync_delay(&mut self) {
        self.delay.set(self.delay_time, self.delay_fb, self.delay_tone, self.delay_mix, self.sr);
    }

    fn sync_reverb(&mut self) {
        self.reverb.set(self.rev_size, self.rev_damp, self.rev_mix, self.rev_predelay, self.sr);
    }

    fn sync_chorus(&mut self) {
        self.chorus.set(self.chorus_rate, self.chorus_depth, self.chorus_mix, self.sr);
    }

    pub fn active_voices(&self) -> u32 {
        self.voices.iter().filter(|v| v.active).count() as u32
    }

    pub fn render(&mut self, frames: usize) {
        let n = frames.min(MAX_BLOCK);
        for i in 0..n {
            self.out_l[i] = 0.0;
            self.out_r[i] = 0.0;
        }

        // The voices run at 4x and are decimated here. FM's Bessel sideband series is
        // infinite, so a high index always has content far above Nyquist. Measured on
        // 2026-08-02: at 2x the worst hidden-grid alias was -17 dB (high index, high
        // ratio) -- the half-band's ~50 dB stopband is not enough when the sidebands
        // reach many octaves up. Two half-band stages (4x -> 2x -> 1x) push the worst
        // case past the gate. This is the whole alias strategy -- not optional.
        let sr4 = self.sr * 4.0;
        for v in self.voices.iter_mut() {
            if !v.active {
                continue;
            }
            for i in 0..n {
                let a = v.tick(&self.patch, sr4);
                let b = v.tick(&self.patch, sr4);
                let c = v.tick(&self.patch, sr4);
                let d = v.tick(&self.patch, sr4);
                let y = v.decimate4(a, b, c, d);
                self.out_l[i] += y;
                self.out_r[i] += y;
            }
        }
        // Order is width -> rhythm -> space, the way a hardware send chain is wired:
        // the reverb should hear the repeats, not the other way round.
        if self.chorus.is_active() {
            for i in 0..n {
                let (l, r) = self.chorus.process(self.out_l[i], self.out_r[i]);
                self.out_l[i] = l;
                self.out_r[i] = r;
            }
        }
        if self.delay.is_active() {
            for i in 0..n {
                let (l, r) = self.delay.process(self.out_l[i], self.out_r[i]);
                self.out_l[i] = l;
                self.out_r[i] = r;
            }
        }
        if self.reverb.is_active() {
            for i in 0..n {
                let (l, r) = self.reverb.process(self.out_l[i], self.out_r[i]);
                self.out_l[i] = l;
                self.out_r[i] = r;
            }
        }
        for i in 0..n {
            self.out_l[i] = voice::soft_clip(self.out_l[i] * self.gain);
            self.out_r[i] = voice::soft_clip(self.out_r[i] * self.gain);
        }
    }
}

// ---------------------------------------------------------------------------------
// C ABI. Scalar args on a raw pointer; audio crosses as a pointer into WASM memory.
// Nothing is marshalled, so there is no allocation on any control path.
// ---------------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn engine_new(sample_rate: f32) -> *mut Engine {
    Box::into_raw(Box::new(Engine::new(sample_rate)))
}

/// # Safety
/// `p` must come from `engine_new` and must not be used afterwards.
#[no_mangle]
pub unsafe extern "C" fn engine_free(p: *mut Engine) {
    if !p.is_null() {
        drop(unsafe { Box::from_raw(p) });
    }
}

macro_rules! eng {
    ($p:expr) => {
        match unsafe { $p.as_mut() } {
            Some(e) => e,
            None => return,
        }
    };
}

/// Non-finite pitch is refused rather than clamped.
///
/// This is the one place the "no silent fallbacks" rule has to bend, and it bends toward
/// refusing rather than toward inventing: a NaN reaching `midi_to_hz` makes a NaN `f0`,
/// which makes a NaN phase, which is unrecoverable for the life of the voice and poisons
/// every spectral number measured downstream of it. There is no channel to report on from
/// the audio thread -- no allocation, no locks, no JS -- so the loud half of the rule is
/// enforced one layer up, where `createEngine().noteOn()` throws on a non-finite pitch
/// before anything is posted to the worklet. Here, the note simply does not start.
/// Degradation is acceptable; corruption is not.
fn guard_pitch(pitch: f32) -> Option<f32> {
    if pitch.is_finite() {
        // Deliberate, and narrower than a continuous pitch strictly needs: 0..=127 is the
        // range the u32 boundary already enforced, so every previously-valid call lands on
        // the same number. MIDI 0 is 8.18 Hz and 127 is 12.5 kHz, which brackets anything a
        // scale file will ask for. Widening it later is additive; starting wider would mean
        // this change altered more than the fraction.
        Some(pitch.clamp(0.0, 127.0))
    } else {
        None
    }
}

/// The id a caller gets when it does not supply one: the bit pattern of the clamped pitch.
///
/// The requirement is that a caller who never mentions ids sees exactly the behaviour it
/// saw when the pitch WAS the identity — `note_on(60.0)` twice retriggers one voice,
/// `note_off(60.0)` finds it. A bijection from pitch to id gives that for free, and the
/// float's own bits are the only such mapping that costs nothing and loses nothing.
///
/// The obvious alternative, `pitch as u32`, is not a bijection: it truncates, so 60.5 and
/// 60.7 would collide and retrigger each other. That is wrong in the case this whole
/// sequence exists to serve.
///
/// Negative zero is folded onto zero first. `-0.0 == 0.0` is true for floats but their
/// bits differ, so without this `note_on(-0.0)` and `note_on(0.0)` would be two voices
/// where every other pair of equal pitches is one.
fn derived_id(pitch: f32) -> u32 {
    if pitch == 0.0 { 0.0f32 } else { pitch }.to_bits()
}

/// # Safety
/// `p` must be a live pointer from `engine_new`.
#[no_mangle]
pub unsafe extern "C" fn note_on(p: *mut Engine, pitch: f32, vel: f32) {
    if let Some(pitch) = guard_pitch(pitch) {
        eng!(p).note_on(pitch, vel, derived_id(pitch));
    }
}

/// Start a note under a caller-chosen id. Two notes at the same pitch with different ids
/// sound together; the same id twice retriggers one voice.
///
/// # Safety
/// `p` must be a live pointer from `engine_new`.
#[no_mangle]
pub unsafe extern "C" fn note_on_id(p: *mut Engine, pitch: f32, vel: f32, id: u32) {
    if let Some(pitch) = guard_pitch(pitch) {
        eng!(p).note_on(pitch, vel, id);
    }
}

/// # Safety
/// `p` must be a live pointer from `engine_new`.
#[no_mangle]
pub unsafe extern "C" fn note_off(p: *mut Engine, pitch: f32) {
    if let Some(pitch) = guard_pitch(pitch) {
        eng!(p).note_off(derived_id(pitch));
    }
}

/// Release a note by the id it was started under.
///
/// # Safety
/// `p` must be a live pointer from `engine_new`.
#[no_mangle]
pub unsafe extern "C" fn note_off_id(p: *mut Engine, id: u32) {
    eng!(p).note_off(id);
}

/// # Safety
/// `p` must be a live pointer from `engine_new`.
#[no_mangle]
pub unsafe extern "C" fn all_off(p: *mut Engine) {
    eng!(p).all_off();
}

/// # Safety
/// `p` must be a live pointer from `engine_new`.
#[no_mangle]
pub unsafe extern "C" fn render(p: *mut Engine, frames: u32) {
    eng!(p).render(frames as usize);
}

/// # Safety
/// `p` must be a live pointer from `engine_new`. The returned pointer is valid for
/// `MAX_BLOCK` floats until the next call that grows WASM memory.
#[no_mangle]
pub unsafe extern "C" fn out_ptr(p: *mut Engine) -> *const f32 {
    match unsafe { p.as_ref() } {
        Some(e) => e.out_l.as_ptr(),
        None => core::ptr::null(),
    }
}

/// Right channel. The engine is stereo; `out_ptr` is the left.
///
/// # Safety
/// `p` must be a live pointer from `engine_new`.
#[no_mangle]
pub unsafe extern "C" fn out_ptr_r(p: *mut Engine) -> *const f32 {
    match unsafe { p.as_ref() } {
        Some(e) => e.out_r.as_ptr(),
        None => core::ptr::null(),
    }
}

/// # Safety
/// `p` must be a live pointer from `engine_new`.
#[no_mangle]
pub unsafe extern "C" fn active_voices(p: *mut Engine) -> u32 {
    match unsafe { p.as_ref() } {
        Some(e) => e.active_voices(),
        None => 0,
    }
}

/// Patch parameters, by index. One entry point rather than forty exports keeps the
/// ABI small; the index list is generated into the TS side from one source.
///
/// # Safety
/// `p` must be a live pointer from `engine_new`.
#[no_mangle]
pub unsafe extern "C" fn set_param(p: *mut Engine, id: u32, v: f32) {
    let e = eng!(p);
    match id {
        0 => e.patch.algorithm = Algorithm::from_u32(v as u32),
        1 => e.patch.index = v.clamp(0.0, 2.0),
        2 => e.patch.feedback = v.clamp(0.0, 0.9),
        3 => e.patch.vel_to_index = v.clamp(0.0, 1.0),
        4 => e.gain = v,
        5 => e.patch.ratio[0] = v.max(0.5),
        6 => e.patch.level[0] = v.clamp(0.0, 1.0),
        7 => e.patch.adsr[0].0 = v,
        8 => e.patch.adsr[0].1 = v,
        9 => e.patch.adsr[0].2 = v,
        10 => e.patch.adsr[0].3 = v,
        11 => e.patch.ratio[1] = v.max(0.5),
        12 => e.patch.level[1] = v.clamp(0.0, 1.0),
        13 => e.patch.adsr[1].0 = v,
        14 => e.patch.adsr[1].1 = v,
        15 => e.patch.adsr[1].2 = v,
        16 => e.patch.adsr[1].3 = v,
        17 => e.patch.ratio[2] = v.max(0.5),
        18 => e.patch.level[2] = v.clamp(0.0, 1.0),
        19 => e.patch.adsr[2].0 = v,
        20 => e.patch.adsr[2].1 = v,
        21 => e.patch.adsr[2].2 = v,
        22 => e.patch.adsr[2].3 = v,
        23 => e.patch.ratio[3] = v.max(0.5),
        24 => e.patch.level[3] = v.clamp(0.0, 1.0),
        25 => e.patch.adsr[3].0 = v,
        26 => e.patch.adsr[3].1 = v,
        27 => e.patch.adsr[3].2 = v,
        28 => e.patch.adsr[3].3 = v,
        29 => { let w = e.chorus.is_active(); e.chorus_mix = v; e.sync_chorus();
               if !w && e.chorus.is_active() { e.chorus.reset(); } }
        30 => { e.chorus_rate = v; e.sync_chorus(); }
        31 => { e.chorus_depth = v; e.sync_chorus(); }
        32 => { let w = e.delay.is_active(); e.delay_mix = v; e.sync_delay();
               if !w && e.delay.is_active() { e.delay.reset(); } }
        33 => { e.delay_time = v; e.sync_delay(); }
        34 => { e.delay_fb = v; e.sync_delay(); }
        35 => { e.delay_tone = v; e.sync_delay(); }
        36 => { let w = e.reverb.is_active(); e.rev_mix = v; e.sync_reverb();
               if !w && e.reverb.is_active() { e.reverb.reset(); } }
        37 => { e.rev_size = v; e.sync_reverb(); }
        38 => { e.rev_damp = v; e.sync_reverb(); }
        39 => { e.rev_predelay = v; e.sync_reverb(); }
        _ => {}
    }
}

/// Render one FM pair in isolation, bypassing envelopes, so the verification harness
/// can grade the CARRIER+MODULATOR against the Bessel prototype rather than grading
/// the whole voice and guessing which operator was responsible.
///
/// Sustains: the probe operators use a flat envelope at full level.
///
/// # Safety
/// `p` must be a live pointer from `engine_new`.
#[no_mangle]
pub unsafe extern "C" fn render_osc(p: *mut Engine, hz: f32, ratio: f32, index: f32,
                                    frames: u32) {
    let e = eng!(p);
    let n = (frames as usize).min(MAX_BLOCK);
    // Match the SHIPPED signal path: the probe runs at 4x and decimates, exactly as
    // the voices do. A probe that renders the pair at 1x measures a path no listener
    // ever hears, and the alias gate would then be grading a non-product.
    let rate = if e.probe_os { e.sr * 4.0 } else { e.sr };
    if e.probe_fc != hz || e.probe_ratio != ratio || e.probe_index != index {
        e.probe_fc = hz;
        e.probe_ratio = ratio;
        e.probe_index = index;
        e.probe[0].set_freq(hz * ratio, rate);
        e.probe[1].set_freq(hz, rate);
        // Flat envelopes: the probe sustains at full level so the harness measures the
        // oscillator, not an envelope transient. gate_on from Idle starts an attack;
        // set() + gate_on() with zero times snaps straight to the target.
        for o in e.probe.iter_mut() {
            o.env.set(0.0, 0.0, 1.0, 0.0, rate);
            o.env.gate_on();
        }
    }
    if e.probe_os {
        // Two half-band stages (4x -> 2x -> 1x), exactly the shipped voice path.
        for i in 0..n {
            // Both operators tick at the 4x rate. The modulator's output is the
            // phase-deviation term; the carrier is what gets decimated.
            let m1 = e.probe[0].tick(0.0) * index;
            let a = e.probe[1].tick(m1);
            let m2 = e.probe[0].tick(0.0) * index;
            let b = e.probe[1].tick(m2);
            let m3 = e.probe[0].tick(0.0) * index;
            let c = e.probe[1].tick(m3);
            let m4 = e.probe[0].tick(0.0) * index;
            let d = e.probe[1].tick(m4);
            let ab = e.probe_hb[0].decimate(a, b);
            let cd = e.probe_hb[0].decimate(c, d);
            e.out_l[i] = e.probe_hb_final.decimate(ab, cd);
        }
    } else {
        for i in 0..n {
            let m = e.probe[0].tick(0.0) * index;
            e.out_l[i] = e.probe[1].tick(m);
        }
    }
}

/// Choose whether the probe mirrors the shipped oversampled path (default) or renders
/// the bare FM pair. Both are worth measuring: one is what ships, the other isolates
/// how much of the improvement the oversampler is responsible for.
///
/// # Safety
/// `p` must be a live pointer from `engine_new`.
#[no_mangle]
pub unsafe extern "C" fn probe_oversample(p: *mut Engine, on: u32) {
    let e = eng!(p);
    e.probe_os = on != 0;
    e.probe_fc = -1.0;
    for hb in e.probe_hb.iter_mut() { hb.reset(); };
    e.probe_hb_final.reset();
}

/// Restart the measurement oscillator's phase. Called once before a probe run.
///
/// # Safety
/// `p` must be a live pointer from `engine_new`.
#[no_mangle]
pub unsafe extern "C" fn probe_reset(p: *mut Engine) {
    let e = eng!(p);
    e.probe = [op::Operator::new(); 2];
    e.probe_fc = -1.0;
    for hb in e.probe_hb.iter_mut() { hb.reset(); };
    e.probe_hb_final.reset();
}
