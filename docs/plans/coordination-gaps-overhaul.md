# Coordination-gaps overhaul (v3)

Validation of **three** independent RCAs across three repos, plus a sequenced patch design.
v3 supersedes v2. Every design in the v1 and v2 lineage was refuted 6/6 under adversarial
review; the surviving design is smaller, uses only mechanisms already proven in this repo,
and adds no new credentials or required contexts.

| | Repo | Stack | Contribution |
|---|---|---|---|
| **RCA-1** | opchain.dev | TS / Workers | 6 findings; the coordination-gap frame |
| **RCA-2** | dose-app | Swift / Supabase | the natural experiment; stack-portability |
| **RCA-3** | gil-elsesser (LIFE.CHAIN) | Swift / CF relay | quantification; the release ledger; self-refutation of 23 of 66 findings |

All three were investigated independently. All three had to hand-reconstruct skill history
from raw `.jsonl` weeks after the fact, because the telemetry that exists to answer that
question has no write path.

---

## Part 0 — What v3 changes

### 0.1 The binding question is settled, and the answer is narrower than "prose is weak"

RCA-3 quantified what RCA-2 demonstrated:

| First prompt names a real skill | fired | did not fire | rate |
|---|---|---|---|
| Yes (n=50) | 33 | 17 | **66.0%** |
| No (n=37) | 2 | 35 | **5.4%** |

A **12.2×** multiplier. And the decisive form: **of 54 Skill invocations across 87
transcripts, zero were autonomous opchain triggers.** The five that fired unprompted were
`artifact-design` ×3, `claude-api`, `code-review` — independently confirmed here to be
Anthropic built-ins that **do not exist under `~/.claude/skills/`** at all.

`"Trigger liberally"` appears in **24 of 29** opchain SKILL.md frontmatter blocks (verified
exactly, in both the repo and the installed copy) and produced **zero** autonomous triggers
in 23 days. **The description-matching layer is not weak. It is inert.**

**Correction to v2, which I got wrong.** v2 said the frontmatter `description` is "the sole
always-visible surface the ecosystem controls," implying it was the lever to pull. Tuning
it is not a fix — that layer is the one measured at zero. Worse, verification found the
apparent *second* surface is also fiction:

> The catalog declares **192 command verbs** (63 distinct top-level: `/oc-git`, `/oc-ops`,
> `/oc-release`, …) and **zero are registered anywhere.** No `~/.claude/commands/` directory
> exists; the repo's `.claude/commands/` contains only `flag.md`.

So `/oc-git` is not a slash command. It is a literal string inside a description that the
model pattern-matches. The commands aren't a second mechanism — they're a subset of the one
inert string.

And `find skills/ -type f -perm +111` → **0 executables**, confirmed for a third time. The
catalog can register no hook, no tool, no system-prompt fragment. It has no persistent
surface of any kind.

