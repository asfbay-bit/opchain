# Coordination-gaps punchlist

Companion to `coordination-gaps-overhaul.md` (v3). Every locator below was re-read and
verified 2026-07-20; corrections from that pass are folded in. Design rationale lives in the
overhaul doc — this file is the actionable list.

**Verification status:** 17 locators checked, 4 corrected. Corrections are marked ⚠.

---

## Tier 0 — Honesty fixes (minutes, no design risk)

These make the system stop asserting things that are not true. None changes behavior; all
change what a future reader (human or model) believes.

### 0.2 — Delete the phantom hook claim
**Where:** `skills/oc-git-ops/SKILL.md:241-246` ⚠ (*not* `:241-247` — 247 is a `---` separator; `:240-245` is equivalent)
**What:** Remove the paragraph claiming a `PreToolUse(Bash)` hook "blocks `git commit`… The hook is the safety net."
**Why:** The hook exists **only in this repo** (`.claude/hooks/pre-commit-bugcheck.sh`, wired at `.claude/settings.json:10`). It ships to every installed copy as a false claim. Already flagged internally at `docs/audits/2026-07-04-portability-audit.md:467`. Three independent RCAs cited it as real enforcement; it reached zero of the three repos audited.
**Replace with:** advisory wording, explicitly marked unenforced.

### 0.3 — Fix the telemetry diagram
**Where:** `skills/oc-telemetry-ops/SKILL.md:88`
**What:** `every skill run ──(opt-in)──► .checkpoints/usage.sqlite` becomes a dashed "you must invoke this" edge naming `npm run telemetry -- record`.
**Why:** Nothing calls `telemetry.mjs record`. The only reference repo-wide is the `package.json` alias. The diagram asserts automatic metering that has never existed.
**Care:** Lines 89-91 align `│`/`▼` at column 40. Preserve the column or the ASCII diagram skews.

### 0.4 — Set telemetry consent to false
**Where:** `.checkpoints/oc-telemetry-ops.checkpoint.json`
**What:** `telemetry_handle.enabled: true` → `false`.
**Why:** Consent is stored in a **tracked** file (`telemetry.mjs:26`); the sink is **gitignored** (`.gitignore:96-97`). `enabled: true` + absent sink is therefore the guaranteed steady state on every clone, worktree, and CI runner — permanently, by construction. It was set by `6d01e63`, authored by the web-UI identity `asfbay-bit` from a sandbox. A tracked flag cannot describe machine-local state.
**Follow-on (optional):** if opt-in must persist, move consent to a gitignored local file and leave only schema/version tracked.

### 0.5 — Correct six sandbox `project_dir` values
**Where:** `.checkpoints/{oc-app-architect, oc-code-auditor, oc-orchestrator, oc-stack-forge, oc-telemetry-ops, oc-ux-engineer}.checkpoint.json`
**What:** `/home/user/opchain` → the real path.
**Why:** Six of twelve checkpoints describe a destroyed cloud-sandbox filesystem. `checkpoint doctor` already emits a warning for each. It is tracked state that misleads every future reader, and it is the mechanism behind the four-checkpoint freeze at `2026-06-22T16:35:00Z`.

### 0.9 — Remove the auto-stamp recommendation
**Where:** `skills/oc-orchestrator/SKILL.md:136` (sentence wraps `:134-137` — keep the wrap grammatical)
**What:** Drop the "optional post-merge auto-stamp workflow" clause.
**Why:** It contradicts `oc-checkpoint-protocol/SKILL.md:342-353` and `:482-487` ⚠ (*not* `:342-355`), which forbid it twice — opchain shipped that workflow and removed it 2026-06-22 (`66107d1`) after branch-protection deadlock produced ~two dozen permanently-open bot PRs. A merged RCA has since re-recommended it, citing this line.

---

## Tier 1 — Detection (hours; makes existing drift visible)

