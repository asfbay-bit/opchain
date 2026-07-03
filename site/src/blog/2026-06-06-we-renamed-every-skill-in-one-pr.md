---
title: "We renamed every skill in one PR"
description: "All 18 skills gained an oc- prefix in one PR: identity, flags, commands, site, docs. Why namespacing was worth it — and what the rename taught us about drift."
date: "2026-06-06"
author: opchain
pillar: engineering
tags: [engineering, naming, migration]
---

Yesterday we renamed every skill in the catalog. `app-architect` became
`oc-app-architect`, `/discover` became `/oc-discover`, and so on eighteen
times — identity, slash commands, feature flags, site routes, docs, and
cross-references, in one PR. There are famously two hard problems in
computer science: cache invalidation, naming things, and off-by-one errors.
We'd like to nominate a fourth: *renaming things you already named*.

Here's why we did it, why all at once, and the drift lesson that outlasted
the diff.

## Why prefix at all

Skills live in a shared namespace on the user's machine, next to every other
skill from every other vendor they've installed. An unprefixed
`app-architect` is a land grab — it works right up until someone else ships
an `app-architect`, and then trigger routing becomes a coin flip that we
lose half of. Worse, generic names collide *semantically* before they
collide literally: a model deciding which skill to route can confuse two
unrelated `deploy` skills long before their files conflict.

`oc-` costs three characters and buys collision-proof identity: skill ids,
slash commands (`/oc-deploy`), flag names (`skills.registry.oc-deploy-ops.enabled`),
and checkpoint files all become unambiguous about whose they are. Every
ecosystem relearns this — Java packages, npm scopes, Kubernetes
annotations — usually after the first collision. We chose to learn it at 18
skills instead of 50.

## Why one PR instead of a gentle migration

The migration-brain instinct says: alias the old names, deprecate slowly,
give everyone a window. We did the opposite — one atomic cutover — because
of what a skill name actually *is*: a routing key that appears in prose.
Trigger descriptions, docs, checkpoints, flag registries, and the model's
own instructions all reference names as text. Run old and new names in
parallel and you double the routing surface, teach half the docs one
dialect, and guarantee the aliases outlive the window — legacy aliases
always do. The kindest version of a rename that must happen is the one that
happens *completely*.

Atomic is only kind if it's verified, so the same change taught the build to
enforce the convention: the catalog validator asserts directory names match
frontmatter identity, and flag validation fails on any reference the rename
missed. A rename you can't verify is just a bet that your grep was good.

## What we found in the walls

Every rename is an accidental audit. Chasing eighteen names through the
codebase surfaced every place a name had been *copied* instead of
*referenced* — hardcoded strings in site copy, a flag check reading a stale
id, docs describing commands that had quietly diverged from the commands.
None of it was broken loudly. All of it was drift, invisible until we had a
reason to walk the walls with a flashlight.

That's the general lesson, and it's bigger than naming: **identifiers that
appear in more than one place will drift unless something fails when they
do.** The rename didn't just change names; it flushed out every location
that should have been derived from a single source and wasn't. The same
week's hardening work added drift detection between the checkpoint spec and
reality for exactly this reason — reconciliation as a *check*, not a chore
someone remembers.

(Honesty footnote, house rules: the week also carried an emergency `v1.4.2`
after the website's skill downloads shipped incomplete skill trees. Not
rename-related — but a fair reminder that the team confidently renaming
everything is the same team that shipped half a zip file. Verification over
vibes, always.)

## If you're holding an unprefixed namespace

Prefix earlier than feels necessary; the cost curve only bends one way. Do
it atomically, with the build enforcing the convention from the same commit.
And treat the rename as the audit it secretly is — the stragglers you find
are a map of every future drift bug, delivered early.

All 18 skills answer to their new names in the [library](/skills). The old
names answer to no one, which was the point.
