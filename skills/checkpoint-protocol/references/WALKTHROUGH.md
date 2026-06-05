# Checkpoint Protocol — a resume, end to end

A concrete walkthrough of the thing the protocol exists for: a brand-new session,
zero chat history, picking up exactly where the last one left off. Nothing here is
hypothetical — every command is real (`scripts/checkpoint.mjs`).

## 1. New session boots — "where did I leave off?"

```bash
$ npm run checkpoint:status
```

```
⛔ 1 decision(s) waiting on you:
   • [orchestrator] PR #232 (compare redesign) — merge or close?

# Session state

| Skill        | Phase        | Step                     | Status      | Updated | Age        |
|--------------|--------------|--------------------------|-------------|---------|------------|
| app-architect| launched     | v1.4-shipped             | complete    | …       | 2d         |
| git-ops      | post-merge   | wave-merged-deploy-pending | in_progress | …     | 1d         |
| stack-forge  | v1.4-impl    | packs-shipped            | in_progress | …       | ⚠ 24d stale|
```

The banner is the point: before reading anything else, you know there's a decision
parked on *you*. The `⚠ 24d stale` flag tells you stack-forge probably drifted.

## 2. "What should I actually do first?"

```bash
$ node scripts/checkpoint.mjs next
```

```
NEXT ACTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Skill:  git-ops  (in_progress — post-merge-wave/wave-merged-deploy-pending)
Why:    2026-05-31 PR-review wave: cleared 11 open PRs in one session.
Action: Hand off to deploy-ops: production is ~12 PRs behind main …
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

`next` applies the priority hierarchy (blocked-on-decision → failed → gate →
mid-work → …) across every checkpoint and returns **one** action. No registry, no
orchestrator required.

## 3. Sanity-check before trusting any of it

```bash
$ node scripts/checkpoint.mjs doctor
```

```
⚠ [git-ops] project_dir "/Users/aidan/repos/opchain" doesn't exist here (authored on another machine?)
⚠ [git-ops] next_action references #225, which already appears as completed/merged — may be stale
⚠ [stack-forge] in_progress but last updated 24d ago — stale? resume or reset
```

`doctor` is the guardrail against the failure mode that bit this repo three times:
a checkpoint confidently telling you to do work that already shipped. Resolve the
real ones (here: stack-forge is stale, and a couple of next_actions are done).

## 4. Do the work, then close the loop

You ship the deploy hand-off. Mark it done — no hand-editing JSON:

```bash
$ node scripts/checkpoint.mjs done git-ops
✓ git-ops: completed "Hand off to deploy-ops: production is ~12 PRs behind main …"
  Up next: Verify staging /api/health matches local HEAD before prod deploy
```

`done` pops `next_actions[0]` into a bounded `recently_done` log and restamps
`updated_at`. The next session's `status`/`next` now point at the *new* top action.

## 5. Record a decision / advance a phase

```bash
# Restamp + update fields (the validator runs after every write):
$ node scripts/checkpoint.mjs update git-ops \
    --step=deploy-handed-off \
    --next_actions:json='["Verify staging health, then npm run deploy"]'
✓ wrote git-ops.checkpoint.json
```

That's the whole loop: **status → next → doctor → do work → done/update**. Every
write is validated, every read survives the next session because `.checkpoints/`
is tracked in git.