### 0.1 — Fix the staleness conjunction
**Where:** `scripts/checkpoint.mjs:650` **and `:556`** ⚠
**What:** Remove the `&& data.status === "in_progress"` guard; make staleness status-aware.
**Why:** A checkpoint marked `complete` while asserting a shipped release is exactly the artifact that rots, and exactly the one exempted. Concretely today:

| age | checkpoint | status | flagged? |
|---|---|---|---|
| 27d | oc-ux-engineer, oc-stack-forge, oc-orchestrator, oc-git-ops | complete | **no** |
| 23d | oc-telemetry-ops | in_progress | yes |
| 16d | oc-app-architect | in_progress | yes |
| 9d | oc-release-ops | in_progress | yes |

The detector flags three checkpoints aged 9–23 days and misses **all four of the oldest**.

**⚠ Not a one-line fix.** The identical guard appears twice: `:650` in `doctor` (`data.status`) and `:556` in the status-table renderer (`d.status` — different variable, so a naive replace-all hits only one). Editing one makes `doctor` and `status` disagree.
**⚠ Threshold care:** `STALE_DAYS = 7` (`:100`) applied to `complete` will fire on nearly every checkpoint. Use a separate, longer threshold for `complete` (14d suggested) or the signal drowns.

### 0.8 — Wire `doctor` into CI
**Where:** `.github/workflows/ci.yml` (beside `:31-32`)
**What:** Add a `npm run checkpoint:doctor` step. The script alias **already exists** at `package.json:40`; it is simply not wired into any of the 7 workflows.
**Why:** Doctor detects 23 real drift warnings today and nothing runs it. The drift is discoverable and never discovered.
**⚠ Do not add `--online`:** it fetches `opchain.dev/api/health`, coupling PR success to production reachability — and the Cloudflare bot challenge has already broken that endpoint for automation (`docs/runbooks/cloudflare-challenge.md`).
**⚠ Do not add `--fail-on-warnings` on day one:** 23 existing warnings would turn every unrelated PR red. Land it advisory (or `continue-on-error`), clean the warnings, then ratchet.

---

## Tier 2 — Make the gates real (the core work)

### 0.7 — Stop returning green on unread code ★ ordering-critical
**Where:** `skills/oc-bug-check/SKILL.md:253` and after `:619` ⚠
**What:** (a) `| No build script | PASS (skip) |` → **WARN** or a terminal `UNSUPPORTED`. (b) Add a Swift row to the stack table.
**Why:** The stack table (`:615-619`) covers TypeScript, Python, Go only. Two of the three audited repos are Swift. With no root `package.json`, checks 1/2/3/6/7 no-op or error, and the gate returns a **PASS-shaped verdict on code it never read**. `oc-stack-forge/packs/swift/pack.yml` already contains `swift build` / `swiftlint` / `swift test` — bug-check simply never reads the pack registry.
**★ This must land before anything that increases invocation.** Enforcing invocation against a gate that silently skips converts a silent no-op into an *invisible false green* — strictly worse than today, where the skill never fires at all.
**Care:** Insert the Swift row immediately after `:619` with exactly 5 columns. The fallback note at `:621-622` describes the unrecognized-stack path and needs a companion tweak.

### 0.6 — Make secret detection see Swift and Supabase
**Where:** `skills/oc-bug-check/SKILL.md:218-233` ⚠ (grep block proper; the stated `:216-241` also spans the heading, verdict table `:235-238`, and rationale)
**What:** Drop the `--include="*.ts"` allowlist (or add `*.swift`); add a JWT pattern (`eyJ[A-Za-z0-9_-]{10,}\.`) and `sk_test_`.
**Why:** Every secret pattern is scoped away from `*.swift`, and there is **no Supabase/JWT/`eyJ` pattern anywhere**. A hardcoded Supabase service-role key in a `.swift` file is invisible to the scanner. The service-prefix grep at `:231` also lacks `sk_test_`.
**Care:** Insert new greps after `:232`, inside the fence, to avoid disturbing the verdict table at `:235-238`.

