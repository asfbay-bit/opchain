# Checkpoint System Audit - 2026-06-29

## Scope

This audit reviewed the checkpoint protocol, local checkpoint state, CI gates,
skill instructions, and the current `origin/main` v1.7 skill set.

Local checkout:

- CWD: `/Users/aidanelsesser/repos/opchain`
- Branch during audit: `codex/1-7-release`
- State: clean working tree, behind `origin/main` by 6 commits
- Local HEAD observed by `checkpoint doctor --online`: `a76947a`
- `origin/main` audited in a throwaway worktree at commit `8fb1f7f`
- Production `/api/health` version observed by doctor: `47d187c`

Commands run:

- `git fetch --prune`
- `git status --short --branch`
- `npm run checkpoint:status`
- `npm run checkpoint:next`
- `npm run checkpoint:doctor`
- `node scripts/checkpoint.mjs doctor --online`
- `npm run checkpoint:validate`
- `npm run checkpoint:validate -- --strict`
- `npx vitest run tests/checkpoint.test.js`
- `npm run sync-bundles:check`
- Same validate/status/next/doctor checks against `origin/main` in a temp worktree

## Executive Summary

The checkpoint system is useful and has a real implementation: JSON schema
validation exists, `status`/`next`/`doctor` work, tests cover the validator and
priority engine, CI runs basic validation, bundle sync is enforced, and the merge
driver is installed for local checkpoint conflict reduction.

The weakness is that the system currently detects more problems than it prevents.
The protocol is not prescriptive enough about when a checkpoint must be written,
so agents can complete real lifecycle transitions and leave no durable state
behind. The checked-in checkpoints are stale enough that `checkpoint:next` points
at an already-merged PR. `doctor` catches that drift, but CI does not run doctor,
and `next` does not use doctor findings before recommending work. The new v1.7
skills landed on `origin/main`, but they are not fully integrated into the
orchestrator map or checkpoint contract. Several protocol promises are not
implemented in the CLI, and one local-only checkpoint exception is pointed at the
wrong filename.

Net: the checkpoint layer is a good foundation, but it is not yet reliable as the
single source of truth for "what should an agent do next?"

## Findings

### P0 - Checkpoint writes are advisory, not mandatory

The checkpoint protocol says to "write often" and lists example events, but it
does not define a mandatory lifecycle write policy. There is no enforced rule
that a skill must update its checkpoint when a session resumes, pauses, hands off
to another skill, opens a PR, merges a PR, deploys, hits a blocker, clears a
blocker, or changes branches.

Why it matters:

This explains the stale-state symptoms observed elsewhere in the audit. Agents
can do the real work and still forget to make the durable state match reality.
The result is a checkpoint layer that works when someone is careful, but is not
dependable as protocol infrastructure.

Prescriptive write triggers that should become mandatory:

| Event | Required write |
|---|---|
| Session resume | Restamp `updated_at`, record `resumed_from`, and either keep or replace `next_actions[0]` after revalidation |
| Session pause / user says stop / context is getting long | Write a compact `progress_summary`, current `step`, blockers, and exact `next_actions[0]` |
| Phase or gate completion | Update `progress_table`, `phase`, `step`, summary, and next action before continuing |
| User decision | Append the decision to `context_primer.key_decisions`, resolve any matching blocker, and restamp |
| Blocker found or cleared | Add/remove blocker and set `status` to `blocked` or back to `in_progress` |
| Cross-skill handoff | Current skill writes the handoff reason and named artifacts; next skill reads before acting |
| Branch / PR opened | Record branch, PR number, scope, files/artifacts, and pending verification |
| PR merged | Mark PR wait actions complete and replace them with deploy/release/follow-up actions |
| Deploy to staging/prod | Record environment, commit SHA, health result, user-visible route checked, and next rollout step |
| Release cut/ship | Reconcile all release-relevant skill checkpoints to the shipped release state |
| Merge conflict or rebase resolution | Restamp checkpoint if conflict resolution changed generated files, summaries, or next actions |
| `checkpoint:doctor` drift found | Write a reconciliation checkpoint or create an explicit blocker; do not leave drift only in console output |

Important nuance:

