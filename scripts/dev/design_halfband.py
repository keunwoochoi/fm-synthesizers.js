#!/usr/bin/env python3
"""Design anti-alias halfbands for FM decimation.

The 23-tap HalfBand (inherited from the subtractive sibling) has its transition band
from ~0.5 to ~0.70 of the input Nyquist. For the subtractive voice that was enough:
PolyBLEP residual above 24 kHz was already low. FM is different -- a high index at a high
ratio puts STRONG sidebands just above 24 kHz (measured: -21.6 dB at 23012 Hz for
fc=1135.8, ratio=7, index=1.94), and those land inside the inherited filter's transition
band, folding straight back into the audible band.

The honest Bessel equation is bandlimited AT 24 kHz; the shipped path must be too. Two
tables exist:

  - the 23-tap `HalfBand` for the first 4x->2x stage (cheap; nothing audible folds there),
  - the 127-tap `HalfBandFinal` for the final 2x->1x stage (the fold that matters).

    python3 scripts/dev/design_halfband.py            # 127-tap final stage table
"""
import numpy as np

SR_IN = 96_000.0      # final decimation stage input rate (2x oversampled)
PASS = 24_000.0       # passband edge
TAPS = 127            # final stage tap count (measured: -23 dB at 24988 Hz, the leak)

def design_halfband(taps: int, sr: float, beta: float = 8.0) -> tuple[np.ndarray, np.ndarray]:
    """Odd-length halfband: centre tap 0.5, only odd offsets non-zero."""
    n = np.arange(-(taps - 1) // 2, (taps - 1) // 2 + 1)
    h = np.sinc(2 * PASS * n / sr) * np.kaiser(taps, beta)
    for i in range(taps):
        if n[i] != 0 and n[i] % 2 == 0:
            h[i] = 0.0
    h /= h.sum()
    return h, n


def main() -> None:
    h, n = design_halfband(TAPS, SR_IN)
    assert abs(h.sum() - 1.0) < 1e-6, f"sum {h.sum()}"
    for off, val in zip(n, h):
        if abs(val) > 1e-9:
            print(f"{off:+3d}  {val:.9e}f,")


if __name__ == "__main__":
    main()