### P1 — Gate completeness ⚠ design corrected
**Where:** new `.github/ruleset-main.json` + new test in `tests/`
**What:** A checked-in record-of-intent listing required check contexts, plus an offline assertion that every PR-triggered job in `.github/workflows/*.yml` appears in it.
**Why:** opchain **already has** an active ruleset (`main-protection`, id `15551339`) with 4 required checks matching its 4 real CI jobs. It fails closed on `startup_failure` — a required context that never reports leaves the PR pending, which is the fix for the "0 checks renders mergeable" hole. The one live gap: **renaming a job fails closed, adding one fails open, silently, forever.**

**⚠ Correction to the design:** the precedent is `tests/release-surfaces.test.js`, which **imports the exported `checkReleaseSurfaces()` function** from `scripts/check-release-surfaces.mjs` and asserts on its returned report — it does *not* shell out. The script is dual-mode via an `import.meta.url === file://${process.argv[1]}` guard. Copy that shape: export a pure function returning a structured report, keep a CLI guard, assert in Vitest. `npm test` runs at `ci.yml:66` and is transitively required via the `Worker — build, test, catalog verify` context.

**⚠ Matrix hazard:** `canary.yml:27` uses `name: Probe ${{ matrix.label }}`. GitHub reports these as `Probe (prod)` and `Probe (staging)` — matching neither the literal string nor the job key `probe`. Naive derivation produces a required name that never appears in the checks API and blocks merges forever. Derive from job key + expanded matrix, or exclude matrix jobs explicitly.
**Hard-error, not warn,** on `paths:` / `paths-ignore:` / job-level `if:` for any job in the required set — a job that can conditionally not report is not requireable.

**Explicitly dropped:** the `RULESET_READ_TOKEN` PAT (unverifiable prerequisite; **deadlocks every Dependabot PR**, since those resolve secrets from a separate store → 401 → fail closed → weekly admin bypass), any new required context, and any `verify` run from PR head (a script checked out from the branch it audits can be rewritten by that branch).

### P1-online — Live drift as a canary, never a gate
**Where:** `.github/workflows/deploy-lag.yml`
**What:** Add live-ruleset-vs-declared and a zero-checks probe over merged SHAs at rest.
**Why:** That workflow already has `permissions: issues: write` (`:31-33`), runs on `github.token` (`:107`), and implements three-way tracking-issue dedup (`:119-123` lookup, `:125-132` auto-close, `:167-174` edit-or-create). A stale credential degrades to a missed daily alert rather than a repo-wide merge block.
**⚠ Care:** dedup is an exact title match on `ISSUE_TITLE` (`:109`). A second check needs its own title or it overwrites the deploy-lag issue. Also `:105` guards on the prior step's output, so an appended step is skipped when the canary fails — give it its own condition.

---

## Tier 3 — Verification semantics

### P3a — Stop replaying unbacked audit grades
**Where:** `skills/oc-deploy-ops/SKILL.md:173-178` and `:188-193` ⚠ (second window is **24h**, not 1h)
**What:** Add a provenance condition — reuse only if the checkpoint's grade corresponds to current HEAD *and* was produced by an actual audit run.
**Why:** Both windows are freshness-only. Nothing checks that findings correspond to the code being deployed. In dose-app this let a grade-A with `findings_total: 0` — recorded for a function whose authorization predicate was broken, with zero test coverage — stand as a deploy-gate pass.

### P3b — The audit gate is a markdown table
**Where:** `skills/oc-deploy-ops/SKILL.md:197-203` ⚠ (*not* `:196-205`; 196 is blank, 205-206 are prose)
**What:** Back the thresholds with an executable check.
**Why:** A repo-wide grep for `findings_by_severity|findings_total|"grade"` across every `.mjs/.js/.cjs/.yml/.sh` returns **zero hits**. `scripts/deploy.mjs` has zero occurrences of "audit". `/oc-release verify` has no audit row at all.

