#!/usr/bin/env python3
"""Design the final-stage anti-alias halfband for FM decimation.

The shipped HalfBand (inherited from the subtractive sibling, N=23) has its transition
band from ~0.5 to ~0.70 of the input Nyquist. For the subtractive voice that was enough:
PolyBLEP residual above 24 kHz was already low. FM is different -- a high index at a high
ratio puts STRONG sidebands at fc + k*fm just above 24 kHz (measured: -12.7 dB at
23012 Hz for fc=1135.8, ratio=7, I=5.77), and those land inside the inherited filter's
transition band, folding straight back into the audible band.

The honest Bessel equation is bandlimited AT 24 kHz; the shipped path must be too. This
designs a sharper halfband for the FINAL 2x->1x stage, with the stopband reached by
~26 kHz instead of 33.6 kHz.

    python3 scripts/dev/design_halfband.py
"""
import numpy as np

SR_IN = 96_000.0      # final decimation stage input rate (2x oversampled)
PASS = 24_000.0       # passband edge
STOP = 26_000.0       # stopband edge (freq above which >= -60 dB)
ATTEN = 60.0          # dB

dw = 2 * np.pi * (STOP - PASS) / SR_IN
A = ATTEN
N = int(np.ceil((A - 7.95) / (2.285 * dw)))
if N % 2 == 0:
    N += 1
beta = 0.1102 * (A - 8.7) if A > 50 else (0.5842 * (A - 21) ** 0.4 + 0.07886 * (A - 21) if A > 21 else 0.0)

n = np.arange(-(N - 1) // 2, (N - 1) // 2 + 1)
h = np.sinc(2 * PASS * n / SR_IN) * np.kaiser(N, beta)
h /= h.sum()

# response check
f = np.linspace(0, SR_IN / 2, 20000)
resp = np.abs(np.fft.fft(h, 40000))[: 20000]
fbin = np.linspace(0, SR_IN / 2, 20000)

def db_at(freq):
    k = int(round(freq / (SR_IN / 2) * 20000))
    return 20 * np.log10(max(resp[k], 1e-9))

print(f"taps={N}  beta={beta:.4f}")
print(f"at 24.0k {db_at(24000):+.1f} dB | at 25.0k {db_at(25000):+.1f} dB | "
      f"at 26.0k {db_at(26000):+.1f} dB | at 33.6k {db_at(33600):+.1f} dB")
print(f"sum={h.sum():.6f}")
print("coefficients:")
for v in h:
    print(f"{v:.9e}f,")
