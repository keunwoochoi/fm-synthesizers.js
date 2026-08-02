#!/usr/bin/env python3
"""Loop A, stages 1-3: grade an FM pair against its Bessel prototype.

    python3 scripts/verify/verify_spec.py                 # every candidate
    python3 scripts/verify/verify_spec.py honest_fm       # one

Design rules (from agentic-docs/design/2026-08-02-verification-and-harness.md and the
subtractive loop-evidence doc):

  - the candidate returns a buffer; every number here is computed by the harness
  - gates are the WORST case over the grid, never the mean
  - a VISIBLE grid for iteration and a HIDDEN grid for the verdict, with the gap
    between them reported
  - crash, silence, and bad-score are distinct outcomes, never collapsed

Thresholds are provisional: per the family's M1 rule, the real alias threshold is set
from measurement, not chosen now.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

import candidates as C  # noqa: E402
from metrics import measure_fm  # noqa: E402

DUR = 0.5
VISIBLE_SR = 48_000.0

# The alias metric's blind spot, FM version. A sideband at fc + k*fm above Nyquist
# folds to 2*nyq - (fc + k*fm); it is invisible when that folded image lands EXACTLY on
# a claimed bin, most dangerously on the carrier itself:
#   2*nyq - fc - k*fm == fc   ->   (sr - 2*fc) / fm is an integer.
# A grid containing such a point can grade a folding implementation as alias-free.
# (The subtractive harness found the same class of hole at sr/f0 integer; the FM
# mechanism is different, so the guard is different.)
_LOCK_TOLERANCE = 0.005


def harmonically_locked(fc: float, ratio: float, sr: float) -> bool:
    fm = ratio * fc
    if fm <= 0.0:
        return True
    r = (sr - 2.0 * fc) / fm
    return abs(r - round(r)) < _LOCK_TOLERANCE


def assert_grid_is_measurable(grid: list[tuple], label: str) -> None:
    bad = [(fc, ratio, index, sr) for (fc, ratio, index, sr) in grid
           if harmonically_locked(fc, ratio, sr)]
    if bad:
        raise AssertionError(
            f"{label} grid contains harmonically-locked points where the alias metric "
            f"is blind: {bad[:3]}. An evaluator that cannot see the defect must not be "
            f"used to grade it.")

# Iteration grid: stable, published, what you tune against. Classic FM ratios, a spread
# of indices from gentle to extreme, carriers across the audible range.
VISIBLE_NOTES = (
    (220.0, 1.0, 1.0),
    (440.0, 1.0, 2.0),
    (330.0, 1.414, 1.5),
    (440.0, 2.0, 2.0),
    (220.0, 3.0, 3.0),
    (880.0, 1.0, 0.5),
)

# Verdict grid: never tuned against. Randomised carriers, ratios and indices, at sample
# rates the visible grid does not include.
HIDDEN_SEED = 20260802


def hidden_grid(n: int = 10) -> list[tuple[float, float, float, float]]:
    rng = np.random.default_rng(HIDDEN_SEED)
    rates = [44_100.0, 48_000.0, 96_000.0]
    ratios = (0.5, 1.0, 1.4, 1.5, 2.0, 3.0, 4.0, 5.0, 7.0)
    grid: list[tuple[float, float, float, float]] = []
    while len(grid) < n:
        fc = float(rng.uniform(60.0, 1800.0))
        ratio = float(ratios[int(rng.integers(len(ratios)))])
        # Capped at the SHIPPED index range. The public `index` parameter maxes at 2.0
        # (parameters.js); a grid that grades the DSP at index 6 is grading a product
        # that cannot be built, and the measured finding was that the 4x path aliases
        # badly there (-17 dB at ratio 7, index 5.77) while staying clean (-25.5 dB)
        # across the shipped range. The grid must test what ships.
        index = float(rng.uniform(0.5, 2.0))
        sr = float(rates[int(rng.integers(len(rates)))])
        if not harmonically_locked(fc, ratio, sr):
            grid.append((fc, ratio, index, sr))
    return grid


# Thresholds set from measurement on 2026-08-02, per the family's M1 rule (measure,
# then set the gate; a number chosen before measuring is theatre). Measured worst case
# over the hidden grid, shipped 4x path:
#   honest Bessel equation  -59.5 dB     (the answer key)
#   shipped 4x WASM         -25.5 dB     (worst: ratio 7, full index)
#   naive 1x phase FM        -1.6 dB     (the definition, aliasing)
# The gate is set at -20: it passes the shipped path with ~5 dB margin, rejects the
# naive path by ~18 dB, and leaves the honest equation a wide berth. It is NOT set at
# -25 because a threshold a passing implementation clears by < 1 dB turns every
# unrelated change into a coin flip. The residual ceiling (-25.5 dB at ratio 7 + full
# index) is a recorded known limit: the final-stage half-band's transition band lets a
# strong sideband just above Nyquist fold back. The fix -- a sharper final-stage
# decimator -- is scheduled for M2, exactly as the architecture doc planned.
GATES = {
    "alias_db": ("<=", -20.0, "energy outside the Bessel sidebands, worst case"),
    "sideband_err_db": ("<=", 3.0, "sideband magnitudes vs J_k(I), worst case"),
    "tuning_cents": ("<=", 5.0, "carrier pitch error, worst case"),
    "peak": ("<=", 1.5, "no runaway"),
    "rms": (">=", 0.02, "not silent"),
}


def _worst(rows: list[dict], key: str, direction: str) -> float:
    vals = [r[key] for r in rows]
    return max(vals) if direction == "<=" else min(vals)


def evaluate(fn, grid: list[tuple], label: str = "grid") -> dict:
    assert_grid_is_measurable(grid, label)
    rows = []
    for fc, ratio, index, sr in grid:
        n = int(DUR * sr)
        try:
            x = np.asarray(fn(fc, ratio, index, sr, n), dtype=float)
        except Exception as e:  # a crash is its own outcome, not a bad score
            return {"crashed": f"{type(e).__name__}: {e}", "rows": []}
        rows.append({**measure_fm(x, fc, ratio, index, sr),
                     "fc": fc, "ratio": ratio, "index": index, "sr": sr})

    summary = {"crashed": None, "rows": rows}
    for key, (direction, _thr, _desc) in GATES.items():
        summary[key] = _worst(rows, key, direction)
    summary["nonfinite"] = sum(r["nonfinite"] for r in rows)
    return summary


def verdict(summary: dict) -> tuple[bool, list[str]]:
    if summary["crashed"]:
        return False, [f"CRASHED: {summary['crashed']}"]
    fails = []
    if summary["nonfinite"]:
        fails.append(f"{summary['nonfinite']} non-finite samples")
    for key, (direction, thr, desc) in GATES.items():
        v = summary[key]
        bad = (v > thr) if direction == "<=" else (v < thr)
        if bad or not np.isfinite(v):
            fails.append(f"{desc}: {key}={v:.2f} fails {direction} {thr}")
    return (not fails), fails


def run(name: str, fn) -> dict:
    vis = evaluate(fn, [(fc, ratio, index, VISIBLE_SR) for fc, ratio, index in VISIBLE_NOTES],
                   label="visible")
    hid = evaluate(fn, hidden_grid(), label="hidden")
    ok_v, _ = verdict(vis)
    ok_h, fails_h = verdict(hid)

    gap = None
    if not vis["crashed"] and not hid["crashed"]:
        gap = hid["alias_db"] - vis["alias_db"]  # >0 means worse when unseen

    return {"name": name, "visible": vis, "hidden": hid,
            "pass_visible": ok_v, "pass_hidden": ok_h,
            "fails": fails_h, "gap_db": gap}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("candidate", nargs="?", help="one candidate, or all if omitted")
    args = ap.parse_args()

    todo = {args.candidate: C.ALL[args.candidate]} if args.candidate else C.ALL
    print(f"verify-spec — {len(VISIBLE_NOTES)} visible points, "
          f"{len(hidden_grid())} hidden, {DUR}s each\n")
    print(f"{'candidate':20} {'alias dB':>9} {'sideband':>9} {'cents':>7} "
          f"{'rms':>6} {'gap dB':>7}  verdict")
    print("-" * 82)

    results = []
    for name, fn in todo.items():
        r = run(name, fn)
        results.append(r)
        h = r["hidden"]
        if h["crashed"]:
            print(f"{name:20} {'—':>9} {'—':>9} {'—':>7} {'—':>6} {'—':>7}  CRASH")
            continue
        gap = f"{r['gap_db']:+.1f}" if r["gap_db"] is not None else "—"
        mark = "PASS" if r["pass_hidden"] else "REJECT"
        if r["pass_visible"] and not r["pass_hidden"]:
            mark = "REJECT (passed visible!)"
        print(f"{name:20} {h['alias_db']:>9.1f} {h['sideband_err_db']:>9.1f} "
              f"{h['tuning_cents']:>7.2f} {h['rms']:>6.3f} {gap:>7}  {mark}")

    print()
    for r in results:
        if not r["pass_hidden"] and r["fails"]:
            print(f"  {r['name']}: {r['fails'][0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
