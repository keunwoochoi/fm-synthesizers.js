"""Analytic ground truth. The harness's private reference.

PRINCIPLES: "We do not need a reference recording because we have a reference equation."
An FM pair has an EXACT closed-form spectrum: a carrier at f_c modulated by a modulator
at f_m with index I produces sidebands at f_c ± k·f_m with amplitudes J_k(I) (Bessel
functions of the first kind). That is the reference equation this library is graded
against — no corpus, no microphone, no licence.

CANDIDATES MUST NOT IMPORT THIS MODULE. The thing being graded does not get to see the
answer key. Enforced by test_verify_spec.py, not by convention.
"""

from __future__ import annotations

import numpy as np
from scipy.special import jv  # type: ignore


def fm_sidebands(fc: float, ratio: float, index: float, sr: float,
                 k_max: int = 200) -> tuple[np.ndarray, np.ndarray]:
    """Frequencies and amplitudes of an ideal bandlimited FM pair.

    y(t) = sin(2π·f_c·t + I·sin(2π·f_m·t))
         = Σ_k J_k(I) · sin(2π·(f_c + k·f_m)·t)

    where f_m = ratio · f_c. Only content strictly below Nyquist is real; anything
    measured elsewhere is alias, by definition. Amplitudes are NOT normalised to the
    carrier: |J_0(I)| can be near zero for some I (carrier cancellation), so a
    normalised-to-carrier comparison would divide by noise. The metrics module handles
    normalisation with a floor instead.

    Rational-ratio coherence is handled here, not in the metrics: two Bessel orders
    land on the same frequency when f_c + k·f_m reflects off zero (a negative-frequency
    term sin(2π·(-f)·t) is -sin(2π·f·t)), and they must be SUMMED with sign before the
    magnitude is taken. Returning them as independent sidebands would make the answer
    key disagree with the very equation it is supposed to grade -- the ratio=0.5 case
    measured 5.07 dB of "error" that was really this, on the honest implementation.
    """
    fm = ratio * fc
    k = np.arange(-k_max, k_max + 1)
    freqs = fc + k * fm
    amps = jv(k, index)
    # Fold: each positive frequency is the coherent sum of the direct term (freqs>0)
    # and the reflected term (freqs<0, sign-flipped because sin is odd).
    out: dict[float, complex] = {}
    for f, a in zip(freqs, amps):
        if abs(f) >= sr / 2.0 or abs(a) < 1e-9:
            continue
        sign = 1.0 if f > 0.0 else -1.0
        out[round(abs(f), 6)] = out.get(round(abs(f), 6), 0j) + sign * a
    pos = np.array(sorted(out))
    mag = np.abs(np.array([out[p] for p in pos]))
    keep = (pos > 0.0) & (pos < sr / 2.0) & (mag > 1e-6)
    return pos[keep], mag[keep]


def fm_bandlimit(fc: float, ratio: float, index: float, sr: float) -> int:
    """How many Bessel orders the spectrum actually reaches at this (fc, ratio, I, sr).

    The highest meaningful order is where |J_k(I)| drops below -100 dB; orders above
    that are zero to within float precision. Used by the honest candidate to synthesize
    the bandlimited series directly, and by the harness to bound the expected spectrum.
    """
    k_max = 0
    for k in range(1, 200):
        if np.abs(jv(k, index)) < 1e-5 and np.abs(jv(k + 1, index)) < 1e-5:
            break
        k_max = k
    # Anything whose frequency lands above Nyquist would fold; cap at what survives.
    kmax_nyq = int((sr / 2.0 - fc) / (ratio * fc)) if ratio * fc > 0 else 0
    return min(k_max, max(kmax_nyq, 0))
