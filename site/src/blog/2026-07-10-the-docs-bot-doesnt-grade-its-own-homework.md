---
title: "The docs bot doesn't grade its own homework"
description: "Design notes on v1.8's every-PR mesh: why the author never verifies, staleness keyed to SHAs, idempotent PR comments, and gates that fail closed."
date: "2026-07-10"
author: opchain
pillar: engineering
tags: [engineering, documentation, gates, pr-workflow]
---

[Today's release post](/blog/2026-07-10-v1-8-documentation-and-repo-hygiene)
covers what v1.8 ships. This one covers how it's built, because the
interesting part of a documentation gate isn't the documentation — it's
the gate. Four design decisions carry the whole thing: the author never
verifies its own output, staleness is a first-class failure keyed to
SHAs, PR comments are idempotent surfaces, and every check fails closed.

## Why the generator can't be the verifier

An LLM asked to grade its own output grades generously. This isn't a
moral failing; it's the same distribution talking to itself. We learned
this the expensive way in the build loop — it's why
[oc-app-architect](/skills/oc-app-architect)'s evaluator runs in an
isolated context with instructions to treat "mostly works" as FAIL —
and v1.8 inherits the doctrine wholesale.

So the mesh is three skills with three jobs and three separate
checkpoints. **oc-docs-forge** writes the packet. **oc-repo-ops**
verifies it against a fail-closed checklist it did not write. And
**oc-git-ops** executes, opening the PR only on a passing verdict. The
verifier's job description is refusal: it blocks on a missing
`## Documentation` section, on docs the diff obviously demanded but
doesn't contain, on catalog surfaces that disagree with each other. When
it blocks, it chains *back* to docs-forge rather than fixing the docs
itself — the roles don't blur even in the failure path.

## The gate order is a dependency graph, not a ceremony

Every PR runs docs-forge → repo-ops → bug-check → git-ops, and the order
isn't aesthetic. The docs packet is an **input** to the readiness gate —
you can't verify a packet that doesn't exist yet, so writing precedes
checking. [oc-bug-check](/skills/oc-bug-check) runs last-before-commit
because it validates the exact bytes about to ship, and it's the gate
most likely to be invalidated by anything the earlier stages touch. Run
it first and a README edit from docs-forge makes the verdict stale
before the commit lands.

## Staleness is a failure mode, not a nuance

The subtlest way for this system to rot is a packet that was true three
commits ago. It passes every textual check — well-formed section, links
resolve, tone impeccable — and describes a diff that no longer exists.
So the docs-forge checkpoint records `verified_for_sha`, and repo-ops
compares the packet against the *current* diff, not against the packet's
own claims. A checkpoint that points at a generated file that's since
been deleted is a blocking finding, not a shrug.

This is the same doctrine that already runs opchain's build:
`gen-skills-catalog` fails the build when a skill's frontmatter drifts
from the flag registry. A document that *can* drift silently *will*, so
the only docs worth trusting are the ones something re-derives from the
artifact — an argument we'll make in full later this month.

## One durable comment, not twelve stale ones

When the packet outgrows the PR body, docs-forge posts a PR comment
under a stable marker: `<!-- opchain:oc-docs-forge:pr-docs -->`. The
marker makes the comment *addressable* — on the next push, the skill
finds and updates it instead of appending a fresh one. Anyone who has
scrolled a long-lived PR past eleven superseded bot comments to find the
one that's current understands why this is the feature. Reviewers get
one surface that is always the latest truth, and the body links to it.

## "No docs needed" requires evidence

The `## Documentation` section is mandatory even when the honest content
is "nothing user-facing changed." The failure mode this kills isn't
wrong documentation — it's absent documentation justified by nothing.
An explicit "none, because the diff only touches test fixtures" is
reviewable and falsifiable; an omitted section is neither. Silence is
not a pass.

## Where the seams show

Three things we haven't solved, in descending order of how much they
worry us. **Warnings don't block** outside strict mode — a deliberate
call to keep the gate from crying wolf, and exactly the kind of
deliberate call that dogfooding sometimes reverses. **The latency cost
per PR is unmeasured** — the mesh adds real work to every PR, and we
won't pretend to know the number until
[the telemetry](/blog/2026-06-29-telemetry-should-be-off-by-default)
has it. And **a bypass exists**, because a gate you can never override
is a gate you'll eventually work around; we've made bypassing loud
rather than impossible, and we're aware that's a bet.

Also noted for the record: this post shipped through the gate it
describes. If you're reading it, the packet passed.

## Try it on your own repo

The readiness gate's audit mode is read-only and needs no buy-in:
[install](/install), run `/oc-repo audit`, and see what it flags —
stale generated files, catalog drift, checkpoints pointing at ghosts.
The findings were already there. Now they're a list.
