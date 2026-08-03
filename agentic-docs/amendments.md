# Constitutional amendments

Full record of every change to `PRINCIPLES.md`, newest first. The constitution itself carries only
the current rules and a one-line index — amendment *reasoning* is durable but is not needed in
context on every task, and the constitution has a hard line budget for exactly that reason.

Every amendment states what the old rule got wrong, quotes the owner verbatim where a decision was
theirs, and carries a **Sync Impact Report** naming the artifacts it must propagate to.

### 2.1.0 — 2026-08-03 — The HUMAN-block gate is removed

**Owner, verbatim:** *"That CI with the human block is f——ed up. Remove it."* And, on propagating it here: *"If we have the same f——ing CI stupid humor block in other repository, we should remove them from other places too."* (Expletives elided; the emphasis is the owner's and is preserved.)

**What the old rule got wrong.** The gate required every PR body to carry a non-empty `## HUMAN:` section and instructed agents never to write it, so an agent-authored PR could not reach mergeable state until the owner returned to type prose. It contradicts the premise of the amendment that shipped alongside it: 2.0.0 rebuilt CI around a repository the owner had stepped back from, replacing unattended monitoring with change-driven and manually dispatched runs precisely because alerts with no response owner are waste. A required check only the owner can clear applies that same anti-pattern to every change — CI was made change-driven so the repo could sleep, and this gate made every change wait for a person.

The gate also mistook the location of the record. Owner reasoning is preserved verbatim and dated in this ledger, which is the single source for it; a per-PR prose box duplicates that into a second, weaker surface.

**New rule.** There is no `HUMAN:` block. PR bodies keep the sections that carry engineering content — what changed, validation bound to an exact SHA, the process trace, and the abandoned-routes row. The required `ci.yml` contexts are `build-and-audit`, `e2e`, and `bundlers`.

**Adopted from the sibling.** This is `subtractive-synthesizers.js` amendment 2.1.0, applied here because the gate was copied across siblings along with the rest of the harness. Per the no-shared-engine principle the removal is duplicated deliberately rather than extracted.

**Sync Impact Report** — artifacts this amendment must propagate to:
- `.github/workflows/ci.yml` — **required and done**: the `human-block` job is deleted.
- `.github/pull_request_template.md` — **required and done**: the `## HUMAN:` section and the header instruction to keep it are removed.
- `AGENTS.md` and `CLAUDE.md` § GitHub workflow — **required and done**: the bullet forbidding agents from filling the block is removed.
- GitHub `main` branch protection — **required**: `human-block` is dropped from the required contexts, leaving three. Enforcement for administrators is unchanged.
- `PRINCIPLES.md` amendment index and version header — **required and done**.

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
