# Checkpoints

Living **session state docs** for opchain skills. One JSON file per skill:

```
.checkpoints/
├── README.md                          ← you are here
├── oc-orchestrator.checkpoint.json
├── oc-ux-engineer.checkpoint.json
├── oc-app-architect.checkpoint.json
└── oc-git-ops.checkpoint.json
```

Each file is a snapshot of where that skill left off — what was decided,
what's pending, what would need to be redone if the session ended.

## Why tracked in git

The original `oc-checkpoint-protocol` spec said `.checkpoints/` should be
gitignored — fine for a local dev box, broken for Claude Code on the web
where the worker is ephemeral. Tracking them in git means:

- A new session on a new machine can resume by reading these files.
- Reviewers see the "thinking" state in PRs alongside the code change.
- `npm run checkpoint:status` is the canonical "where did I leave off?" command.

These are docs, not strict protocol artifacts — keep them readable, keep
them honest, don't sweat the byte budget.

### Exception: oc-bug-check

`oc-bug-check.checkpoint.json` is **gitignored, not tracked.** Bug-check
has no resumable state by design — its SKILL.md says it "always runs
fresh — no continue/restart prompt." Every `/oc-bugcheck` invocation
rewrites `updated_at`, `step`, `progress_summary`, `last_run.*`,
`run_history`, and `streak`, which used to generate 2-3 spurious merge
conflicts per PR. The pre-commit hook reads the file locally and
handles the missing-file case by prompting `/oc-bugcheck run` before the
first commit on a fresh clone.

## Schema (loose, validated in CI)

| Field | Required | Type | Notes |
|---|:-:|---|---|
| `protocol_version` | ✓ | `"1.0"` \| `"1.1"` | On-disk wire format. `1.1` (v1.6) added `cost`/`eval_scores`/`telemetry_handle`; both validate, new writes stamp `1.1`. |
| `skill` | ✓ | string | Must match the filename: `<skill>.checkpoint.json`. |
| `project` | ✓ | string | Human-readable project name. |
| `project_dir` | ✓ | string | Absolute path to the project. |
| `created_at` | ✓ | ISO-8601 UTC | Don't change once set. |
| `updated_at` | ✓ | ISO-8601 UTC | `Date.toISOString()` on every write. |
| `phase` | ✓ | string | Skill-defined. |
| `step` | ✓ | string | Skill-defined. |
| `status` | ✓ | enum | `in_progress \| blocked \| complete \| failed` |
| `progress_summary` | ✓ | string | One-paragraph human-readable. |
| `progress_table` |   | array | Ordered list of `{ id, label, status }`. |
| `context_primer` |   | object | `{ key_decisions[], generated_files[], user_preferences[] }` |
| `blockers` |   | array | `{ id, description, blocking, needs, proposed_resolution }` |
| `next_actions` |   | string[] | Ordered, the next session reads `[0]` first. |
| `pm_refs` |   | array | `{ provider, id, role?, url? }` — PM tickets touched (skill release 1.2+). |
| `cost` |   | object | `{ total_usd?, budget_usd?, by_phase?, by_model?, currency? }` — LLM spend attribution + budget ceiling (oc-cost-ops, wire 1.1+). |
| `eval_scores` |   | array | `{ rubric, score, max?, at?, dimensions? }[]` — eval scores vs a stable rubric (oc-bug-check / oc-code-auditor / oc-prompt-ops, wire 1.1+). |
| `telemetry_handle` |   | string \| object | Opt-in local-metering link `{ enabled, id?, sink?, since? }` — default OFF (oc-telemetry-ops, wire 1.1+). |
| `skill_state` |   | object | Freeform — private to the owning skill. |

Validation runs in CI via `npm run checkpoint:validate`. The validator is
`scripts/checkpoint.mjs` — pure Node, no deps. It enforces required
fields + the `status` enum + filename-skill consistency.

## Mandatory lifecycle writes

Every checkpoint-aware skill owns its checkpoint at lifecycle boundaries. The
write is part of the workflow, not optional cleanup after the fact:

| Event | Required write |
|---|---|
| Session resume | Restamp `updated_at`, record `resumed_from` when known, and revalidate or replace `next_actions[0]` before continuing. |
| Session pause / user says stop / context is getting long | Write a compact `progress_summary`, current `step`, blockers, and the exact next action to run first. |
| Phase or gate completion | Update `progress_table`, `phase`, `step`, summary, and next action before moving on. |
| User decision | Append the decision to `context_primer.key_decisions`, clear matching blockers, and restamp. |
| Blocker found or cleared | Add/remove the blocker and set `status` to `blocked` or back to `in_progress`. |
| Cross-skill handoff | Current skill writes the handoff reason, named artifacts, and receiving skill before the receiver acts. |
| Branch / PR opened | Record branch, PR number, scope, touched artifacts, and pending verification. |
| PR merged | Mark PR-wait actions complete and replace them with deploy/release/follow-up actions. |
| Deploy to staging/prod | Record environment, commit SHA, health result, user-visible route checked, and next rollout step. |
| Release cut/ship | Reconcile release-relevant skill checkpoints to the shipped release state. |
| Merge conflict or rebase resolution | Restamp if conflict resolution changed generated files, summaries, or next actions. |
| `checkpoint doctor` drift found | Write a reconciliation checkpoint or add an explicit blocker; don't leave drift only in console output. |

The rule of thumb: if a future session would be misled without the write, the
current skill must write before it hands control back.

## Tooling

```bash
# Where did I leave off? (full summary; --brief = just the top action + blockers)
npm run checkpoint:status
node scripts/checkpoint.mjs status --brief

# What should I do RIGHT NOW? (priority engine — no oc-orchestrator registry needed)
node scripts/checkpoint.mjs next

# Is any checkpoint drifting from reality? (git history + filesystem cross-check)
node scripts/checkpoint.mjs doctor          # add --online to compare /api/health vs HEAD
node scripts/checkpoint.mjs doctor --fail-on-warnings

# Validate every .checkpoint.json against the schema (CI runs this).
npm run checkpoint:validate                 # --strict also fails on warnings

# Utility commands shared by /checkpoint across skills.
node scripts/checkpoint.mjs list             # list all checkpoint files
node scripts/checkpoint.mjs show [skill]     # display full JSON for one/all checkpoints
node scripts/checkpoint.mjs reset <skill>    # archive current file into .checkpoints/history/

# Update a field (creates the file if missing); done = complete the top next action.
node scripts/checkpoint.mjs update <skill> --status=in_progress --step=...
node scripts/checkpoint.mjs done <skill>
```

`next` is drift-aware: before it recommends work, it checks queued actions
against completed tokens from checkpoints plus recent git history. If an action
references already-merged PR work or a completed ticket, `next` skips to the
first fresh action or recommends checkpoint reconciliation instead of telling the
next agent to redo shipped work.

### Status glyphs (canonical legend)

One vocabulary, used by `checkpoint` output and the oc-orchestrator alike:

| Glyph | Meaning |
|---|---|
| ✅ | complete |
| 🔄 | in_progress |
| ⏳ | not_started |
| 🚫 | blocked (has an open blocker) |
| ⛔ | a decision is waiting on **you** (`blockers[].needs: user_decision`) |
| ⚠ | stale / drift (e.g. in_progress and untouched >7 days) |

## Merge driver

`.gitattributes` maps every `<skill>.checkpoint.json` to a custom merge
driver (`scripts/merge-checkpoint.mjs`) that auto-resolves telemetry-only
conflicts. Two PRs that both ran `/oc-bugcheck` will bump `updated_at` and
`skill_state.last_run.at` to different "now" values; the driver picks
the side with the newer `updated_at` for those fields and only raises a
real conflict on substantive content (`progress_summary`, `next_actions`,
`progress_table`, etc.). The driver is registered per-clone by
`npm prepare`, so `npm install` is the only setup step.

> ⚠️ **The driver runs on local `git merge` only.** GitHub's server-side
> "Update branch" / auto-merge buttons do **not** invoke it, so a checkpoint
> conflict resolved there can ship invalid JSON and fail CI (this happened on
> 2026-05-15). If two PRs both touch a checkpoint, resolve it with a local
> `git merge` (driver runs), and always `npm run checkpoint:validate` before
> pushing. Rotating volatile `skill_state` telemetry into
> `.checkpoints/history/` keeps the conflict surface small in the first place.

## Resume protocol (informal)

When starting a new session on this repo:

1. `npm run checkpoint:status` — see where every skill left off.
2. Pick the skill with `status: in_progress` (or the most recent `updated_at`).
3. Read its `next_actions[0]` and start there.
4. Read `context_primer.key_decisions` to load context without re-reading the codebase.

That's the whole protocol. Skills do not run a background auto-writer, but the
assistant must update the relevant file at the mandatory lifecycle boundaries
above: resume, pause, phase/gate completion, user decisions, blockers,
cross-skill handoff, PR open/merge, deploy, and release ship.
