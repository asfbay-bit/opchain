---
name: checkpoint-protocol
displayName: Checkpoint Protocol
version: 1.0.0
shortDesc: Session persistence across skills.
phases: [foundation]
triAgent: false
tryable: false
commands: []
description: >
  Cross-skill protocol for session persistence. Not invoked directly — every
  other opchain skill implements this JSON checkpoint contract so state
  survives across conversations.
---

# Checkpoint Protocol v1.0

A cross-skill convention for session persistence. Any skill that runs multi-step
workflows across conversations adopts this protocol to save, resume, and recover
state without the user re-explaining context.

This is a **protocol**, not a skill. It defines a file format, naming convention,
resume behavior, and integration contract that individual skills implement. Think
of it like HTTP — the spec lives here, the implementations live in each skill.

---

## Problem Statement

Claude's context resets between conversations. Multi-step skills (app-architect,
tri-dev, reverse-spec, stack-forge, code-auditor, deploy-ops, git-ops) lose all
progress when a session ends. Today:

- **reverse-spec** has a bespoke `checkpoint.md` — the most mature implementation
- **tri-dev** has file-based state (contracts, eval reports) but no formal resume
- **app-architect** has gates but zero session persistence
- **stack-forge**, **life-architect**, and others have no continuity at all

Each skill reinvents (or doesn't) its own persistence. The user pays the cost:
re-explaining context, re-reading files, and hoping Claude picks up where it left off.

---

## Core Concepts

### 1. The Checkpoint File

Every checkpoint-aware skill writes a single `checkpoint.json` file to its project
directory. JSON (not markdown) because it's machine-parseable for cross-skill reads.

**Location:** `{project-dir}/.checkpoints/{skill-name}.checkpoint.json`

Example paths:
```
/home/claude/gtrack/.checkpoints/app-architect.checkpoint.json
/home/claude/gtrack/.checkpoints/tri-dev.checkpoint.json
/home/claude/gtrack/.checkpoints/reverse-spec.checkpoint.json
```

Multiple skills can checkpoint the same project simultaneously without collision.

### 2. Checkpoint Schema

```jsonc
{
  // === HEADER (required) ===
  "protocol_version": "1.0",
  "skill": "tri-dev",                    // Skill that owns this checkpoint
  "project": "gtrack",                   // Human-readable project name
  "project_dir": "/home/claude/gtrack",  // Absolute path
  "created_at": "2026-03-31T14:00:00Z",
  "updated_at": "2026-03-31T15:30:00Z",

  // === PROGRESS (required) ===
  "phase": "build-loop",                 // Current phase name (skill-defined)
  "step": "sprint-2-eval-round-1",       // Current step within phase
  "status": "in_progress",               // in_progress | blocked | complete | failed
  "progress_summary": "Sprint 1 passed (8.2/10). Sprint 2 generator built, evaluator running.",

  // === PROGRESS TABLE (required) ===
  // Ordered list of all phases/steps with completion status
  "progress_table": [
    { "id": "planning",       "label": "Planner",          "status": "complete" },
    { "id": "sprint-1",       "label": "Sprint 1: Auth",   "status": "complete" },
    { "id": "sprint-2",       "label": "Sprint 2: CRUD",   "status": "in_progress" },
    { "id": "sprint-3",       "label": "Sprint 3: UI",     "status": "not_started" }
  ],

  // === CONTEXT PRIMER (required) ===
  // Dense, self-contained summary. A new session reads ONLY this + generated files
  // to resume work. Must be complete enough that re-reading the full codebase or
  // re-running prior phases is unnecessary.
  "context_primer": {
    "key_decisions": [
      "Stack: Hono + D1 + Workers. Auth: WebAuthn passkeys.",
      "Two users: Aidan (admin), Dan (viewer). User IDs in D1.",
      "Sprint 1 delivered auth + session middleware. All tests pass."
    ],
    "generated_files": [
      "spec.md",
      "sprint-plan.md",
      "sprints/sprint-1/contract.md",
      "sprints/sprint-1/eval-round-1.md",
      "sprints/sprint-1/eval-round-2.md",
      "src/auth/passkey.ts",
      "src/middleware/session.ts"
    ],
    "user_preferences": [
      "Prefers table-based layouts",
      "Terminal/dark aesthetic",
      "Direct, concise communication"
    ]
  },

  // === BLOCKERS & OPEN QUESTIONS (optional) ===
  "blockers": [
    {
      "id": "b1",
      "description": "Evaluator flagged missing rate limiting on auth endpoints",
      "blocking": "sprint-2",
      "needs": "user_decision",  // user_decision | code_fix | external_dep
      "proposed_resolution": "Add rate-limit middleware in sprint 2 scope"
    }
  ],

  // === NEXT ACTIONS (required) ===
  // What the next session should do FIRST. Ordered by priority.
  "next_actions": [
    "Read evaluator report: sprints/sprint-2/eval-round-1.md",
    "Fix rate limiting gap flagged in blocker b1",
    "Re-run evaluator on sprint 2"
  ],

  // === SKILL-SPECIFIC STATE (optional) ===
  // Freeform object for skill-internal state that doesn't fit the schema above.
  // Other skills should NOT read this section — it's private to the owning skill.
  "skill_state": {
    "current_sprint": 2,
    "iteration": 1,
    "max_iterations": 3,
    "pass_threshold": 6.0,
    "scores": {
      "sprint-1": { "final": 8.2, "rounds": 2 }
    }
  }
}
```

### 3. Status Values

| Status | Meaning | Resume behavior |
|---|---|---|
| `in_progress` | Work is actively happening | Pick up from `step` |
| `blocked` | Waiting on user decision or external dependency | Show blockers, ask for resolution |
| `complete` | All phases done | Inform user, offer next steps |
| `failed` | Unrecoverable error occurred | Show failure context, offer restart or manual fix |

---

## Resume Protocol

When any checkpoint-aware skill is invoked and a checkpoint exists for the current
project, follow this sequence:

### Step 1: Detect

```
Check: {project-dir}/.checkpoints/{skill-name}.checkpoint.json exists?
  YES → read it, go to Step 2
  NO  → start fresh (normal skill flow)
```

### Step 2: Orient

Read the checkpoint. Display a brief status to the user:

```
RESUMING: [skill] on [project]
Last session: [updated_at, relative time]
Status: [status] — [progress_summary]
Progress: [X/Y phases complete]
Next: [first item from next_actions]
```

### Step 3: Confirm

Ask the user ONE question:

```
Continue from here, restart from scratch, or show me the full checkpoint?
```

- **Continue** → Read `context_primer` and `next_actions`, load referenced
  `generated_files`, proceed.
- **Restart** → Archive current checkpoint (rename to `.checkpoint.json.bak`),
  start fresh.
- **Show full** → Display the complete checkpoint for review, then ask continue/restart.

### Step 4: Prime Context

Before doing any new work:

1. Read `context_primer.key_decisions` — this IS your session context
2. Read `context_primer.generated_files` — but only the ones relevant to the
   current step (don't read all files from all sprints if you're on sprint 3)
3. Check `blockers` — if any are `needs: user_decision`, ask before proceeding
4. Start with `next_actions[0]`

### Step 5: Re-validate (optional but recommended)

If the checkpoint is >24h old, do a quick consistency check:
- Do the referenced files still exist at the expected paths?
- Does the project directory structure match what the checkpoint expects?
- Flag any drift: "Checkpoint references `src/auth/passkey.ts` but the file has
  been modified since the last session. Want me to re-read it?"

---

## Write Protocol

### When to Write

Update the checkpoint after:

| Event | Action |
|---|---|
| Phase/step completed | Update `progress_table`, `step`, `progress_summary` |
| Key decision made | Append to `context_primer.key_decisions` |
| File generated | Append to `context_primer.generated_files` |
| Blocker discovered | Add to `blockers` |
| Blocker resolved | Remove from `blockers` (or mark resolved) |
| User confirms something | Append to `key_decisions` |
| Session ending (user says bye, context getting long) | Full checkpoint write |

### How to Write

Always **read → merge → write**. Never blindly overwrite — another skill might have
written a checkpoint for the same project in a sibling file, and the current skill's
own file might have been manually edited.

```bash
# Pseudocode
existing = read_json("{project}/.checkpoints/{skill}.checkpoint.json") or {}
updated = merge(existing, new_state)
updated["updated_at"] = now()
write_json(updated)
```

### Checkpoint Size Budget

Keep checkpoints under **4KB**. The entire point is that a new session can read this
instead of re-reading the full project. If `context_primer.key_decisions` exceeds
~20 items, consolidate older decisions into a summary paragraph and keep only the
recent ones as individual items.

---

## Cross-Skill Reads

Skills can read each other's checkpoints (read-only) for coordination:

| Reader | Reads | Why |
|---|---|---|
| tri-dev | app-architect checkpoint | Know which spec sections are approved |
| deploy-ops | tri-dev checkpoint | Know which sprints have passed QA |
| git-ops | any skill checkpoint | Know what files to commit |
| code-auditor | reverse-spec checkpoint | Know what analysis has been done |

**Rules:**
- Read the `header`, `progress`, `progress_table`, `context_primer`, and `blockers`
- Never read `skill_state` — it's private to the owning skill
- Never write to another skill's checkpoint
- If you need to coordinate, write to your own checkpoint and reference the other:
  `"depends_on": "app-architect checkpoint shows spec approved at 2026-03-31T12:00:00Z"`

---

## Migration: Existing Skills

Each skill that adopts this protocol needs minimal changes:

### reverse-spec (already close)
- **Current:** Writes `checkpoint.md` (markdown) to `reverse-spec-output/`
- **Migration:** Convert to JSON schema, move to `.checkpoints/reverse-spec.checkpoint.json`
- **Effort:** Small — structure already matches, just format change

### tri-dev (file-based state, no resume)
- **Current:** State lives in `tri-dev-config.md`, `sprints/*/contract.md`, `sprints/*/eval-round-*.md`
- **Migration:** Add checkpoint writes after each sprint pass/fail. Resume protocol reads
  checkpoint first, then loads the relevant sprint files.
- **Effort:** Medium — needs resume logic added to `/td-build` and `/td-status`

### app-architect (gates, no persistence)
- **Current:** Gates are conversational — "do you approve?" lives only in chat history
- **Migration:** After each gate approval, write checkpoint with phase status and approved
  decisions. Resume protocol re-presents the gate status on session start.
- **Effort:** Medium — needs checkpoint writes at every gate + resume at `/status`

### stack-forge (no persistence)
- **Current:** Outputs are inline or in app-architect spec files
- **Migration:** When used standalone or for `/feature`, write checkpoint tracking which
  decisions have been made and which sprint plans generated.
- **Effort:** Small — mostly just tracking decision-tree state

### Future skills (code-auditor, deploy-ops, git-ops)
- **Built with protocol from day 1** — no migration needed

---

## /checkpoint Command

Any skill that adopts this protocol should recognize `/checkpoint` as a utility command:

```
/checkpoint         Show current checkpoint status for active project
/checkpoint show    Display full checkpoint contents
/checkpoint reset   Archive current checkpoint and start fresh
/checkpoint list    List all checkpoints in the project directory
```

This is a **cross-skill** command — any checkpoint-aware skill handles it the same way.
The behavior is identical regardless of which skill the user is currently in.

---

## Directory Convention

```
project-dir/
├── .checkpoints/
│   ├── app-architect.checkpoint.json
│   ├── tri-dev.checkpoint.json
│   ├── reverse-spec.checkpoint.json
│   └── deploy-ops.checkpoint.json
├── spec/           (app-architect output)
├── sprints/        (tri-dev output)
├── src/            (project source)
└── ...
```

The `.checkpoints/` directory is:
- Git-ignored by default (add to `.gitignore` in scaffold phase)
- Not copied to `/mnt/user-data/outputs/` (internal state, not a deliverable)
- Readable by any skill in the ecosystem

---

## Principles

1. **Read the checkpoint, not the chat history.** Chat history is gone next session.
   The checkpoint is the only truth that survives.
2. **Write often, write small.** Every completed step gets a checkpoint update.
   The cost of writing is negligible; the cost of losing progress is a full session.
3. **Context primer > full re-read.** A good context primer means the new session
   never needs to re-read the entire codebase or all generated files. 20 lines of
   dense summary beats 200 lines of re-analysis.
4. **JSON for machines, summaries for humans.** The checkpoint is JSON so skills can
   parse it. The `progress_summary` and `next_actions` are human-readable so the user
   can understand what's happening.
5. **Private state stays private.** `skill_state` is an opaque bag — other skills
   don't read it, and the protocol doesn't define its contents.
6. **Never block on a missing checkpoint.** If the checkpoint is corrupt, missing, or
   from an incompatible version, the skill starts fresh and tells the user why.