This does not mean resurrecting the old "bot opens a checkpoint stamp PR after
every merge" approach. That was already identified as noisy under branch
protection. The better contract is: the agent or skill performing the lifecycle
transition owns the checkpoint write as part of that same workflow, and CI blocks
known-drift states before they become the next agent's instructions.

### P0 - `checkpoint:next` recommends stale work

`npm run checkpoint:next` points to `oc-app-architect` and tells the next agent to
watch PR `#351` CI. `checkpoint:doctor` flags that same PR as already
completed/merged.

Observed local and on `origin/main`:

- `checkpoint:next`: `Watch PR #351 CI to green`
- `checkpoint:doctor`: `next_action references #351, which already appears as completed/merged`
- Offline doctor: 22 warnings
- Online doctor: 23 warnings, including live `/api/health` version drift

Why it matters:

The protocol's whole value proposition is "resume from the checkpoint, not chat
history." If `next` recommends already-shipped work, the checkpoint layer becomes
a trap for the next agent.

Likely cause:

`pickNext` ranks by status/blockers/gates/updated_at only. It does not call the
doctor drift checks, does not exclude next actions that point at merged PRs, and
does not degrade stale queued work.

Relevant code:

- `scripts/checkpoint.mjs`: `pickNext` ranks checkpoints by status and timestamp.
- `scripts/checkpoint.mjs`: `doctor` independently detects merged PR/ticket drift.

### P0 - CI passes non-strict validation while the repo fails strict validation

`npm run checkpoint:validate` passes. `npm run checkpoint:validate -- --strict`
fails 6 checkpoints:

- `oc-code-auditor`: oversized `progress_summary`
- `oc-git-ops`: oversized `progress_summary`
- `oc-orchestrator`: oversized `progress_summary`
- `oc-stack-forge`: oversized `progress_summary`
- `oc-telemetry-ops`: no `progress_table`, no `context_primer`
- `oc-ux-engineer`: oversized `progress_summary`

CI currently runs only non-strict validation:

- `.github/workflows/ci.yml`: checkpoint validation step runs `npm run checkpoint:validate`

Why it matters:

These warnings are exactly the resumability problems the protocol claims to solve:
long summaries become mini chat histories, missing `context_primer` forces
re-reading, and missing progress tables make resume position ambiguous.

### P0 - New v1.7 skills are not fully integrated into checkpoint routing

`origin/main` has the three v1.7 skills:

- `oc-signal-forge`
- `oc-modularize-ops`
- `oc-fleet-ops`

But the shared orchestrator map still lists the old upstream/downstream rows and
only mentions the new skills in the general awareness note:

- The upstream/downstream map on `origin/main` does not add rows for the three new
  skills.
- Handoff points do not include app-architect -> signal-forge, modularize ->
  migration/fleet, or fleet -> monitoring/git.
- The awareness section says v1.7 adds the three skills, but does not make them
  operational in routing.

Why it matters:

The checkpoint protocol says cross-skill reads depend on the maintained
upstream/downstream map. If new skills are absent there, an agent can know the
skills exist but still fail to pass state through the right checkpoint handoff.

### P1 - New skill checkpoint sections are under-specified

The new skill bodies have domain-specific checkpoint sections, but they do not
fully teach the shared contract.

`oc-signal-forge`:

- Has `/oc-signal status`, but does not expose shared `/checkpoint`.
- Defines `progress_table` and `skill_state.signals[]`.
- Does not define `next_actions` examples.
- Does not define `context_primer` expectations.
- Its `references/` section says companion docs are planned but not written.

`oc-modularize-ops`:

- Has a good "Session Persistence" section.
- Does not expose shared `/checkpoint` in the command reference.
- Does not define `next_actions` examples.
- Does not define `context_primer` expectations.
- Planned reference docs are not written.

`oc-fleet-ops`:

- Exposes `/checkpoint`.
- Defines `progress_table` and `skill_state`.
- Does not define explicit resume behavior.
- Does not define `next_actions` examples.
- Does not define `context_primer` expectations.
- Planned reference docs are not written.

All three:

- Lack `references/checkpoint-protocol.md` copies in the current `origin/main`
  tree.
- Pass build because the catalog validator checks frontmatter and command flags,
  not checkpoint-contract completeness.

