#!/usr/bin/env python3
"""Prove the entry-point coverage gate fails when it should.

An audit never observed to fail is not evidence of anything, and this gate had already
been observed to pass when it should have failed: its first version read only the
`default` condition, so every OTHER conditional shape evaded it silently while the audit
printed "coverage OK". The demonstration behind it covered one shape out of four, which
is why the hole survived.

So the evasion shapes are the fixtures. Each one below is a valid package.json export
that ships a runtime file the audit does not measure, and every one of them must be
rejected -- not just the shape that happened to be tested first.

    python3 scripts/audit/test_entry_point_coverage.py
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from check_entry_point_coverage import check  # noqa: E402

ROOT = HERE.parent.parent
SCRIPT = HERE / "check_entry_point_coverage.py"

# What the real audit measures, standing in for the CORE + OPTIONAL lists.
MEASURED = {
    "packages/core/wasm/fm_dsp.wasm",
    "packages/core/src/index.js",
    "packages/core/src/parameters.js",
    "packages/core/src/presets.js",
    "packages/core/src/tunings.js",
    "packages/core/worklet/processor.js",
}

GOOD = {
    ".": {"types": "./dist/index.d.ts", "default": "./dist/index.js"},
    "./tunings": {"types": "./dist/tunings.d.ts", "default": "./dist/tunings.js"},
    "./wasm": "./dist/wasm/fm_dsp.wasm",
}

# Every one of these ships ./dist/extra.js, which is not measured. All four are valid
# package.json, and only the first was covered by the original demonstration.
EVASIONS = {
    "a plain default condition": {"types": "./dist/extra.d.ts", "default": "./dist/extra.js"},
    "an import-only conditional export": {"import": "./dist/extra.js"},
    "a require-only conditional export": {"require": "./dist/extra.js"},
    "a browser-only conditional export": {"browser": "./dist/extra.js"},
    "a bare string entry": "./dist/extra.js",
    "a nested condition under import": {"import": {"types": "./dist/extra.d.ts",
                                                   "default": "./dist/extra.js"}},
    "a fallback array": [{"types": "./dist/extra.d.ts"}, "./dist/extra.js"],
    "an unrecognised future condition": {"deno": "./dist/extra.js"},
}


class EvasionShapesAreRejected(unittest.TestCase):
    def test_each_evasion_shape_is_rejected(self):
        for name, entry in EVASIONS.items():
            with self.subTest(shape=name):
                problems = check({**GOOD, "./extra": entry}, MEASURED)
                self.assertTrue(problems, f"{name} evaded the coverage gate entirely")
                self.assertTrue(
                    any("./extra" in p for p in problems),
                    f"{name} was rejected, but not for the unmeasured entry point: {problems}")

    def test_the_wasm_asset_is_matched_to_its_source(self):
        # The one entry whose dist path does not map to src/ by string replacement.
        self.assertEqual(check({"./wasm": "./dist/wasm/fm_dsp.wasm"}, MEASURED), [])
        self.assertTrue(check({"./wasm": "./dist/wasm/other.wasm"}, MEASURED))


class VacuousPassesAreRejected(unittest.TestCase):
    def test_an_empty_export_map_is_a_failure(self):
        for exports in ({}, None, ""):
            with self.subTest(exports=exports):
                problems = check(exports, MEASURED)
                self.assertTrue(problems, "an empty export map passed vacuously")
                self.assertIn("vacuous", " ".join(problems).lower())

    def test_an_entry_with_no_runtime_target_is_a_failure(self):
        for name, entry in {
            "an empty condition object": {},
            "types only": {"types": "./dist/extra.d.ts"},
            "typings only": {"typings": "./dist/extra.d.ts"},
        }.items():
            with self.subTest(shape=name):
                problems = check({**GOOD, "./extra": entry}, MEASURED)
                self.assertTrue(problems, f"{name} was treated as covered")
                self.assertIn("no runtime target", " ".join(problems))


class LegitimateShapesArePassed(unittest.TestCase):
    """The other half of the standard: a gate that rejects everything is also useless."""

    def test_the_real_manifest_passes(self):
        self.assertEqual(check(json.loads(
            (ROOT / "packages/core/package.json").read_text(encoding="utf-8"))["exports"],
            MEASURED), [])

    def test_a_measured_entry_point_in_every_shape_passes(self):
        for name, entry in {
            "default": {"types": "./dist/tunings.d.ts", "default": "./dist/tunings.js"},
            "import-only": {"import": "./dist/tunings.js"},
            "bare string": "./dist/tunings.js",
            "nested": {"import": {"default": "./dist/tunings.js"}},
            "both conditions, one file": {"import": "./dist/tunings.js",
                                          "require": "./dist/tunings.js"},
        }.items():
            with self.subTest(shape=name):
                self.assertEqual(check({".": "./dist/index.js", "./t": entry}, MEASURED), [],
                                 f"{name} is measured and must not be rejected")

    def test_a_blocked_subpath_is_not_a_failure(self):
        # `null` is the documented way to block a subpath. It ships nothing, so there is
        # nothing to measure -- unlike an entry that names a target which cannot resolve.
        self.assertEqual(check({**GOOD, "./internal": None}, MEASURED), [])


class TheScriptExitsNonZero(unittest.TestCase):
    """The check runs as a subprocess inside a bash audit, so the exit code is the gate."""

    def _run(self, exports):
        with tempfile.TemporaryDirectory() as work:
            manifest = Path(work) / "package.json"
            manifest.write_text(json.dumps({"name": "x", "exports": exports}))
            return subprocess.run(
                [sys.executable, str(SCRIPT), "--package", str(manifest), *sorted(MEASURED)],
                capture_output=True, text=True)

    def test_a_good_manifest_exits_zero(self):
        result = self._run(GOOD)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("coverage OK", result.stdout)

    def test_every_evasion_shape_exits_one(self):
        for name, entry in EVASIONS.items():
            with self.subTest(shape=name):
                result = self._run({**GOOD, "./extra": entry})
                self.assertEqual(result.returncode, 1,
                                 f"{name} exited 0:\n{result.stdout}{result.stderr}")
                self.assertIn("BUNDLE AUDIT FAIL", result.stdout)

    def test_an_empty_manifest_exits_one(self):
        result = self._run({})
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
