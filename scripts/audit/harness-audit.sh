#!/usr/bin/env bash
# Owns the harness rules that would otherwise be enforced by memory.
# Two things this must do, in order:
#   1. Prove the audit still fails on deliberately broken input. A green audit that
#      cannot go red is not evidence. (METR task standard, applied to ourselves.)
#   2. Audit the real repo.
set -euo pipefail
cd "$(dirname "$0")/../.."

# Show the last few lines when a suite passes, and EVERYTHING when it fails. The first
# version piped through `tail -3` unconditionally, which meant the one time it mattered
# -- a missing dependency on CI -- the traceback naming the module was cut off and the
# log showed only "exit code 1".
run_tests() {
  local out
  if out=$(python3 "$1" 2>&1); then
    printf '%s\n' "$out" | tail -3
  else
    printf '%s\n' "$out"
    if grep -q ModuleNotFoundError <<<"$out"; then
      echo
      echo "Missing a dev dependency. Install with:"
      echo "    pip install -r scripts/requirements-dev.txt"
    fi
    return 1
  fi
}

echo "== identity =="
# First, because a wrong GitHub identity is the one harness failure that publishes
# something the owner then has to delete. Everything else is recoverable in-repo.
scripts/audit/check-identity.sh --warn

echo
echo "== CI at head =="
if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  # Querying the workflow that is currently running can only report "in progress",
  # and the ephemeral Actions identity intentionally cannot pass gh-owner.sh. The
  # workflow itself supplies the remote verdict; keep the exact-head query for local
  # and release-readiness use, where it answers a real question.
  echo "ci check: current GitHub Actions workflow supplies this verdict; skipping recursive query"
else
  scripts/audit/check-ci.sh || true
fi

echo
echo "== proving the audit can fail =="
run_tests scripts/audit/test_harness_audit.py

echo
echo "== proving the release CI gate fails closed =="
run_tests scripts/release/test_check_ci.py

echo
echo "== worktrees (merged ones are deleted, not kept) =="
# Offline by design: this runs inside the pre-commit hook, so it reads origin/main as
# last fetched rather than reaching the network on every commit.
python3 scripts/dev/worktree.py audit

echo
echo "== proving the worktree lifecycle refuses what it should =="
run_tests scripts/dev/test_worktree.py

echo
echo "== proving the release-impact gate fails closed =="
run_tests scripts/release/test_check_release_impact.py

echo
echo "== proving no entry point can escape the size budget =="
# The bundle audit splits CORE from OPTIONAL, and that split is only honest while every
# exported entry point is measured. This proves the coverage gate rejects each shape a
# conditional export can take -- the first version read only `default` and was blind to
# the rest, which is a bypass rather than a gap.
run_tests scripts/audit/test_entry_point_coverage.py

echo
echo "== proving verify-spec rejects cheats =="
run_tests scripts/verify/test_verify_spec.py

echo
echo "== rust unit tests (filter response shapes) =="
if command -v cargo >/dev/null 2>&1; then cargo test -q -p fm-dsp --lib 2>&1 | tail -3; else echo "cargo not installed; skipping"; fi

echo
echo "== engine checks (stability, headroom, effects) =="
node scripts/verify/check_engine.mjs | tail -3

echo
echo "== patch bank (stability, loudness match, distinctness) =="
node scripts/verify/check_patches.mjs | tail -4

echo
echo "== dsp-bench (audio-thread budget) =="
# The bench exits 1 on a REAL budget breach (BENCH FAIL) AND on a measurement-quality
# warning (BENCH UNRELIABLE, two runs disagreeing by >25%). Only the first is a gate.
# The second is environmental: on a loaded machine the run-to-run spread of the minima
# exceeds the tripwire while the actual budget stays well inside the gate (measured:
# min-of-N 17-24% vs the 50% ceiling while the host sat under load ~50). Blocking every
# commit on scheduler noise turns the gate into a coin flip. So: fail only when the
# output says BENCH FAIL; otherwise report (including UNRELIABLE) and continue.
if ! bench=$(node scripts/verify/dsp_bench.mjs 2>&1); then
  if grep -q "BENCH FAIL" <<<"$bench"; then
    printf '%s\n' "$bench"
    echo "AUDIT FAIL: dsp-bench reports a real budget breach."
    exit 1
  fi
fi
printf '%s\n' "$bench" | grep -E "active voices|bench OK|BENCH|FAIL"

echo
echo "== patch intents (PRINCIPLES #2) =="
python3 scripts/verify/check_intents.py

echo
echo "== generated docs match their measurements =="
python3 scripts/gen_docs.py --check

echo
echo "== public parameter metadata and npm README fail correctly =="
node --test scripts/verify/test_parameters.mjs scripts/verify/test_npm_readme.mjs
node scripts/gen_parameters.mjs --check
node scripts/verify/check_npm_readme.mjs

echo
echo "== auditing the repo =="
python3 scripts/audit/harness_audit.py
