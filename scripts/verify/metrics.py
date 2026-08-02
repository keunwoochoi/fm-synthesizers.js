"""Measurements the harness computes. Candidates supply a buffer and nothing else.

Every number in this project is produced here, from samples. A candidate never reports
its own score -- that is the rule that stops the whole class of failure where an agent
overwrites the timer, returns the reference, or prints a number nobody computed.

The FM metrics are the Bessel-pair version of the subtractive pair:

  sideband_err_db   how far the measured sidebands are from the Bessel amplitudes
  alias_db          how much energy sits where no sideband should be

The pair exists for the same reason as in subtractive: alias alone rewards silence, a
pure sine, and a brickwall. The sideband/Bessel gate sees through all three -- a pure
sine has no sidebands at I > 0, so it is maximally wrong on sideband structure even
though it is perfectly "alias-free".
"""

from __future__ import annotations

import numpy as np

from prototypes import fm_sidebands

# Analysis window. Blackman-Harris: ~ -92 dB sidelobes, so leakage from a strong
# sideband cannot masquerade as alias energy in a neighbouring bin.
_BIN_HALFWIDTH = 4  # bins claimed by each sideband, either side


def _spectrum(x: np.ndarray, sr: float) -> tuple[np.ndarray, np.ndarray]:
    n = len(x)
    w = np.blackman(n)
    mag = np.abs(np.fft.rfft(x * w))
    freqs = np.fft.rfftfreq(n, 1.0 / sr)
    return freqs, mag


def measure_fm(x: np.ndarray, fc: float, ratio: float, index: float,
               sr: float) -> dict:
    """Grade one rendered FM-pair buffer against the Bessel prototype."""
    out: dict = {}

    finite = np.isfinite(x)
    out["nonfinite"] = int((~finite).sum())
    if out["nonfinite"]:
        out.update(peak=float("nan"), rms=float("nan"),
                   alias_db=float("inf"), sideband_err_db=float("inf"),
                   tuning_cents=float("inf"), carrier_db=float("inf"),
                   n_sidebands=0)
        return out

    out["peak"] = float(np.max(np.abs(x))) if x.size else 0.0
    out["rms"] = float(np.sqrt(np.mean(x ** 2))) if x.size else 0.0

    freqs, mag = _spectrum(x, sr)
    total = float(np.sum(mag ** 2))
    if total <= 0.0:
        out.update(alias_db=float("inf"), sideband_err_db=float("inf"),
                   tuning_cents=float("inf"), carrier_db=float("inf"),
                   n_sidebands=0)
        return out

    sb_freqs, sb_amps = fm_sidebands(fc, ratio, index, sr)
    bin_hz = sr / len(x)

    claimed = np.zeros(len(freqs), dtype=bool)
    claimed[: int(np.ceil(20.0 / bin_hz))] = True  # DC and sub-audio: not alias
    measured = np.zeros(len(sb_freqs))

    for i, hf in enumerate(sb_freqs):
        c = int(round(hf / bin_hz))
        lo, hi = max(0, c - _BIN_HALFWIDTH), min(len(freqs), c + _BIN_HALFWIDTH + 1)
        if lo >= hi:
            continue
        claimed[lo:hi] = True
        measured[i] = float(np.max(mag[lo:hi]))

    alias_energy = float(np.sum(mag[~claimed] ** 2))
    out["alias_db"] = 10.0 * np.log10(max(alias_energy, 1e-30) / total)

    # Sideband structure. Both sides are normalised to the CARRIER (the k=0 sideband,
    # the one physically AT fc), never to each other and never to "the first in the
    # sorted list": at rational ratios the lowest-frequency sideband can be a folded
    # component far below fc, so sorting would anchor the comparison to the wrong
    # partial. A floor keeps a candidate whose carrier cancels near I ~= 2.405 from
    # dividing by noise.
    k0 = int(np.argmin(np.abs(sb_freqs - fc)))
    carrier_mag = measured[k0]
    norm = max(carrier_mag, 1e-4)
    got = measured / norm
    want = sb_amps / max(float(sb_amps[k0]), 1e-4)
    got_db = 20.0 * np.log10(np.maximum(got, 1e-4))
    want_db = 20.0 * np.log10(np.maximum(want, 1e-4))
    out["sideband_err_db"] = float(np.sqrt(np.mean((got_db - want_db) ** 2)))
    out["n_sidebands"] = int(np.sum(got > 10 ** (-40 / 20)))
    out["carrier_db"] = 20.0 * np.log10(max(carrier_mag, 1e-30))

    # Tuning: the carrier must sit at f_c. Parabolic interpolation over the
    # log-magnitude peak, as in subtractive (a raw bin-argmax quantises to +/- 86
    # cents at f0 = 40 Hz).
    c = int(round(fc / bin_hz))
    lo, hi = max(0, c - 8), min(len(freqs), c + 9)
    if hi > lo and np.max(mag[lo:hi]) > 0:
        k = lo + int(np.argmax(mag[lo:hi]))
        if 0 < k < len(mag) - 1:
            a, b, g = (float(np.log(max(mag[k + d], 1e-30))) for d in (-1, 0, 1))
            denom = a - 2.0 * b + g
            delta = 0.5 * (a - g) / denom if abs(denom) > 1e-30 else 0.0
            delta = float(np.clip(delta, -0.5, 0.5))
        else:
            delta = 0.0
        peak_f = (k + delta) * bin_hz
        out["tuning_cents"] = abs(1200.0 * np.log2(max(peak_f, 1e-9) / fc))
    else:
        out["tuning_cents"] = float("inf")

    return out
