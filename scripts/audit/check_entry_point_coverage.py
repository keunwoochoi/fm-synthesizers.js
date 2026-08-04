#!/usr/bin/env python3
"""Every entry point a consumer can resolve at runtime must be inside the size budget.

WHY THIS EXISTS. The bundle audit reports two totals -- CORE, what importing the library
downloads, and TOTAL, what the 60 KB ceiling applies to. That split is only honest while
the list of optional entry points is complete: a subpath added to package.json but not to
the audit would escape the ceiling silently, and the argument that "TOTAL still enforces
the budget" would quietly stop being true. A hand-maintained list defending a budget is a
rule that is remembered rather than enforced, so the required coverage is derived from the
package's own export map instead.

WHY IT WALKS EVERY CONDITION. The first version read only the `default` condition, which
made `{"import": "./dist/x.js"}` -- an ordinary, valid conditional export -- invisible to
it. A gate with a trivial bypass is worse than no gate, because it reads as covered. So
every runtime path an entry can resolve to is collected, including nested conditions and
fallback arrays.

    python3 scripts/audit/check_entry_point_coverage.py --package <path> <measured-file>...
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# A `.d.ts` is never downloaded by a browser, so a types condition is not a runtime path.
# It is the ONLY condition excluded; every other name -- import, require, browser, node,
# development, production, and anything invented later -- can be what a consumer actually
# loads, and skipping an unrecognised one is how the first version of this gate broke.
TYPES_CONDITIONS = {"types", "typings"}


def runtime_targets(entry) -> list[str]:
    """Every path this export entry can resolve to at runtime, in declaration order."""
    if isinstance(entry, str):
        return [entry]
    # A fallback array: any element may be the one that resolves, so all of them count.
    if isinstance(entry, list):
        return [t for item in entry for t in runtime_targets(item)]
    if isinstance(entry, dict):
        return [t for condition, value in entry.items()
                if condition not in TYPES_CONDITIONS
                for t in runtime_targets(value)]
    return []


def to_source(dist: str) -> str:
    """The source file the audit measures, from the dist path package.json publishes.

    The audit measures sources rather than dist/ so it can run before a build has
    happened; packages/core/scripts/build.mjs is what makes the two correspond.
    """
    if dist.endswith(".wasm"):
        return "packages/core/wasm/" + dist.rsplit("/", 1)[-1]
    return dist.replace("./dist/", "packages/core/src/")


def normalise(exports):
    """package.json permits a bare string or a top-level conditions object for '.'."""
    if isinstance(exports, str):
        return {".": exports}
    if isinstance(exports, dict) and exports and not any(
            key.startswith(".") for key in exports):
        return {".": exports}
    return exports


def check(exports, measured: set[str]) -> list[str]:
    problems: list[str] = []

    # Vacuous truth is not coverage. An absent or empty export map would make every
    # assertion below pass while measuring nothing at all.
    if not exports:
        return ["package.json declares no exports, so this gate would pass vacuously "
                "while measuring nothing"]
    if not isinstance(exports, (str, dict)):
        return [f"package.json exports is a {type(exports).__name__}, which cannot be resolved"]

    for name, entry in normalise(exports).items():
        # `null` is the documented way to block a subpath. It ships nothing, so there is
        # nothing to measure -- distinct from an entry that declares a target which does
        # not resolve at runtime, which is the next case and is an error.
        if entry is None:
            continue
        targets = runtime_targets(entry)
        if not targets:
            problems.append(
                f"{name} declares no runtime target (types-only, or empty), so it cannot "
                f"be resolved by a consumer and cannot be measured")
            continue
        for dist in targets:
            source = to_source(dist)
            if source not in measured:
                problem = (f"{name} -> {dist} is exported but not measured "
                           f"(expected to measure {source})")
                if problem not in problems:
                    problems.append(problem)
    return problems


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--package", required=True, help="path to the package.json to read")
    parser.add_argument("measured", nargs="*", help="repo-relative files the audit measured")
    args = parser.parse_args()

    manifest = json.loads(Path(args.package).read_text(encoding="utf-8"))
    problems = check(manifest.get("exports"), set(args.measured))

    if problems:
        print("BUNDLE AUDIT FAIL: entry points are outside the measured budget.")
        print("Add them to CORE or OPTIONAL in scripts/audit/bundle-size-audit.sh.")
        for problem in problems:
            print(f"  {problem}")
        return 1

    count = len(normalise(manifest["exports"])) if manifest.get("exports") else 0
    print(f"entry-point coverage OK — every runtime path of all {count} exports is measured")
    return 0


if __name__ == "__main__":
    sys.exit(main())