Why it matters:

The validator requires non-empty `next_actions` for `in_progress` checkpoints, but
the new skill docs do not tell the agent what those actions should look like.
That creates a gap between valid JSON and useful resume behavior.

### P1 - Bug-check's local-only checkpoint exception points at the wrong file

`.gitignore` says the local-only exception is:

- `.checkpoints/oc-bug-check.checkpoint.json`

But the tracked file is:

- `.checkpoints/bug-check.checkpoint.json`

The tracked file contains:

- `"skill": "bug-check"`

Meanwhile `skills/oc-bug-check/SKILL.md` and `oc-git-ops` refer to:

- `.checkpoints/oc-bug-check.checkpoint.json`

Why it matters:

The repo explicitly says bug-check should be local-only because it rewrites on
every gate run and creates merge conflicts. The ignore rule misses the actual
tracked file, so the noisy file remains tracked while the docs claim the opposite.

### P1 - Protocol promises `/checkpoint show|reset|list`, but the CLI does not implement them

The protocol says every checkpoint-aware skill should recognize:

- `/checkpoint`
- `/checkpoint next`
- `/checkpoint doctor`
- `/checkpoint show`
- `/checkpoint reset`
- `/checkpoint list`

The CLI currently implements:

- `status`
- `next`
- `doctor`
- `validate`
- `update`
- `done`
- `init`

Missing:

- `show`
- `reset`
- `list`

Why it matters:

Skills can honestly advertise `/checkpoint show/reset/list` while the shared tool
cannot execute them. That makes the cross-skill utility command non-uniform.

### P1 - `pm_refs` status surface is documented but not implemented

The protocol says `checkpoint:status` includes a one-line PM summary per skill.
The validator checks `pm_refs` shape when present, but `cmdStatus` does not render
PM summaries.

Why it matters:

PM ticket continuity is one of the cross-skill state promises. If `pm_refs` are
hidden from status, downstream agents still have to inspect raw JSON or re-ask.

### P1 - Obsolete `scripts/checkpoint.sh` references remain

`oc-reverse-spec` still says:

- `bash scripts/checkpoint.sh exists <project-dir> oc-reverse-spec`

But the current protocol says the canonical writer is `scripts/checkpoint.mjs`,
and skills do not bundle their own writers.

Why it matters:

This is an instruction-level footgun. An agent following the skill literally will
try to use a deprecated or missing path instead of the schema-validating CLI.

### P2 - Direct invocation through `/tmp` can silently no-op

During the `origin/main` temp-worktree audit, running:

- `node /tmp/opchain-main-audit.../scripts/checkpoint.mjs validate`

emitted no checkpoint output and exited 0. Running through the canonical path:

- `node /private/tmp/opchain-main-audit.../scripts/checkpoint.mjs validate`

worked.

Likely cause:

The module entrypoint check compares `import.meta.url` to
`pathToFileURL(process.argv[1]).href`. On macOS, `/tmp` is a symlink to
`/private/tmp`, so the two URLs do not match and the CLI dispatch never runs.

Why it matters:

This is rare in normal repo use, but temp worktrees and CI scratch paths often
use symlinks. A CLI that exits 0 without running is worse than a hard failure.

### P2 - `project_dir` is too machine-specific

Many checkpoints use:

- `/home/user/opchain`

The local checkout is:

- `/Users/aidanelsesser/repos/opchain`

`doctor` flags these, which is useful, but it creates noise on every cross-machine
checkout.

Why it matters:

The protocol is explicitly meant to survive across machines and ephemeral runners.
Absolute paths help locate local files, but they should not dominate the health
surface when the repo root is otherwise correct.

### P2 - Current checkpoint data is stale across releases

Even on `origin/main` after v1.7, many checkpoint summaries still talk about v1.5
or v1.6 work:

- `oc-orchestrator`: v1.5 shipped/live, next theme v1.6
- `oc-app-architect`: v1.6 PR #351 waiting
- `oc-git-ops`: v1.5 wave and old PR follow-ups

Why it matters:

Release tasks have advanced, but the checkpoint state has not been reconciled to
the actual release line. The docs say release-ops reads skill checkpoints to draft
what shipped; stale checkpoints poison that input.

