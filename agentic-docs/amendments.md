# Constitutional amendments

Full record of every change to `PRINCIPLES.md`, newest first. The constitution itself carries only
the current rules and a one-line index — amendment *reasoning* is durable but is not needed in
context on every task, and the constitution has a hard line budget for exactly that reason.

Every amendment states what the old rule got wrong, quotes the owner verbatim where a decision was
theirs, and carries a **Sync Impact Report** naming the artifacts it must propagate to.

### 2.0.0 — 2026-08-03 — Bootstrap ends: PR CI is required, weekly monitoring is retired

**Owner, verbatim:** *“Why do you make it a weekly job? Why not just make it mandatory for every PR? Especially because I will not actively working on this repository anymore. So a weekly job sounds like a waste.”*

**What the old rule got wrong.** The inherited bootstrap gate treated branch mechanics as incidental because active autonomous construction made PR round-trips pure overhead. Separately, the harness design copied a weekly rot cron from a continuously maintained project. Those choices no longer fit a dormant, release-ready repository: direct pushes can evade the only useful enforcement point, while unattended monitoring produces alerts with no response owner. The first cron run proved the duplication cost directly—the scheduled workflow lacked the dependencies and Git history already configured correctly in `ci.yml`.

**New rule.** Every change lands through a PR and passes the required `ci.yml` checks. `ci.yml` remains manually dispatchable and is run once when work resumes on a dormant checkout. There is no weekly workflow. The one transition commit that installs this rule lands under the previously lifted bootstrap gate; the server-side rule is enabled immediately after its CI succeeds.

**Sync Impact Report** — artifacts this amendment must propagate to:
- `PRINCIPLES.md` current rule and amendment index — **required and done**.
- `AGENTS.md` authority gate — **required and done**.
- `.githooks/pre-commit` — **required and done**: local audit remains, while the server-side rule owns branch enforcement.
- `.github/workflows/ci.yml` and `.github/workflows/harness-rot.yml` — **required and done**: change-driven/manual CI remains and the scheduled duplicate is deleted.
- `agentic-docs/design/2026-07-28-harness-evidence.md` — **required and done**: the initially adopted weekly mechanic is explicitly superseded.
- GitHub `main` branch protection — **required after the transition commit is green**: require the four `ci` job contexts and enforce them for administrators.
- Issue #1 and the journey log — **required**: exact-SHA CI and server-setting evidence are recorded there.

### 1.0.0 — 2026-08-02 — Ratified

The FM sibling's constitution, ratified at M0. Inherits the family's engineering principles and the
subtractive sibling's process wholesale (the plumbing was copied byte-identical and the design docs
record the FM-specific changes: the Bessel sideband gate, the operator model, the trademark policy
that binds hardest for FM).

**Sync Impact Report** — artifacts this amendment must propagate to:
- `PRINCIPLES.md` — **required and done**.
- `AGENTS.md` — routes to the FM design docs; **required and done**.
- `agentic-docs/design/2026-08-02-architecture.md` and `2026-08-02-verification-and-harness.md` —
  **required and done**.