### P3c — Make "complete with open criticals" invalid
**Where:** `scripts/checkpoint.mjs` validator; `STATUS_ENUM` at `:84`
**What:** Add `loop_state: open | closed | abandoned`; make `status: "complete"` invalid while `loop_state: open` or `critical > 0`.
**Why:** `.checkpoints/oc-code-auditor.checkpoint.json` is `"status": "complete"` (`:10`) with `"critical": 14, "high": 41` (`:47`), `grade: "F (portability)"` (`:49`), 2 of 157 fixed. `npm run checkpoint:validate` exits **0** — its only complaint is a summary-length warning. Nothing cross-checks status against findings.
**Care:** Land as **warn**, not error, or fix that checkpoint first — `checkpoint:validate` runs in CI and this would break it on day one.

### P3d — Promote the existing verified-provenance field ⚠ design corrected
**Where:** `skills/oc-checkpoint-protocol/SKILL.md` schema
**What:** Promote `verified_for_sha` from ad-hoc `skill_state` into the protocol, and add a `level: reviewed | verified` distinction where `verified` requires non-empty evidence.
**⚠ Correction:** I previously wrote that no reviewed-vs-verified distinction exists. `loop_state` and `open_loops` are indeed absent repo-wide — but **`verified_for_sha` already exists** in `oc-docs-forge/SKILL.md:189`, `oc-repo-ops/SKILL.md:157`, both their checkpoints, and is **consumed** by `oc-release-ops/SKILL.md:292`. Promote the existing convention rather than inventing a name; renaming it breaks that gate row.
**Why:** "Verified" currently means a model read something. In dose-app, `controls_verified` wasn't even a schema field — the checkpoint asserted a shape nothing defined and nothing validated.

### P3e — Add `/oc-audit abandon`
**Why:** `oc-migration-ops` and `oc-modularize-ops` already have explicit abandon semantics. Auditing does not, so an orphaned find→fix→verify loop reads as open forever.

---

## Tier 4 — Observability

### P2 — `scripts/skill-usage.mjs`
**What:** Machine-global, read-only, prints to stdout, **writes no sqlite**. Reads `~/.claude/projects/*/*.jsonl` and reports declared-vs-invoked.
**Why:** All three RCAs hand-reconstructed this, weeks late, from raw transcripts. The data already exists. Verification already computed the answer: **28 declared, 6 invoked in opchain; 12 machine-wide.**
**Why not sqlite:** no consumer needs history — `/dashboard` doesn't today. A store adds a schema migration, a hook, an alias table, and a privacy surface for no current reader.
**Care:** the name resolver must refuse the naive `oc-` prefix rule — `claude-api` and `anthropic-skills:reverse-spec` are live collisions with `oc-claude-api` and `oc-reverse-spec` and are **not** the same skills.

### P4 — Migration-drift canary
**What:** Scheduled diff of repo migrations against the linked remote, **joining on name, not version**, opening one deduped issue.
**Why:** MCP `apply_migration` mints versions from wall-clock, so repo and prod diverge with identical content. CI validates the repo against a fresh *unlinked* local DB — structurally blind. In gil-elsesser the drift recurred **118 minutes** after being fixed. A canary observes prod, not a tool call, so every agent and human is equally visible.
**Owner:** `oc-migration-ops`. The `apply_migration` prohibition goes in `CLAUDE.md`; the SKILL.md says **unenforced**.

---

## Tier 5 — Structural (last)

