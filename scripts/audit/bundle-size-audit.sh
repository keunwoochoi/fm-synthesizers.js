#!/usr/bin/env bash
# Owns the public bundle-size contract. PRINCIPLES.md cites this script rather than
# restating the number, so this file is the single place the ceiling is written down.
#
# Two failures this exists to make impossible:
#   1. A stale shipped WASM. packages/core/wasm/ is committed; if it drifts from what
#      the current Rust source builds, every published size number and every render
#      gate is measuring a binary nobody can reproduce.
#   2. A README that quietly lies. The sibling project's drifted to claiming less than
#      half its real size, because the number lived in prose.
set -euo pipefail
cd "$(dirname "$0")/../.."

BUDGET_GZ=$((60 * 1024))   # whole library, gzipped, all-in
SHIPPED=packages/core/wasm/fm_dsp.wasm
BUILT=target/wasm32-unknown-unknown/release/fm_dsp.wasm

if command -v cargo >/dev/null 2>&1; then
  cargo build -q -p fm-dsp --target wasm32-unknown-unknown --release
  if [ -f "$BUILT" ] && ! cmp -s "$SHIPPED" "$BUILT"; then
    echo "BUNDLE AUDIT FAIL: shipped WASM is stale."
    echo "  shipped $(shasum -a 256 "$SHIPPED" | cut -c1-16)"
    echo "  built   $(shasum -a 256 "$BUILT" | cut -c1-16)"
    echo "  fix: cp $BUILT $SHIPPED"
    exit 1
  fi
fi

# Reproducible across platforms; `gzip -9` is not. See scripts/audit/gzsize.py.
gz() { python3 scripts/audit/gzsize.py "$1"; }
# CORE is what the quickstart downloads: both entry points it imports, plus the
# parameter metadata index.js pulls in. Omitting any of them would let generated docs
# claim an engine-only size for a package whose curated presets and documented controls
# are part of the product.
CORE=("$SHIPPED" packages/core/src/index.js packages/core/src/parameters.js \
      packages/core/src/presets.js packages/core/worklet/processor.js)

# OPTIONAL is the subpath entry points nothing in the engine imports. A consumer who
# never loads a scale downloads none of tunings.js — so it must not inflate the headline
# figure, which is what a reader takes "this synthesizer is N KB" to mean.
#
# It is still counted against the BUDGET, and that is the point of splitting rather than
# excluding: if a subpath escaped the ceiling, then moving code behind one would become a
# way to spend budget that nothing measures. Two numbers, because there are two honest
# questions — what you download, and how large the library is allowed to get.
OPTIONAL=(packages/core/src/tunings.js)

row() {
  [ -f "$1" ] || { echo "BUNDLE AUDIT FAIL: $1 is missing."; exit 1; }
  printf '%-44s %10s %10s\n' "$1" "$(wc -c < "$1" | tr -d ' ')" "$2"
}

core=0
printf '%-44s %10s %10s\n' file raw gz
for f in "${CORE[@]}"; do
  g=$(gz "$f"); core=$((core + g)); row "$f" "$g"
done
printf '%-44s %10s %10s\n' CORE "" "$core"

total=$core
echo "-- opt-in subpath entry points --"
for f in "${OPTIONAL[@]}"; do
  g=$(gz "$f"); total=$((total + g)); row "$f" "$g"
done
printf '%-44s %10s %10s\n' TOTAL "" "$total"

# THE LISTS ABOVE ARE HAND-WRITTEN, SO THEY ARE CHECKED AGAINST THE EXPORT MAP.
#
# Splitting CORE from OPTIONAL is only honest while OPTIONAL is complete: a subpath added
# to packages/core/package.json but not to the list would escape the ceiling silently,
# and the argument that "TOTAL still enforces the budget" would quietly stop being true.
# A hand-maintained list defending a budget is the thing this repo's rules call a rule
# that is remembered rather than enforced, so it is derived-checked instead.
#
# It lives in its own file so it can be tested: scripts/audit/test_entry_point_coverage.py
# feeds it every conditional-export shape and asserts each one is rejected. The first
# version of this check was inline here, read only the `default` condition, and was
# therefore blind to `{"import": ...}` -- a gate with a trivial bypass, which is worse
# than no gate because it reads as covered.
python3 scripts/audit/check_entry_point_coverage.py \
  --package packages/core/package.json "${CORE[@]}" "${OPTIONAL[@]}" || exit 1

echo "budget: $BUDGET_GZ B gz ($((BUDGET_GZ / 1024)) KB) — using $((total * 100 / BUDGET_GZ))%"
if [ "$total" -gt "$BUDGET_GZ" ]; then
  echo "BUNDLE AUDIT FAIL: over budget by $((total - BUDGET_GZ)) B gz."
  exit 1
fi
echo "bundle audit OK"