## What Is Working

- JSON validation exists and catches schema errors.
- `next_actions` is a hard error for `in_progress` checkpoints.
- `pm_refs`, `cost`, `eval_scores`, and `telemetry_handle` are validated when present.
- `doctor` catches real drift: merged PRs in `next_actions`, missing generated
  files, wrong `project_dir`, stale `in_progress`, and online deployment mismatch.
- Focused checkpoint tests pass: `npx vitest run tests/checkpoint.test.js` passed
  27 tests.
- Bundle sync passes: `npm run sync-bundles:check` reported all bundled skill
  references in sync.
- The merge driver is installed in local git config and `.gitattributes` maps
  `.checkpoints/*.checkpoint.json` to `merge=opchain-checkpoint`.

## Self-Improvement Plan

### Phase 0 - Reconcile the live checkpoint state

Goal: make `checkpoint:next` truthful today.

Actions:

1. Refresh `origin/main` checkpoint state after v1.7.
2. Mark stale v1.5/v1.6 release tasks complete or rotate them into history.
3. Replace `oc-app-architect` PR `#351` next action with the actual next release
   or maintenance action.
4. Add `progress_table` and `context_primer` to `oc-telemetry-ops`.
5. Shorten oversized `progress_summary` values and move detail into
   `progress_table`, `context_primer`, or `.checkpoints/history/`.
6. Re-run:
   - `npm run checkpoint:next`
   - `npm run checkpoint:doctor`
   - `npm run checkpoint:validate -- --strict`

Exit criteria:

- `checkpoint:next` does not point at merged PRs or closed tickets.
- `checkpoint:doctor` reports zero stale-action warnings.
- Strict checkpoint validation passes.

### Phase 1 - Make checkpoint writes mandatory at lifecycle boundaries

Goal: turn "write often" into an enforceable protocol.

Actions:

1. Add a mandatory write-trigger matrix to `oc-checkpoint-protocol` and
   `.checkpoints/README.md`.
2. Add per-skill "write obligations" sections that name exactly when that skill
   writes, especially at gates, handoffs, PR transitions, deploys, and pauses.
3. Add a `checkpoint.mjs reconcile <skill>` helper that updates common lifecycle
   fields safely:
   - `--event=session-resume`
   - `--event=session-pause`
   - `--event=phase-complete`
   - `--event=handoff`
   - `--event=pr-opened`
   - `--event=pr-merged`
   - `--event=deploy-staging`
   - `--event=deploy-prod`
   - `--event=doctor-drift`
4. Add `done_when` to high-risk `next_actions` so completion can be verified with
   a shell command or GitHub/API check.
5. Make `checkpoint:doctor` recommend a concrete write command for each drift
   finding, not just print a warning.
6. Add a release-ops rule: no release is complete until relevant skill
   checkpoints have been reconciled to the shipped state.

Exit criteria:

- Every skill has explicit write obligations, not just a generic checkpoint
  schema block.
- An assistant-driven PR merge, deploy, release cut, handoff, or pause always
  produces a checkpoint write or an explicit "no checkpoint needed because..."
  entry.
- `checkpoint:doctor` drift creates an actionable reconciliation path.

### Phase 2 - Fix naming and command contract mismatches

Goal: remove instruction-level contradictions.

Actions:

1. Decide the canonical bug-check checkpoint filename:
   - Preferred: `.checkpoints/oc-bug-check.checkpoint.json`, matching the skill id.
2. Rename or migrate `.checkpoints/bug-check.checkpoint.json`.
3. Update `.gitignore`, `.checkpoints/README.md`, `oc-bug-check`, and `oc-git-ops`
   to one filename.
4. If bug-check is truly local-only, remove the tracked file from git and ignore the
   canonical path.
5. Replace all `scripts/checkpoint.sh` references with `node scripts/checkpoint.mjs`.
6. Implement or remove documented `/checkpoint show|reset|list`.

Exit criteria:

- `rg "checkpoint.sh|bug-check.checkpoint|oc-bug-check.checkpoint"` shows only
  intentional, consistent references.
- `/checkpoint` command docs match implemented CLI subcommands.

### Phase 3 - Make `next` drift-aware