### P7a — Stable checkpoint identity ⚠ larger than it looks
**Where:** `scripts/checkpoint.mjs:204-207`, `:640`, and every write path (`:788, :799, :853, :870, :875`)
**What:** `skill_id` (immutable) + `skill` (display) + `renamed_from[]`; relax filename equality to *filename ∈ {skill} ∪ renamed_from*.
**⚠ Relaxing `:207` alone is worse than the status quo.** Three collateral facts: (1) it's a hard `errors.push`, so CI fails on mismatch; (2) `cmdDoctor:640` **reconstructs** the path from `data.skill` rather than passing the real filename, so this check can never fire under `doctor` — it's already half-dead; (3) every write path hardcodes `${skill}.checkpoint.json`, so an alias file would be readable but never writable — `checkpoint update <alias>` creates a *new* canonical file instead. Downgrading to a warning produces silent duplicate checkpoints.

### P6 — Pipeline as data
`skills/pipeline.json` with **one** owner: the stage-DAG that generates the four existing pipeline representations and fails the build on drift. (They are already mutually inconsistent — the SKILL.md copy omits five skills; `PipelineDiagram.astro` omits six.)

### P8 — Ownership declaration + `/oc-ops coverage`
`owns:` / `delegates_to_automation:` frontmatter validated by `gen-skills-catalog.mjs`, enabling the "CI covers release mechanics but no release-ops checkpoint → judgment layer unowned" detection. Then `/oc-ops coverage`, running on **every** `/oc-ops` invocation so the coordinator reconciles before it speaks.

---

## Do NOT do

| Rejected | Why |
|---|---|
| Post-merge auto-stamp workflow | Shipped and removed (`66107d1`); forbidden twice in the protocol; branch-protection deadlock + ~24 zombie PRs |
| Git-hook-primary enforcement | `git -c core.hooksPath=/dev/null commit` bypasses it while a sibling probe still reads ARMED (verified, git 2.50.1). Self-teaching: the deny message names the lever |
| `.githooks` installer via slash command | Arming depends on a skill invocation — the behavior proven not to fire. One miss = permanent silent zero coverage |
| CI assertion on `enabled && sink-absent` | Unsatisfiable: CI clones tracked consent, can never hold the gitignored sink. Permanently red; cheapest repair is deleting telemetry |
| `RULESET_READ_TOKEN` PAT | Unverifiable out-of-band prerequisite; deadlocks every Dependabot PR; manufactures habitual bypass |
| MCP tool deny-lists | Tool names are per-connector UUIDs (`mcp__<uuid>__apply_migration`) — not portably matchable |
| Probe-based gates in a hook subprocess | A spawned Node process has no MCP client; every probe returns UNVERIFIABLE |
| Tuning skill descriptions / "Trigger liberally" | That layer is inert, not weak: 24 of 29 skills carry it; zero autonomous triggers in 23 days |

---

## Sequencing

```
0.2 0.3 0.4 0.5 0.9   ← honesty fixes, minutes, no risk, ship today
        │
0.1 0.8               ← detection; makes existing drift visible
        │
0.7 ★                 ← MUST precede anything raising invocation
        │
0.6  P1(offline)  P2  ← the real work; P2 parallel
        │
P1(online)  P3  P4    ← after the offline half proves out
        │
P6  P7  P8            ← structural, last
```

`P5` (client-binary ordering) stays deferred: nothing can observe an Xcode Organizer upload.
The honest controls are a server-side required-version check at app launch and a human
release checklist.

---

## Open questions

1. **Bare-rendered skills.** Several opchain skills render in the live skill listing as names with no description — observed first-hand and independently by a verifier, but with a *different set each time*. Two candidate causes (the `governance:` key, description length) were tested and refuted. If reproducible, those skills have *zero* trigger surface. Needs a dedicated reproduction check.
2. **Is `npm test` genuinely required?** The ruleset requires `Worker — build, test, catalog verify`, which is the `ci.yml` `worker` job that runs `npm test` — so yes, transitively. Worth confirming the context string matches exactly before depending on it for P1.
3. **gil-elsesser enrollment.** It has neither branch protection nor rulesets. Creating one is scriptable (`gh api PUT /repos/:o/:r/rulesets`) but is a real out-of-band step. State it plainly rather than pretending a script self-enrolls.
