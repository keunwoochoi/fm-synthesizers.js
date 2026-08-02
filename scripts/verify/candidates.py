"""FM-pair implementations under test. Each returns samples and nothing else.

This module MUST NOT import prototypes or metrics. The thing being graded does not get
to see the answer key or compute its own score. test_verify_spec.py asserts this rather
than trusting it.

One honest implementation (the equation, synthesized directly -- the answer key itself,
so the harness is proven against its own ground truth before any real DSP exists), one
naive negative control, and five cheats. The cheats were written BEFORE any real DSP,
per agentic-docs/design/2026-08-02-verification-and-harness.md: every gate has a
degenerate optimum, and the only way to know a gate measures what you meant is to build
the thing that games it and watch it lose.

Every candidate has the signature fn(fc, ratio, index, sr, n) -> np.ndarray.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np
from scipy.special import jv  # type: ignore

_ROOT = Path(__file__).resolve().parents[2]
_WASM = _ROOT / "target/wasm32-unknown-unknown/release/fm_dsp.wasm"
_RENDER = _ROOT / "scripts/verify/render_wasm.mjs"

# The grid a lazy implementation would notice it is being tested on. Used only by the
# special-cased cheat, to prove the visible/hidden split catches exactly this.
_VISIBLE_HINT = (440.0, 220.0, 880.0, 330.0, 165.0)


def _sine(t: np.ndarray, fc: float, ratio: float, index: float) -> np.ndarray:
    return np.sin(2.0 * np.pi * fc * t + index * np.sin(2.0 * np.pi * ratio * fc * t))


# --- honest implementation -------------------------------------------------------

def honest_fm(fc: float, ratio: float, index: float, sr: float, n: int) -> np.ndarray:
    """The reference equation, synthesized directly: the Bessel series truncated below
    Nyquist. This is perfectly bandlimited by construction -- the alias gate must accept
    it, because it IS the thing the real DSP is trying to be.

        y(t) = Σ_k J_k(I) · sin(2π·(f_c + k·f_m)·t),   f_m = ratio·f_c

    Cost is O(k_max · n) per grid point; k_max is ~10 at the indices this harness uses,
    so the honest stub stays a seconds-scale check rather than a minutes-scale one.
    """
    t = np.arange(n) / sr
    fm = ratio * fc
    y = np.zeros(n)
    # Sum every Bessel order whose frequency lands within Nyquist, including the
    # NEGATIVE orders. A term at fc + k*fm < 0 is not "nothing": sin() is odd, so a
    # negative-frequency sine is a positive-frequency sine with flipped phase -- the
    # folded contribution that makes a rational-ratio FM spectrum coherent rather than
    # a list of independent sidebands. Dropping it is exactly the error that made
    # ratio=0.5 measure wrong (the k=-1 and k=-3 terms both land on fc/2).
    k = -200
    while k <= 200:
        fr = fc + k * fm
        if abs(fr) >= sr / 2.0:
            k += 1
            continue
        a = float(jv(k, index))
        if abs(a) > 1e-9:
            y += a * np.sin(2.0 * np.pi * fr * t)
        k += 1
    return y


def honest_fm_via_phase(fc: float, ratio: float, index: float, sr: float,
                        n: int) -> np.ndarray:
    """The SAME equation, but integrated directly in the phase domain at 1x.

    sin(2π·f_c·t + I·sin(2π·f_m·t)) is the FM definition. Computed at the output rate
    it is NOT bandlimited -- high-order sidebands fold. This is the honest negative
    control: correct as the definition, aliasing as implemented naively. It must pass
    tuning/sideband gates and fail the alias gate, which is exactly the behaviour the
    real oversampled DSP has to beat.
    """
    return _sine(np.arange(n) / sr, fc, ratio, index)


# --- cheats: each must be REJECTED ------------------------------------------------

def cheat_silence(fc: float, ratio: float, index: float, sr: float, n: int) -> np.ndarray:
    """Perfect alias suppression. Perfect stability. No sound."""
    return np.zeros(n)


def cheat_pure_sine(fc: float, ratio: float, index: float, sr: float, n: int) -> np.ndarray:
    """Perfectly bandlimited, perfectly in tune, and has NO sidebands at I > 0.
    This is the cheat that sideband structure exists to catch: a carrier-only oscillator
    has flawless alias numbers and is not FM."""
    return np.sin(2.0 * np.pi * fc * np.arange(n) / sr)


def cheat_brickwall(fc: float, ratio: float, index: float, sr: float, n: int) -> np.ndarray:
    """An FM pair with everything above 4 kHz removed. Kills the upper sidebands and
    the alias together -- the 'blur everything' cheat, in the spectral domain."""
    x = honest_fm(fc, ratio, index, sr, n)
    spec = np.fft.rfft(x)
    spec[np.fft.rfftfreq(n, 1.0 / sr) > 4000.0] = 0.0
    return np.fft.irfft(spec, n)


def cheat_special_cased(fc: float, ratio: float, index: float, sr: float,
                        n: int) -> np.ndarray:
    """Correct on the carriers it expects to be tested at, naive everywhere else.
    Invisible to any fixed grid; caught only by evaluating on a grid it has not seen."""
    if any(abs(fc - v) < 0.5 for v in _VISIBLE_HINT):
        return honest_fm(fc, ratio, index, sr, n)
    return honest_fm_via_phase(fc, ratio, index, sr, n)


def wasm_fm(fc: float, ratio: float, index: float, sr: float, n: int) -> np.ndarray:
    """THE SHIPPED ARTIFACT. Renders through the real Rust->WASM FM engine via node.

    Everything else in this module is scaffolding. This is the candidate whose verdict
    actually means something: a Python reimplementation passing its own gates proves
    nothing about the binary a browser will download.
    """
    if not _WASM.exists():
        raise FileNotFoundError(
            f"{_WASM} not built. Run: cargo build -p fm-dsp "
            f"--target wasm32-unknown-unknown --release")
    out = subprocess.run(
        ["node", str(_RENDER), str(_WASM), str(fc), str(ratio), str(index), str(sr),
         str(n), "1"],
        capture_output=True, check=True)
    return np.frombuffer(out.stdout, dtype="<f4").astype(float)


def wasm_fm_no_oversampling(fc: float, ratio: float, index: float, sr: float,
                            n: int) -> np.ndarray:
    """The same FM pair with the oversampler bypassed, as a control."""
    out = subprocess.run(
        ["node", str(_RENDER), str(_WASM), str(fc), str(ratio), str(index), str(sr),
         str(n), "0"],
        capture_output=True, check=True)
    return np.frombuffer(out.stdout, dtype="<f4").astype(float)


HONEST = {"honest_fm": honest_fm, "wasm_fm": wasm_fm, "wasm_fm_1x": wasm_fm_no_oversampling}
NEGATIVE_CONTROL = {"naive_fm": honest_fm_via_phase}
CHEATS = {
    "cheat_silence": cheat_silence,
    "cheat_pure_sine": cheat_pure_sine,
    "cheat_brickwall": cheat_brickwall,
    "cheat_special_cased": cheat_special_cased,
}
ALL = {**HONEST, **NEGATIVE_CONTROL, **CHEATS}
