# PRINCIPLES

**Version 1.0.0** · Ratified 2026-08-02

> This is the constitution. `AGENTS.md` routes; this file governs and supersedes other practice.
> Amendments are dated, quote the owner verbatim, say what the old rule got wrong, and carry a
> **Sync Impact Report** naming every artifact the change must propagate to.
>
> **This file contains no number derived from code.** Numbers live in the scripts that measure them.

## Mission

Every web developer should be able to `npm install` a real FM synthesizer — electric-piano-ish,
bell, breathy brass — computed on the fly in tens of kilobytes. No samples, no CDN, works offline,
one `noteOn()` call.

Third in the `sets-of-instruments-js` family. `physical-instruments.js` models instruments that
exist; `subtractive-synthesizers.js` ships synthesizers whose output imitates nothing. **This one is
the FM sibling: operators → algorithm → envelopes, and its output also imitates nothing.** FM
belongs here, not smuggled into subtractive; wavetable belongs in yet another sibling.
## Product principles (ordered)

### 1. Curation is the product
An FM bell is not an imitation of anything — it is the sound itself. There is no reference
recording we are failing to match, so **no correctness result will ever make a patch good.** What
makes this library worth installing is that someone with taste chose these patches and committed to
them. Corollary, and it is product law: **pick one target tone and commit — never tune to the
washed-out average. A patch that offends nobody has failed.**

### 2. Write the target down before you tune it
Every patch gets an intent statement — prose plus measurable targets *derived from* that prose —
before any parameter is touched. Without one, tuning drifts forever and every stopping point is
defensible in hindsight. The intent is what lets us be **wrong**, which is the only thing that lets
us finish. Amend openly, with a reason; never drift silently.

### 3. Tiny and self-contained
No sample downloads, no CDN dependencies, no network at play time. The ceiling is owned by
`scripts/audit/bundle-size-audit.sh` and fails CI on breach. **Never restate it from memory.**

### 4. Trivial API, deep escape hatches — and here the hatches matter more
A web developer plays a note in three lines. But index, ratio, and envelope times are what FM
players actually reach for, and an FM library that buries them behind presets has missed the point.
Presets stay one string simple; the panel is one argument away.

### 5. Arrangements, not solo demos
Budget, API, and evals are defined on a reference arrangement containing the **expensive** patch by
construction — never an average of cheap ones.

### 6. Works where web devs work
Vite, Next, Webpack, iOS Safari — zero-config or it doesn't ship. Single-threaded: no COOP/COEP
demands on anyone's deployment.

## Engineering principles

### Fidelity to specification, not to a recording
A carrier at *f_c* modulated by a modulator at *f_m* with index *I* produces sidebands at *f_c ±
k·f_m* with Bessel-function amplitudes *J_k(I)*. **We do not need a reference recording because we
have a reference equation** — no room, no microphone, no performer, no license, no sampling error.
This is the same structural difference the subtractive sibling established; FM's equations are if
anything more exact.

### Reference-corpus convergence is a non-goal
Rejected on the same two grounds as subtractive: we are not trying to *be* any particular
synthesizer, and no verified CC0/CC-BY corpus of FM multi-samples is known to exist. Hardware
recordings are **calibration spot-checks, never convergence targets** — scratchpad only, never
committed, license verified first.

### Publish only as the account that owns the repo
Every GitHub-side action — issues, comments, reviews, releases — comes from the owning account.
Tooling keeps one global active identity while pushes authenticate separately, so git history can
look correct while published activity is attributed to the wrong person. **This is the one harness
failure that is not recoverable in-repo** — it requires the owner to delete published content. The
check derives the expected identity from the repo owner and **names no other account: this repo is
public, and naming one would be the exposure the rule exists to prevent.**

### An exact metric is not a safe metric
Analytic ground truth protects the formula, never the pipeline. Every comparable automated-search
system was gamed at the timer, the reference, the comparison, or the aggregation — never at the
mathematics. So: **the DSP returns a buffer and the harness computes every number**; the harness is
not editable by the thing it grades; **we grade the worst case over the sweep, never the average**;
and the cheats are written first and proven to lose.

### Taste never becomes fitness — it becomes the next metric
A verbal reason from a listening trial is a **specification request**, not a score. Its job is to
become an analytic metric, at which point it enters the cascade and stops costing listening trials
forever. Listening is the scarcest resource in this project: never spend a trial on a candidate
that failed an automated gate.

### A metric delta is not a sound
Inherited from the family's hardest-won lesson: a PR there moved every metric it set out to move
and was audibly nothing. That binds **harder** here — we have less anchoring, not more. **No change
affecting how a patch sounds ships on measurements alone.**

### Eval before trust
Blind and order-randomized, always — cheap, and it removes expectation bias. The **verbal reason**
for a pick is the recorded output: the parameter is recoverable from the diff, the reason is not.
Rejected variants are recorded too.

### Every patch is held to the quality matrix, in dependency order
**stability → headroom → alias → tune → envelope → dynamics → character.** A NaN-ing or clipping
voice corrupts every downstream number; inharmonic energy corrupts every spectral measurement for
the same reason. Alias sits early because FM's Bessel series is infinite — there is always folding
above Nyquist, so alias is FM's headline tripwire, and it has a fully objective answer.### The audio thread is sacred
Allocation-free, lock-free, GC-free, denormal-flushed. Violations are bugs even when inaudible today.

### Degradation is acceptable; corruption is not
Under load we shed voices gracefully — never glitch, crackle, or go silent without a diagnostic.

### No silent errors, no silent fallbacks
Loud on failure, silent on success. A lookup that quietly falls back to a default is a bug.

### Generate, never duplicate
A fact in two hand-maintained places will disagree. One source, generated outward, proven by a test.

### Rules are enforced or they are deleted
Instruction files are context, not configuration — under pressure prose gets ignored. Anything that
must always happen is a hook, a generated artifact, or a failing test, and the enforcement must
itself be shown to fail correctly. An audit never observed to fail is not evidence of anything.

### License hygiene is absolute
Port MIT/BSD freely with ledger entries; never open GPL/LGPL/AGPL source — papers-only
reimplementation. **Trademarks bind hardest in FM:** the canonical FM sounds are inseparable from
protected names — DX7, DX100, TX81Z, the FM lineage. **Describe our sounds, never brand them.** The
patents are long expired; trademark is the live risk. A clearly historical README section may make
factual, sourced references; those references may not name this product, a preset, or a feature.

### Packages are self-contained by design — no shared engine
Every sibling ships its own copy of the shared plumbing; cross-package duplication is deliberate,
permanent, not drift. Owner, verbatim, 2026-08-02: *"I've never wanted to do this. My 100% conviction
intention is to keep every package separate. It's okay to have a hard copy, cloned and duplicate code
across different packages. Completely fine."* Ledger provenance stays (license hygiene); its "clean
diff" purpose is moot.

## What we are not

- Not a DAW, sequencer, arpeggiator, or groovebox.
- Not a sampler, soundfont player, or sample-based anything.
- Not an emulation of any specific hardware synthesizer, and not marketed as one.
- Not a VST/plugin host or exporter — browser only.
- Not a modular environment or patching language; the signal path is fixed and curated.
- Not a subtractive or wavetable engine. **FM means operators → algorithm → envelopes.**

## Amendments

Current version is in the header above. Full reasoning and Sync Impact Reports:
[`agentic-docs/amendments.md`](agentic-docs/amendments.md).
| Version | Date | What changed |
|---|---|---|
| 1.0.0 | 2026-08-02 | Ratified |
