# Checkpoints

Living **session state docs** for opchain skills. One JSON file per skill:

```
.checkpoints/
├── README.md                          ← you are here
├── orchestrator.checkpoint.json
├── ux-engineer.checkpoint.json
├── app-architect.checkpoint.json
└── git-ops.checkpoint.json
```

Each file is a snapshot of where that skill left off — what was decided,
what's pending, what would need to be redone if the session ended.

## Why tracked in git

The original `checkpoint-protocol` spec said `.checkpoints/` should be
gitignored — fine for a local dev box, broken for Claude Code on the web
where the worker is ephemeral. Tracking them in git means:

- A new session on a new machine can resume by reading these files.
- Reviewers see the "thinking" state in PRs alongside the code change.
- `npm run checkpoint:status` is the canonical "where did I leave off?" command.

These are docs, not strict protocol artifacts — keep them readable, keep
them honest, don't sweat the byte budget.

### Exception: bug-check

`bug-check.checkpoint.json` is **gitignored, not tracked.** Bug-check
has no resumable state by design — its SKILL.md says it "always runs
fresh — no continue/restart prompt." Every `/bugcheck` invocation
rewrites `updated_at`, `step`, `progress_summary`, `last_run.*`,
`run_history`, and `streak`, which used to generate 2-3 spurious merge
conflicts per PR. The pre-commit hook reads the file locally and
handles the missing-file case by prompting `/bugcheck run` before the
first commit on a fresh clone.

## Schema (loose, validated in CI)

| Field | Required | Type | Notes |
|---|:-:|---|---|
| `protocol_version` | ✓ | `"1.0"` | Bump if the schema breaks. |
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
| `skill_state` |   | object | Freeform — private to the owning skill. |

Validation runs in CI via `npm run checkpoint:validate`. The validator is
`scripts/checkpoint.mjs` — pure Node, no deps. It enforces required
fields + the `status` enum + filename-skill consistency.

## Tooling

```bash
# Print a human-readable summary of every checkpoint.
npm run checkpoint:status

# Validate every .checkpoint.json against the schema.
npm run checkpoint:validate

# Update a field on a checkpoint (creates the file if missing).
node scripts/checkpoint.mjs update <skill> --status=in_progress --step=...
```

## Merge driver

`.gitattributes` maps every `<skill>.checkpoint.json` to a custom merge
driver (`scripts/merge-checkpoint.mjs`) that auto-resolves telemetry-only
conflicts. Two PRs that both ran `/bugcheck` will bump `updated_at` and
`skill_state.last_run.at` to different "now" values; the driver picks
the side with the newer `updated_at` for those fields and only raises a
real conflict on substantive content (`progress_summary`, `next_actions`,
`progress_table`, etc.). The driver is registered per-clone by
`npm prepare`, so `npm install` is the only setup step.

## Resume protocol (informal)

When starting a new session on this repo:

1. `npm run checkpoint:status` — see where every skill left off.
2. Pick the skill with `status: in_progress` (or the most recent `updated_at`).
3. Read its `next_actions[0]` and start there.
4. Read `context_primer.key_decisions` to load context without re-reading the codebase.

That's the whole protocol. Skills don't auto-write; the assistant updates
the relevant file at sensible inflection points (after a PR merges, after
a phase completes, when blocked).