Goal: prevent stale checkpoints from becoming active recommendations.

Actions:

1. Extract doctor token harvesting into reusable pure functions.
2. Teach `pickNext` to either:
   - skip next actions that reference already-merged PRs/tickets, or
   - surface them as "needs reconciliation" instead of "do this."
3. Add a `doctor --fail-on-warnings` or `doctor --strict` mode.
4. Add CI step after validation:
   - `node scripts/checkpoint.mjs doctor --fail-on-warnings`
5. Add tests for:
   - merged PR in `next_actions` does not become recommended work
   - stale `in_progress` moves behind fresh valid work
   - doctor strict mode exits non-zero

Exit criteria:

- A stale merged PR can never be the top `checkpoint:next` action.
- CI fails when checked-in checkpoint state tells an agent to redo shipped work.

### Phase 4 - Add skill-contract linting

Goal: make new skills fail build if they are not checkpoint-ready.

Actions:

Extend `scripts/gen-skills-catalog.mjs` or add `scripts/check-skill-contracts.mjs`
to enforce, for every non-foundation skill:

1. `SKILL.md` declares or documents shared `/checkpoint` behavior.
2. `SKILL.md` includes its own checkpoint location.
3. `SKILL.md` mentions `next_actions`.
4. `SKILL.md` mentions `context_primer` or explains why resume does not need one.
5. `SKILL.md` has a "when to write" table or equivalent.
6. No skill references `scripts/checkpoint.sh`.
7. Skills with PM-tool integration use `pm_refs` for cross-skill ticket references
   instead of hiding all ticket state under `skill_state`.
8. Required shared refs are present, or the repo explicitly chooses a no-copy policy.

Apply immediately to the v1.7 skills:

- Add checkpoint reference/contract to `oc-signal-forge`.
- Add shared `/checkpoint` command exposure to `oc-modularize-ops`.
- Add resume/next/context examples to `oc-fleet-ops`.
- Add the three new skills to the upstream/downstream map and handoff table.

Exit criteria:

- A newly added skill cannot pass catalog validation with only frontmatter and a
  domain narrative.
- The three v1.7 skills have operational checkpoint handoffs, not just status prose.

### Phase 5 - Close implementation gaps in the checkpoint CLI

Goal: make the tool match the protocol surface.

Actions:

1. Implement `show`, `list`, and `reset`.
2. Render `pm_refs` in `status`.
3. Add `status --json`, `next --json`, and `doctor --json` for other tools and
   future MCP surfaces.
4. Normalize the `isMain` check through `realpath` so `/tmp` symlinks cannot no-op.
5. Canonicalize `project_dir` checks:
   - Warn only when the path is wrong and cannot be reconciled to the current repo.
   - Consider adding a stable `project_id` or `repo_remote` field.
6. Add tests for symlinked invocation paths.

Exit criteria:

- Protocol command docs and CLI help are identical.
- PM ticket context is visible without opening raw JSON.
- The CLI never exits 0 without dispatching when invoked directly.

### Phase 6 - Operationalize release-time checkpoint hygiene

Goal: prevent release surfaces from advancing while checkpoint truth stays behind.

Actions:

1. Add a release-ops checklist item: reconcile checkpoints before "release complete."
2. Add a release guard that compares current release chip/changelog against
   checkpoint summaries and flags stale older-release claims.
3. Require `checkpoint:doctor` clean before release PR merge.
4. Rotate old release details into `.checkpoints/history/` at the release boundary.

Exit criteria:

- After a release, `checkpoint:status` reads like the shipped release, not the
  previous planning branch.
- Release-ops can safely use checkpoints as changelog input.

## Recommended First PR

Make the first improvement PR small and sharp:

1. Add the mandatory write-trigger matrix to the protocol and README.
2. Reconcile stale checkpoints so `checkpoint:next` is truthful.
3. Fix the bug-check filename mismatch.
4. Remove `scripts/checkpoint.sh` references.
5. Add `doctor --fail-on-warnings` and run it in CI after current warnings are fixed.
6. Add one regression test for the `/tmp` symlink no-op bug.

That PR would turn the current checkpoint system from "detects drift if someone
remembers to ask" into "blocks drift before it misleads the next agent."