*Unresolved, flagged not asserted:* several opchain skills render in the live skill listing
as **bare names with no description at all** — observed first-hand in this session
(including `oc-security-auditor` and `oc-stack-forge`, both on RCA-3's never-invoked list)
and independently by a verifier, but with a **different set each time**, so the rendering is
not stable. Two candidate causes (the `governance:` key, description length) were both
tested and refuted. If reproducible, those skills have *zero* trigger surface rather than a
weak one. Worth a dedicated reproduction check; do not build on it yet.

### 0.2 Git hooks lost. CI won. Both halves now have evidence.

v2 established that git hooks fail — `git -c core.hooksPath=/dev/null commit` bypasses a
blocking hook while a sibling probe still reads ARMED (verified, git 2.50.1), and arming
`.githooks/` requires an install event that is itself prose-gated.

v3 adds the positive half. **RCA-3's premise (A) — "there are no required status checks and
making one is an unverifiable out-of-band settings change" — is refuted for opchain by a
measurement error.** The RCA queried `gh api .../branches/main/protection` → 404 and
concluded unprotected. opchain uses the **modern rulesets API**, not legacy branch
protection. It has an active ruleset:

```
main-protection (id 15551339, enforcement: active, ~DEFAULT_BRANCH)
  required_status_checks:
    Worker — build, test, catalog verify
    Site — install, type-check, build
    Site — Playwright e2e
    LHCI — perf, a11y, best-practices, SEO
```

All four map exactly to the four real CI jobs (`worker`, `site`, `site-e2e`, `lhci`). So the
gate v2 proposed is **already running in this repo**. P1 stops being "design an enforcement
surface" and becomes "propagate a configuration opchain already proved out."

*(gil-elsesser also returned `rulesets` → `[]`, so that repo is genuinely unprotected. But
any future audit must query both endpoints — the legacy one alone produces false negatives.)*

**This also closes RCA-3's premise (B).** The `startup_failure` hole — where a workflow that
fails to compile emits *no check runs*, so a PR renders 0 checks rather than red and merges
— is solved by the ruleset itself. A required context that never reports leaves the PR
permanently pending, not mergeable. Branch protection is precisely the thing that
distinguishes "all required checks passed" from "no checks exist." No script needed.

**Premise (C) survives and is the one real gap:** an allowlist means renaming a job fails
closed, but **adding** one fails **open, silently, forever.** opchain's required set is
complete today and nothing keeps it that way.

### 0.3 The telemetry finding was misdiagnosed — by RCA-1, and then by me

RCA-1 reported "enabled, 0 rows." v2 escalated it to "worse — enabled, *no store*, 24 days
undetected." **Both are wrong, and the escalation was mine.**

```
6d01e63  asfbay-bit <admin@opchain.dev>  2026-06-26
         Enable opt-in telemetry metering (/oc-telemetry enable) (#355)
```

Six of eleven checkpoints carry `project_dir: /home/user/opchain` — a **sandbox path**:
`oc-app-architect`, `oc-code-auditor`, `oc-orchestrator`, `oc-stack-forge`,
`oc-telemetry-ops`, `oc-ux-engineer`. The consent commit is authored by the web-UI identity,
not this machine.

`/oc-telemetry enable` ran in an **ephemeral cloud container**. It created the sqlite store
inside that container. `.gitignore:96-97` gitignores `usage.sqlite`; consent lives in the
**tracked** checkpoint (`telemetry.mjs:26` — "Consent is the checkpoint's
`telemetry_handle.enabled`"). The container was destroyed. Consent survived in git; the sink
could not.

So `enabled: true` + absent sink is not a 24-day outage. It is the **guaranteed steady
state on every clone, every worktree, and every CI runner, permanently, by construction.**

RCA-3's author reached exactly this conclusion for their own repo — *"UNVERIFIABLE, not
fabricated — written from a cloud sandbox. **Do not call this a lie.**"* — and I failed to
apply the same lens to opchain, amplifying RCA-1's error instead of correcting it.

**The consequence for the plan is concrete:** v2's P0.5 ("make `enabled: true` + absent sink
a CI error") is **unsatisfiable**. CI clones the repo, gets the tracked flag, and can never
hold the gitignored sqlite. It would have shipped a permanently-red required check whose
cheapest repair is deleting the feature. Cut.

**The real defect is smaller and different:** machine-local consent stored in a tracked file,
inherited by every clone and all 10 worktrees from one container's one-time opt-in.

### 0.4 A new root cause: sandbox-authored tracked state

Generalizing 0.3 — **six of eleven checkpoints describe an environment that no longer
exists.** Four are frozen at exactly `2026-06-22T16:35:00Z` (`orchestrator`, `git-ops`,
`stack-forge`, `ux-engineer`); three of those four are sandbox-authored. A cloud session
reconciled them together, committed, and no local session has touched them since.

This does **not** excuse the 27-day orchestrator staleness (finding RCA-1 #3 stands — it
claims v1.5.0 is current while v1.8.1 shipped). But it explains the mechanism: writes happen
in ephemeral environments whose state doesn't round-trip, so `project_dir` becomes a tracked
lie and nothing local ever refreshes them.

### 0.5 The revealed preference (RCA-3's best finding)

gil-elsesser rebuilt the gate layer by hand, outside the skill system: seven zero-dependency
Node scanners (`secret-scan`, `swallowed-error-scan`, `zk-invariant-scan`,
`wrangler-config-lint`, `lint-workflows`, `ui-test-gate`, `configure-ios-env`) wired into
`security.yml`, five of which genuinely exit non-zero. All seven of oc-bug-check's claimed
checks map onto executing CI, plus two the skill never conceived of.

```
$ ls /Users/aidanelsesser/repos/gil-elsesser/scripts/
… 7 gate scripts, 0 checkpoint scripts, no checkpoint.mjs
```

**The gate half of opchain was worth reimplementing by hand. The checkpoint half was not.**
That is the strongest available signal about what opchain should ship: CI-invoked gate
scripts that *wrap and adopt* what a repo already has — which is also RCA-1 finding #2's
"design skills to wrap existing automation, not compete with it."

---

## Part 1 — Verdicts

Condensed; full RCA-1 and RCA-2 verdict tables are unchanged from v2.

**Confirmed across all three RCAs:** prose does not bind; the catalog ships no executables;
`oc-git-ops:241-245` ships a false hook claim to every installed copy; gates are opchain-
shaped and silently no-op off-stack; no skill declares owns-vs-automation; checkpoint
identity is a bare name string with collisions; `oc-security-auditor` has never run **in any
of the three repos**.

**Quantified by RCA-3:** `oc-git-ops` fired **0** times while `git commit` ran **290** times
across 65 sessions and `gh pr create` **146** times across 62 — a **96.8%** bypass rate on
PR sessions. Eight skills never invoked in 87 transcripts.

**Refuted, and the corrections matter:**

| Claim | Reality |
|---|---|
| `release.yml` hollowed out oc-release-ops (RCA-1) | It never existed on any branch |
| `0.2.x` vanished from the changelog (RCA-1) | Never existed; changelog floor is 1.3.0 |
| Telemetry: enabled, 0 rows, 24 days undetected (RCA-1, amplified in v2) | Sandbox artifact; the steady state is structural, not an outage |
| No required status checks exist (RCA-3, premise A) | Legacy-API false negative; opchain has an active ruleset with 4 required checks |
| `oc-security-auditor` has a `controls_verified` field (RCA-2) | The field does not exist — the checkpoint invented a shape nothing validates |
| "Direct work by default" caused skill decline (RCA-3 self-refuted) | Skill-invoking sessions **rose** 28.6% → 55.3% after the amendment. **Leave that memory entry alone.** |

**RCA-3's self-refutation deserves note:** it killed 23 of its own 66 findings, including
its own highest-severity draft item. It also caught the merged RCA it re-litigates recording
**two of four releases backwards** — a document already on `main` and being cited. That
merged RCA reasoned from *checkpoint absence as a proxy for non-invocation*, which is the
same method error that makes an unobservable system unauditable.

---

## Part 2 — Root cause

**Outer:** the installed bundle ships no executable code and no hooks.

**Inner:** even inside opchain, prose does not bind. The only gates that work are the two
with an executable surface — the ruleset's required checks, and the repo-local `PreToolUse`
deny hook. Everything else is documentation that reads like enforcement, and one place
actively claims enforcement it does not have.

**Multiplier (RCA-3's RC-8):** none of this was observable from inside the system. Three
separate audits, three separate hand-reconstructions from raw `.jsonl`. The measurement
layer's absence is why two of the three RCAs contain inverted claims.

### Constraints any design must respect

| Constraint | Source |
|---|---|
| No CI post-merge stamping | Shipped and removed, `66107d1` — branch-protection deadlock, ~two dozen zombie PRs |
| No design whose arming depends on a skill invocation | The natural experiment |
| No git-hook-primary gate | `-c core.hooksPath=/dev/null`, verified |
| **No new PAT or repo secret** | Terminal dependency no repo artifact can create, renew, or verify; the repo already has two unmonitored instances |
| **No gate that deadlocks Dependabot** | Dependabot PRs resolve secrets from a separate store → 401 → fail closed → weekly admin bypass → manufactures the habitual bypass the gate exists to prevent |
| **No CI assertion about gitignored machine-local state** | Unsatisfiable by construction; repair is always "delete the feature" |
| **No auditor checked out from the branch it audits** | A PR can rewrite its own gate; `exit 0` at the top yields green having compared nothing |
| Must reach a non-Claude agent | Codex authored 78 of 101 commits in one repo |
| Must not assume npm, `package.json`, wrangler, a prod URL, or a health endpoint | Two of three repos are Swift |
| Must not hard-block on a missing local tool | Existing convention: `pre-commit-bugcheck.sh` soft-skips on missing `jq` |

---

## Part 3 — The patch

### P0 — Free fixes, ship today, uncoupled

| # | Change | File |
|---|---|---|
| 0.1 | Delete `&& data.status === "in_progress"`; make staleness status-aware | `scripts/checkpoint.mjs:650` |
| 0.2 | **Honesty fix.** Delete the false hook claim — exactly `:241-245`, *not* `:241-247`, which would take a `---` separator with it | `skills/oc-git-ops/SKILL.md` |
| 0.3 | Fix the `SKILL.md:88` diagram: `every skill run ──(opt-in)──►` is a lie. Make it a dashed "you must invoke this" edge naming `npm run telemetry -- record` | `skills/oc-telemetry-ops/SKILL.md` |
| 0.4 | Set `telemetry_handle.enabled: false` in the tracked checkpoint. A tracked flag cannot describe a gitignored machine-local sink | `.checkpoints/oc-telemetry-ops.checkpoint.json` |
| 0.5 | Correct `project_dir` in all **six** sandbox-authored checkpoints — `/home/user/opchain` is itself tracked state that will mislead the next reader | `.checkpoints/` |
| 0.6 | Drop `--include="*.ts"` from secret greps; add `*.swift`; add JWT (`eyJ[A-Za-z0-9_-]{10,}\.`) and `sk_test_` | `skills/oc-bug-check/SKILL.md:216-241` |
| 0.7 | Change `\| No build script \| PASS (skip) \|` → **WARN**, and add a Swift row. A gate that cannot identify the stack must never return green | `skills/oc-bug-check/SKILL.md:253`, `:616` |
| 0.8 | `checkpoint doctor --fail-on-warnings` in CI with a ratcheting budget | `.github/workflows/ci.yml` |
| 0.9 | Remove the stale auto-stamp recommendation contradicting the protocol | `skills/oc-orchestrator/SKILL.md:136` |

**Ordering constraint, load-bearing (RCA-3's RC-2):** *0.7 must land before any work that
increases invocation.* Enforcing invocation against a gate that silently skips converts a
silent no-op into an **invisible false green** — strictly worse than today, where
`oc-bug-check` simply never fires.

### P1 — Gate completeness, via the precedent already in the repo

The ruleset already exists and already fails closed on `startup_failure`. The only live gap
is (C): adding a job fails open. **Split the check along the auth boundary** — three
verifiers converged on this independently.

**Offline half — the whole value, at a fraction of the surface.** A pure filesystem
comparison of PR-triggered job contexts in `.github/workflows/*.yml` against a checked-in
`.github/ruleset-main.json` record-of-intent. No network, no auth, no secret, no new
required context. Ship it exactly the way `scripts/check-release-surfaces.mjs` is already
shipped: as a Vitest assertion inside `npm test` (`tests/release-surfaces.test.js`), which
is **already a required context** via `ci.yml:66`. Add a job, the PR goes red.

Two details that must be right or it deadlocks:
- Handle `${{ matrix.* }}` interpolation in `name:` — `canary.yml:27` is a live counterexample.
- **Hard-error**, not warn, on `paths:` / `paths-ignore:` / job-level `if:` for any job in
  the required set. A job that can conditionally not report is not requireable, and
  skipped-equals-success applies to the auditor itself.

**Online half — a canary, never a gate.** Live-ruleset-vs-declared, `enforcement === active`,
and the zero-checks probe over merged SHAs *at rest* move into `deploy-lag.yml`, which
already holds `issues: write`, already runs on `github.token`, and already implements the
single-tracking-issue dedup pattern. A stale credential degrades to a missed daily alert,
not a repo-wide merge block. The zero-checks probe is structurally dead as a peer job — a
check run cannot observe `total_count === 0` on its own sha.

**Explicitly dropped:** the `RULESET_READ_TOKEN` PAT, the new `gate.yml` required context,
automated bypass logging (write the policy into `docs/runbooks/required-checks.md` as a
stated human decision — `rule-suites` retention won't support the claim anyway), and any
`verify` run from PR head.

**For gil-elsesser and dose-app:** enrollment is creating a ruleset. It is a real
out-of-band step, but it is scriptable (`gh api PUT /repos/:o/:r/rulesets`) and opchain is
the working reference. Say so plainly rather than pretending a script can self-enroll.

### P2 — Observability, as a read-only tool (not a pipeline)

Every RCA hand-reconstructed skill usage from `~/.claude/projects/*/*.jsonl`. That data
already exists and is exactly what the audits consumed.

Ship **`scripts/skill-usage.mjs`**: machine-global, read-only, prints to stdout, **writes no
sqlite**. It delivers the entire declared-vs-invoked finding — verification already computed
it: **28 declared, 6 invoked in opchain; 12 machine-wide** — with no schema migration, no
Stop hook, no alias table, no privacy regression, and no red gate.

Reserve sqlite ingest for when a consumer needs history. `/dashboard` does not today.

If opt-in metering is kept at all, **move consent out of tracked state** into a gitignored
local file, and anchor the store at `git rev-parse --git-common-dir` so ten worktrees write
one durable store instead of ten that die with their checkout.

Normalization detail that bites: the three-tier name resolver must refuse the naive `oc-`
prefix rule — `claude-api` and `anthropic-skills:reverse-spec` are live collisions with
`oc-claude-api` and `oc-reverse-spec` and are **not** the same skills.

### P3 — Verification semantics

Unchanged from v2 and reinforced by RCA-3's F-S6 finding, which is the sharpest example
available: a security fix was applied to two of three routes, the third was never
enumerated, and **the regression test written to guard that class is structurally incapable
of observing it** — it asserts nothing was *stored* where the invariant is that nothing was
*buffered*. The suite passes 74/74 with the defect live.

`loop_state: open | closed | abandoned`; `controls[].level: reviewed | verified` where
`verified` **requires** non-empty `evidence[]`; `status: "complete"` invalid while
`loop_state: open` or `critical > 0`; a grade non-replayable as a gate input unless every
control it rests on is `verified`. Add `/oc-audit abandon`.

### P4 — Environment drift as a canary

Unchanged: a scheduled job diffing repo migrations against the linked remote, **joining on
name not version**, opening one deduped issue — modeled on `deploy-lag.yml`. It observes
prod, not a tool call, so every agent and every human is equally visible. Owner:
`oc-migration-ops`. The `apply_migration` prohibition goes in `CLAUDE.md` and the SKILL.md
says **unenforced**.

### P5 — Deferred, honestly

Client-binary ordering cannot be gated by any hook — nothing observes an Xcode Organizer
upload. The two honest controls are a server-side required-version check the app performs at
launch, and a human release checklist. Typed artifacts and `happens_before` edges wait until
someone can answer how a gate observes a GUI upload.

### P6–P8 — Pipeline as data, identity, coverage

`skills/pipeline.json` has **one** owner: the stage-DAG that generates the four existing
pipeline representations and fails the build on drift. Stable `skill_id` + `renamed_from[]`,
relaxing `checkpoint.mjs:204-207` from filename equality. `owns:` /
`delegates_to_automation:` frontmatter. `/oc-ops coverage` last, reconciling before it
speaks.

---

## Sequencing

| Phase | Effort | Ship |
|---|---|---|
| P0 | hours | **now** — 0.2 through 0.5 are minutes and are pure honesty fixes |
| P0.7 | hours | **before P1** — non-negotiable ordering |
| P1 offline half | ~40 lines + a test | first real work |
| P2 | ~60 lines, read-only | parallel with P1 |
| P1 online half | in `deploy-lag.yml` | after the offline half proves out |
| P3, P4 | days | after P1 |
| P6–P8 | days | last |
| P5 | — | deferred pending an answerable question |

The principle the adversarial review kept returning to: **put each half of a check where its
failure degrades correctly.** Offline invariants belong in `npm test`, where a failure is a
red PR someone can fix. Online observations belong in a daily canary, where a failure is a
missed alert. Nothing belongs in a gate whose failure mode is "the maintainer learns to
click bypass."

---

## Part 3b — Auto-invocation: the answer

**The question:** how do we fix the fact that skills don't auto-invoke each other?
**The answer:** you don't. Model-mediated invocation is a 5.4% sampler suggestion, not a
control-flow primitive. Stop depending on it, and split the 38 declared edges by what
failure costs.

### Both candidate binding surfaces failed under test

**MCP tool descriptions — dead end as distributed.** The server exposes 6 tools
(`src/lib/mcp/server.js:79-148`), five read-only. But it is connected in **zero** sessions
on this machine (`~/.claude.json` `mcpServers` is empty; no `.mcp.json` anywhere), and the
product deliberately tells Claude Code users not to connect it:

> "Already on **Claude Code**? You don't need this — drop `skills/` into `.claude/skills/`."
> — `mcp/README.md:11`

Skills and MCP are separate channels. Skill users never see those descriptions. The
`artifact-design` mechanism is unavailable without changing distribution.

**CLAUDE.md — the evidence inverts the hypothesis.** Delivery *is* privileged (system
prompt, every session, under "IMPORTANT: These instructions OVERRIDE any default
behavior"). But the head-to-head runs backwards:

| | `CLAUDE.md:14` | `oc-git-ops/SKILL.md:223` |
|---|---|---|
| Text | **"Staging must come from `main`"** | **"Before … `git commit`, invoke the oc-bug-check skill."** |
| Position | system prompt, override banner | line 223, read once on invoke |
| Enforcement | **none** | `PreToolUse` deny hook, same PR |
| Outcome | **violated**, self-documented (`7303ab6`, verified off-main) | obeyed |

The worse-positioned directive is the better-obeyed one, because someone built a gate for
it. Every CLAUDE.md rule that holds is held by gitignore, CI, or a hook. Two more prose-only
directives are unexecuted: `did.json` was never committed (leaving a broken `did:web` live
in production), and the session-start command has no `SessionStart` hook.

**There is no persuasion-based fix. There never was.**

### ⚠ Correction to this plan's own P1

v3 ranked "required CI status check" as the strongest enforcer. **The ruleset was created
`2026-04-25` — three months before the measurement window — and was `enforcement: active`
throughout.** Every one of the 101 commits, the 78 Codex commits, and the 87 transcripts
passed all four required checks.

So CI's *measured* effectiveness against the observed failures is **zero**. Not because the
surface is wrong — it is still the only one reaching a second agent — but because its
assertions (`npm ci`, `checkpoint:validate`, `sync-bundles:check`, `npm test`, `npm run
build`, `astro check`, Playwright) say **nothing about whether a gate ran**.

The lesson: *adding CI does not help. Adding the right assertion to CI helps.* Any proposal
must state what it asserts that existing CI does not.

### Two more constraints, both load-bearing

**A checkpoint can never be evidence.** `write_checkpoint` is a public MCP tool
(`src/lib/mcp/server.js:134`) and the agent authors the file anyway. The existing bug-check
hook gates on self-attestation — any agent can write `verdict: PASS`. Gates must **re-run
the check**, and bind the verdict to `git write-tree` output so a stale or forged PASS is
*non-matching*, not merely old.

**Every enforcer opchain builds lives in opchain's repo.** `scripts/gates.mjs`,
`gates.yml`, ruleset `15551339`, `scripts/deploy.mjs` — all singletons in one repository.
For a user's repo the whole design collapses to one Claude-only hook reading agent-authored
JSON. **Gate ownership must invert:** opchain's job is to *generate and install* a gate the
consumer repo owns, then *verify the installation* — not to run one.

### What actually ships

**Gate edges (11 declared, 6 load-bearing) — mechanical enforcement, no prose.**

1. **`scripts/deploy.mjs` preflight.** The single highest-value item, and the only genuinely
   new chokepoint: `git merge-base --is-ancestor HEAD origin/main` for `--staging`. That
   file is 99 lines with zero branch logic and zero occurrences of "audit". It finally
   enforces `CLAUDE.md:14` against the 2026-05-13 incident, needs no checkpoint, no auth,
   no new context. Ship it alone, first.
2. **Gate logic as an exported function + Vitest assertion**, copying the
   `tests/release-surfaces.test.js` / `check-release-surfaces.mjs` precedent. It rides the
   *already-required* `Worker — build, test, catalog verify` context — no `gh api` ruleset
   mutation, no admin action, no Dependabot deadlock. State explicitly what it asserts that
   current CI does not.
3. **The pre-deploy audit gate ships as WARN**, with an appended bypass ledger, until
   oc-code-auditor's 14 criticals are triaged and an oc-security-auditor checkpoint exists.
   Ratchet to block after a month green. Use provenance (`verified_for_sha`, already a live
   convention) rather than a freshness window.
4. **`/oc-repo init-gates`** — the inversion. Detects the stack, writes a committed
   dependency-light gate runner *into the consumer repo*, writes a CI workflow for their
   forge, prints the exact `gh api rulesets` call, then re-reads the ruleset to confirm the
   context string matches the workflow `name:` byte-for-byte. Until this exists, say plainly
   that gate enforcement covers opchain.dev and repos that run it — **not "the 11 GATE edges."**

**Composition edges (27) — discoverability, not enforcement.** They will never fire
autonomously. Commands move invocations from the 5.4% bucket to the 66% bucket; they do not
create autonomy. Ship the plugin `commands/` tree as **pure addition** (~20 real entry
points; 192 verbs cannot all become commands). Do **not** delete the ~172 verb strings from
descriptions — the zip channel is the majority install and those strings are the only
surface with a measured non-zero rate.

**Vocabulary — honesty only.** Delete `auto-invokes` (21 sites) and `Trigger liberally`
(24 sites). The first names a capability that has never once occurred in 87 transcripts;
the second has a measured effect of zero and is the sentence that made everyone believe the
graph was live. Defer the 8-verb → 2-verb normalization and the 29-skill `edges:`
frontmatter until at least one gate is enforced end-to-end in a repo that is not opchain.

### ⚠ Major revision — auto-invocation IS buildable; opchain ships the wrong artifact

The claim "you can't make skills fire automatically" is **wrong**, and this plan asserted it
twice before checking. Verified against Claude Code plugin docs:

| Surface | Fires without model choice? | Notes |
|---|---|---|
| Skill `description` | **No** | 0/87 transcripts — the measured dead end |
| MCP tools | **No** | Model must still choose. And Claude Code does **not** wire the MCP server-level `instructions` field into the system prompt — that surface does not exist |
| `PreToolUse` hook | **Yes** | Blocks a tool call; `permissionDecisionReason` is fed back to the model as explicit feedback — it can redirect ("run X first") |
| `UserPromptSubmit` hook | **Yes** | Injects `additionalContext` **on every user turn** — the same per-turn persistence class as a tool description |
| `SessionStart` hook | **Yes** | Injects context once per session; a `compact` matcher re-injects after compaction |
| `PostToolBatch` hook | **Yes** | Gates between tool calls and the next model turn |
| `agent`-type hook | **Yes** | Runs a **subagent** at a lifecycle event — literally auto-invocation, no description matching |
| `prompt`-type hook | **Yes** | Runs an LLM evaluation at a lifecycle event |

20+ hook events exist (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
`PostToolBatch`, `Stop`, `SubagentStart/Stop`, `PreCompact/PostCompact`, `SessionEnd`, …) and
five hook *types* (`command`, `http`, `mcp_tool`, `prompt`, `agent`).

**A plugin bundles all of it in one install** — `skills/`, `hooks/hooks.json`, `commands/`,
`agents/`, `.mcp.json` — via `/plugin marketplace add` + `/plugin install`. Plugin slash
commands are **real registered commands** in the `/` autocomplete, not strings inside a
description. `${CLAUDE_PLUGIN_ROOT}` resolves at hook execution time, which is exactly the
portability problem that killed the repo-relative hook path.

**This is already proven in-repo.** `.claude/hooks/checkpoint-hygiene.sh` (Stop) and
`pre-commit-bugcheck.sh` (PreToolUse) both work today — the Stop hook fired during this very
session, blocked the turn, and forced a checkpoint write that no prose had achieved in 27
days. The mechanism works. `make-skills-zip.sh` just doesn't package it:
`find skills/ -type f -perm +111` → **0**.

**So the diagnosis changes from "impossible" to "distribution bug."** The two enforcers that
demonstrably work exist in exactly one repo because opchain ships a markdown zip instead of a
plugin. `oc-git-ops/SKILL.md:241-245` accurately describes a working safety net that ships to
nobody.

**Revised priority:** the plugin moves from "defer until a gate works elsewhere" to **the
main event**. Concretely:

- **Gate edges** → `PreToolUse` deny with a redirect reason, plus `agent`-type hooks for
  checks that need real work done. Shipped in `hooks/hooks.json`, pathed via
  `${CLAUDE_PLUGIN_ROOT}`.
- **Composition edges** → **correction to Part 3b**: these are *not* limited to named
  invocation. `UserPromptSubmit` can inject current pipeline state ("phase: design;
  ux-engineer has not run") into **every turn**. That is the per-turn persistence that made
  `artifact-design` the only autonomous trigger in 87 transcripts. Not deterministic, but a
  different class of surface than a description read once.
- **Real slash commands** replace the 192 declared-but-unregistered verbs (~20 genuine entry
  points).

**Verify before betting on it:** `prompt`- and `agent`-type hooks are the most powerful and
least familiar pieces here, and this table is sourced from documentation, not from a test in
this repo. Build one end-to-end — a plugin with a single `PreToolUse` gate — and confirm it
fires in a repo that is not opchain, before converting 29 skills.

### Honest limits

- **Nothing gates a second agent at the moment of action.** `PreToolUse` is Claude-Code-only;
  git hooks die to `-c core.hooksPath=/dev/null`; Codex authored 78 of 101 commits. CI is the
  only enforcer reaching Codex and it is post-hoc — the unverified commit gets written, it
  just cannot merge. Pre-action cross-agent enforcement is not achievable with anything
  opchain can ship today.
- **The plugin serves install flow 01 only.** Flow 04 *is* Codex — the exact agent CI exists
  to catch — and can never receive it.
- **Merge candidates don't exist.** `oc-stack-forge` has 3 callers plus documented standalone
  use; `oc-dash-forge` has 4. Only `oc-signal-forge` fits the profile, and its problem is
  discoverability, not redundancy. There is no consolidation win.
- **After all of it, opchain is a set of skills a user invokes by name, with four gates that
  hold because CI and a deploy script hold them.** If the product promise is autonomous
  chaining, *the promise* is what needs rewriting. The prose has been rewritten several
  times and has never once worked.

---

## Part 4 — What did not survive

**Six of six adversarial verifiers refuted every design in the v1/v2 lineage**, across
prior-art, binding-force, portability, enrollment, and bypass lenses. Killed: git-hook-primary
enforcement (one flag); the `.githooks` installer (arming is prose-gated); MCP deny-lists
(per-connector UUIDs, unmatchable); probe-based gates (a hook subprocess has no MCP client);
the telemetry CI invariant (unsatisfiable — permanently red, repair is deleting the feature);
the `RULESET_READ_TOKEN` PAT (unverifiable prerequisite, Dependabot deadlock); and
`audit-head` as a peer job (self-referential auditor).

**And once, memorably, the design process reproduced the failure it was analyzing:** a
design agent proposed `skills/pipeline.json` without reading the plan in the same worktree
that already claimed that path with an incompatible schema.

**RCA-3 self-refuted 23 of 66 findings**, including its own top-severity draft item (Xcode
Cloud as a second ungated release path — it has never once succeeded, so `action_required`
was the failure state, not "pending"). That discipline is why its surviving numbers are
usable, and it is the standard the other two RCAs should be re-read against.

---

## What to keep

Three independent audits converge on the same place. The failure is coverage, enforcement,
and liveness — not the model. The checkpoints that exist reconstructed 13 releases of
history. `doctor` already encodes the right idea and is disabled by one conjunction.
`verify-release-candidate.mjs` withstood every attack lane and hard-blocked a bad release.
opchain's own ruleset is the working reference implementation of the gate this whole plan
argues for.

The enforcement primitive exists, works, and is already running here. It was applied to one
repo out of three — and the catalog told users it was applied everywhere.
