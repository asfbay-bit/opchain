---
title: "What a checkpoint actually contains"
description: "A checkpoint is how opchain survives the session. Here's the actual schema — field by field — and why each one exists. The anatomy of the file that makes resume work."
date: "2026-06-24"
author: opchain
pillar: engineering
tags: [engineering, checkpoints, architecture]
---

We argue a lot that [the context window isn't
memory](/blog/2026-06-24-why-your-ai-coding-agent-forgets) and that the fix is to
write state to a file. This post opens that file. If a checkpoint is the thing
that lets a skill pick up where it left off across sessions, machines, and
teammates, it's worth knowing exactly what's in one and why.

Every opchain skill writes one JSON file to `.checkpoints/<skill>.checkpoint.json`.
It's tracked in git — not gitignored — for a deliberate reason we'll get to. Here's
the anatomy.

## The identity fields

```json
{
  "protocol_version": "1.0",
  "skill": "oc-app-architect",
  "project": "Recipe app",
  "project_dir": "/Users/you/recipe-app",
  "created_at": "2026-06-24T10:00:00Z",
  "updated_at": "2026-06-24T14:30:00Z"
}
```

`protocol_version` is the version of the schema itself — it's there so the format
can evolve without silently misreading old files. `skill` must match the filename;
a validator enforces this so a checkpoint can't be mislabeled. `project` and
`project_dir` anchor the checkpoint to a specific codebase, which is what lets one
machine resume work another machine started — the path and name travel with the
state.

The two timestamps do more work than they look. `created_at` is set once and never
changes. `updated_at` is rewritten on every save, and it's the field a
cross-session resume sorts on to answer "which skill did I touch most recently?"
It's also how tooling flags **drift** — an `in_progress` checkpoint whose
`updated_at` is two weeks old is a signal that something stalled.

## The position fields

```json
{
  "phase": "design-approved",
  "step": "generating punch list",
  "status": "in_progress",
  "progress_summary": "Spec and design approved. Stack is Astro + Cloudflare. Now decomposing the design into a build checklist."
}
```

This is the "where am I" core. `phase` and `step` are skill-defined coordinates —
oc-app-architect's phases run discovery → spec → design → sprint plan → build, and
the checkpoint records which gate you've cleared. `status` is a small enum
(`in_progress | blocked | complete | failed`) that downstream tooling and the
orchestrator read to decide what's actionable.

`progress_summary` is the one human-readable paragraph. When you start a new session
and run `checkpoint:status`, this is what you read. It exists because a machine-state
enum tells *Claude* where things are, but a person resuming after a week needs prose
— "here's the situation in three sentences." The validator even warns if it grows
past ~1,200 characters, because a summary you have to scroll isn't a summary.

## The memory fields

This is where a checkpoint stops being a status line and becomes actual durable
memory:

```json
{
  "context_primer": {
    "key_decisions": ["auth: none — static site", "no client DB"],
    "generated_files": ["spec/00-overview.md", "design/style-book.html"],
    "user_preferences": ["terse commit messages", "no emoji in UI"]
  },
  "next_actions": ["generate the punch list", "decompose sprints"],
  "blockers": []
}
```

`key_decisions` is the antidote to the failure mode where an agent re-opens a
settled question. It stores **conclusions, not deliberation** — "auth: none,"
full stop. There's no transcript to re-read and second-guess; the decision is
stated as a decision, so the next session honors it instead of relitigating it.
That distinction — conclusion over conversation — is the whole reason a checkpoint
beats "paste yesterday's chat back in."

`next_actions` is ordered, and the next session reads `[0]` first. It's the answer
to "what do I do right now," written by the version of you (or Claude) who had full
context, handed to the version who has none yet.

`blockers` carries anything stuck — each with a description and, critically,
whether it `needs: user_decision`. That flag is how the system knows the difference
between "Claude is working" and "Claude is waiting on *you*," which is the
difference between a glance and an interruption.

## The private field

```json
{
  "skill_state": {
    "last_run": { "verdict": "PASS", "at": "2026-06-24T14:30:00Z" },
    "streak": { "passes": 12 }
  }
}
```

`skill_state` is freeform and private to the owning skill. oc-bug-check stashes its
last verdict and pass streak here; oc-app-architect stashes sprint scores. The
schema deliberately doesn't constrain it, because each skill knows what it needs to
remember and the protocol shouldn't try to anticipate all of it. The
[pre-commit gate](/skills/oc-bug-check), for instance, reads `skill_state.last_run.verdict`
to decide whether to allow a commit — the checkpoint isn't just a record, it's an
input to live behavior.

## Why it's in git

Here's the decision that surprises people: `.checkpoints/` is **committed**, not
gitignored. The original protocol spec said to ignore it — sensible for a local dev
box. It's wrong for [Claude Code on the web](/architecture), where the worker is
ephemeral and a new session starts on a fresh clone with no local state. Tracking
checkpoints in git means:

- A new session on a new machine resumes by reading files that came down with the
  clone.
- Reviewers see the "thinking state" in the PR diff, next to the code change.
- `checkpoint:status` works on any checkout, for anyone.

There's a cost — two sessions that both bump `updated_at` create a merge conflict —
so opchain ships a custom merge driver that auto-resolves timestamp-only conflicts
and only raises a real one on substantive content. The state being shared is worth
a little plumbing to keep it conflict-free.

## The shape of resume

Put it together and resume is almost boring, which is the goal. On a new session a
skill:

1. reads its checkpoint,
2. shows you `phase`, `step`, `status`, and the top of `next_actions`,
3. honors `key_decisions` without re-asking,
4. continues from `next_actions[0]`.

No transcript replay. No "remind me what we decided." No redesigning the thing it
already designed. The file did the remembering, because that's the file's entire
job.

A checkpoint isn't a log and it isn't a summary. It's a small, structured,
purpose-built handoff from the session that had context to the one that doesn't.
That's the unglamorous machinery under every opchain skill — read more in
[the architecture](/architecture), or see why
[externalizing state](/blog/2026-06-24-why-your-ai-coding-agent-forgets) is the
whole game.
