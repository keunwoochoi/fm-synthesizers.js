#!/usr/bin/env python3
"""Prove the spec harness rejects what it must, and for the right reason.

Same discipline as scripts/audit/fixtures: an evaluator that has never been observed to
reject anything is not evidence. Each cheat below must fail, and must fail via the
metric it was built to defeat -- a cheat rejected for an unrelated reason would mean the
gate we rely on is dead.

    python3 scripts/verify/test_verify_spec.py
"""

from __future__ import annotations

import ast
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import candidates as C  # noqa: E402
import verify_spec as V  # noqa: E402


class TestHarnessDiscriminates(unittest.TestCase):
    def test_honest_implementation_passes(self):
        r = V.run("honest_fm", C.honest_fm)
        self.assertTrue(r["pass_hidden"],
                        f"the equation itself was rejected: {r['fails']}")

    def test_index_zero_is_a_sine_and_passes(self):
        """The FM-specific honest case: at index=0 the equation IS a pure sine, so a
        pure sine must pass at I=0 -- it is not a cheat there, it is the definition."""
        r = V.run("cheat_pure_sine", C.cheat_pure_sine)  # cannot run with I=0 via grid
        grid = [(440.0, 1.0, 0.0, 48_000.0)]
        vis = V.evaluate(lambda *a: C.cheat_pure_sine(a[0], a[1], 0.0, a[3], a[4]),
                         grid, label="i0")
        ok, fails = V.verdict(vis)
        self.assertTrue(ok, f"index=0 pure sine rejected: {fails}")

    def test_zero_index_must_not_pass_at_positive_index(self):
        """The pure sine (a carrier-only oscillator) must FAIL once I > 0, because a
        real FM pair has sidebands and a carrier-only oscillator does not."""
        r = V.run("cheat_pure_sine", C.cheat_pure_sine)
        self.assertFalse(r["pass_hidden"], "a carrier-only oscillator was accepted at I > 0")
        self.assertGreater(r["hidden"]["sideband_err_db"], 20.0,
                           "carrier-only should be maximally wrong on sidebands")

    def test_negative_control_is_rejected_by_alias(self):
        """Naive phase integration is correct as the definition and aliases as
        implemented at 1x. It must fail the alias gate specifically."""
        r = V.run("naive_fm", C.honest_fm_via_phase)
        self.assertFalse(r["pass_hidden"], "naive FM was accepted")
        self.assertIn("alias_db", " ".join(r["fails"]))

    def test_oversampling_measurably_improves_alias(self):
        """The shipped 4x path must beat the 1x path, by a margin.

        Without this, "we added oversampling" is an assertion. FM's alias is the whole
        product argument -- the infinite Bessel series always folds -- so the number
        that proves the oversampler does its job is a gate in its own right.
        """
        os4 = V.run("wasm_fm", C.wasm_fm)
        os1 = V.run("wasm_fm_1x", C.wasm_fm_no_oversampling)
        gain = os1["hidden"]["alias_db"] - os4["hidden"]["alias_db"]
        self.assertGreater(gain, 3.0,
                           f"oversampling bought only {gain:.1f} dB of alias suppression")
        self.assertTrue(os4["pass_hidden"], f"shipped path rejected: {os4['fails']}")

    def test_every_cheat_is_rejected(self):
        for name, fn in C.CHEATS.items():
            with self.subTest(cheat=name):
                r = V.run(name, fn)
                self.assertFalse(r["pass_hidden"], f"{name} was accepted")

    def test_silence_and_sine_are_caught_by_sideband_structure_not_alias(self):
        """The reason the metrics are paired.

        A pure sine has EXCELLENT alias suppression -- comparable to the honest FM
        pair. Gating on alias alone would rank it first. Only the sideband-structure
        metric sees that it has no sidebands at I > 0.
        """
        sine = V.run("cheat_pure_sine", C.cheat_pure_sine)
        good = V.run("honest_fm", C.honest_fm)
        self.assertLess(sine["hidden"]["alias_db"], -40.0,
                        "a pure sine should be nearly alias-free")
        self.assertLessEqual(sine["hidden"]["alias_db"],
                             good["hidden"]["alias_db"] + 6.0,
                             "alias alone should rank the sine as good as the real pair")
        self.assertGreater(sine["hidden"]["sideband_err_db"], 20.0)
        self.assertFalse(sine["pass_hidden"])

    def test_special_casing_is_caught_only_by_the_hidden_grid(self):
        r = V.run("cheat_special_cased", C.cheat_special_cased)
        self.assertTrue(r["pass_visible"], "fixture no longer passes the visible grid")
        self.assertFalse(r["pass_hidden"], "special-casing survived the hidden grid")
        self.assertGreater(r["gap_db"], 5.0,
                           "the visible/hidden gap should expose special-casing")

    def test_brickwall_is_rejected(self):
        """Removing everything above 4 kHz kills the upper sidebands AND the alias;
        the sideband gate must catch the missing content."""
        r = V.run("cheat_brickwall", C.cheat_brickwall)
        self.assertFalse(r["pass_hidden"], "brickwalled FM was accepted")


class TestEvaluatorIntegrity(unittest.TestCase):
    def test_candidates_cannot_see_the_answer_key(self):
        src = (Path(__file__).resolve().parent / "candidates.py").read_text()
        imported = set()
        for node in ast.walk(ast.parse(src)):
            if isinstance(node, ast.Import):
                imported.update(a.name.split(".")[0] for a in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module.split(".")[0])
        for forbidden in ("prototypes", "metrics", "verify_spec"):
            self.assertNotIn(forbidden, imported,
                             f"candidates.py imports {forbidden} — it can see its own score")

    def test_locked_grid_points_are_rejected(self):
        # sr - 2*fc = 48000 - 24000 = 24000; fm = 2*6000 = 12000; 24000/12000 = 2, integer
        self.assertTrue(V.harmonically_locked(6000.0, 2.0, 48_000.0))
        self.assertFalse(V.harmonically_locked(6000.0, 2.1, 48_000.0))
        with self.assertRaises(AssertionError):
            V.assert_grid_is_measurable([(6000.0, 2.0, 2.0, 48_000.0)], "test")

    def test_shipped_grids_are_measurable(self):
        V.assert_grid_is_measurable(
            [(fc, ratio, index, V.VISIBLE_SR) for fc, ratio, index in V.VISIBLE_NOTES],
            "visible")
        V.assert_grid_is_measurable(V.hidden_grid(), "hidden")


if __name__ == "__main__":
    unittest.main(verbosity=2)
