---
title: "How to grow a protocol without breaking anyone"
description: "Checkpoint wire 1.1 added three fields across 27 skills and zero checkpoints broke. The additive-field playbook for evolving agent state, step by step."
date: "2026-06-30"
author: opchain
pillar: engineering
tags: [engineering, checkpoints, protocol, migration]
---

Last week, [v1.6](/blog/2026-06-25-v1-6-the-instrumented-pipeline) moved the
checkpoint protocol from wire `1.0` to wire `1.1` — three new fields
(`cost`, `eval_scores`, `telemetry_handle`) across 27 skills and every
checkpoint in every repo that uses opchain. Number of checkpoints broken:
**zero**. Number of users who had to do anything: **zero**.

That outcome is boring, and the boring was engineered. This post is the
playbook, because "how do we change the schema of the agent's memory without
lobotomizing anyone mid-project" is a question every agent system hits
eventually, usually at a worse moment than we did.

## The constraint that makes it hard

A [checkpoint](/blog/2026-06-24-what-a-checkpoint-actually-contains) is the
agent's durable memory — phase, decisions, next actions — written to
`.checkpoints/*.checkpoint.json` in the *user's* repo. Which means the
"database" you're migrating is **thousands of files you don't host, in git
histories you can't touch, read by whatever skill version happens to run
next.** There is no maintenance window. There is no `ALTER TABLE`. A `1.0`
checkpoint written in May must open cleanly under a `1.1` skill in July, and
— because users pin and lag versions — a stubbornly old skill may reopen a
file a newer one already touched.

Distributed-systems people will recognize the shape: it's schema evolution
with no coordinator, where every reader is also a writer.

## The rules

The whole discipline compresses to five rules. None are novel — that's the
point; they're Postel's law and expand/contract, applied to agent state:

1. **Additive or nothing.** New capabilities get new fields. No field is
   removed, renamed, or — the sneaky one — *repurposed*. A field name whose
   meaning changed is strictly worse than a new field, because it fails
   silently and lies while doing it.
2. **New fields are optional, and readers tolerate absence.** Every consumer
   of `cost` treats "missing" as "predates instrumentation," not as an error.
   The empty state is a first-class state.
3. **Dual-validate during the window.** The validator accepts both `"1.0"`
   and `"1.1"` — old files stay *valid*, not merely un-crashing. Validity is
   a contract; grandfathering is part of the contract.
4. **Writers stamp the new version; readers accept both.** Files upgrade on
   their next natural write — touch a checkpoint, modernize it. No big-bang
   rewrite of files the user may have diffs against.
5. **The version is data, not vibes.** `protocol_version` is a field the
   tooling branches on, not a README aspiration. If you can't `grep` which
   wire a file speaks, you don't have versioning — you have archaeology.

[oc-migration-ops](/skills/oc-migration-ops) sweeps what the natural-write
path doesn't reach, and CI runs `checkpoint:validate` so drift shows up as a
red build instead of a confused user.

## The seam we found anyway

Full disclosure, because the rollout wasn't spotless: it still surfaced a
bug — ours. The checkpoint **CLI** and the **skills** had each grown their
own idea of the schema, and by this week the two had drifted enough that
reconciling them was its own commit. Two implementations of one contract is one implementation
too many; the fix was to make the schema single-sourced and demote everything
else to a consumer. The migration didn't break any *users*, but it did break
*us*, quietly, which is the failure mode you should actually expect: protocol
drift shows up first in the tooling nobody's watching.

## Why this matters beyond opchain

Every agent product is quietly accumulating durable state — memory files,
session stores, "context" blobs. All of it has a schema, whether or not
anyone wrote it down, and all of it will need to change. The choice isn't
*whether* you have a wire protocol for agent memory; it's whether you notice
before the first breaking change teaches you.

Make the version a field. Make additions optional. Make old files valid
forever, or say loudly when they stop. The best migration is the one that
reads like a changelog footnote — ours was three fields, 27 skills, zero
tickets, and one embarrassing commit about our own CLI.

The full schema lives in
[oc-checkpoint-protocol](/skills/oc-checkpoint-protocol); the anatomy tour is
in [What a checkpoint actually
contains](/blog/2026-06-24-what-a-checkpoint-actually-contains). If you're
building your own agent memory, steal the rules — they're load-bearing and
free.
