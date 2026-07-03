---
title: "27 skills is not too many"
description: "A week ago we argued 22 small skills beat one big agent. We're at 27 now. The argument survived; the number didn't. On catalog growth without bloat."
date: "2026-07-01"
author: opchain
pillar: opinion
tags: [opinion, architecture, skillchain]
---

On June 24 we published
[Why 22 small skills beat one big agent](/blog/2026-06-24-why-small-skills-beat-one-big-agent).
The argument has aged well. The number aged like milk: within a week,
[v1.6](/blog/2026-06-25-v1-6-the-instrumented-pipeline) took the catalog to
24 and [v1.7](/blog/2026-06-26-v1-7-seams-and-signals) to **27**. If small
skills are good, and we keep adding them, the obvious heckle writes itself:
*at what number does your Unix philosophy become a junk drawer?*

Fair question. Here's the actual math of it.

## What a new skill costs you: nothing, until it's routed

The junk-drawer intuition comes from monolithic agents, where it's true. Bolt
a capability onto one big agent and every request pays for it — more system
prompt, more tools in the loop, more ways to wander. Capability N+1 taxes
requests 1 through N. That's the architecture our original post argued
against, and growth genuinely is its enemy.

A routed catalog inverts the cost model. A skill's always-loaded footprint is
its **trigger description** — a few lines that let the router pick it. The
skill's actual body loads when invoked, does its one job against its own
checkpoint, and leaves. When you run `/oc-deploy`,
[oc-fleet-ops](/skills/oc-fleet-ops) contributes nothing to your context,
your latency, or your bill. **You don't pay for `grep` while you're running
`ls`.** Your laptop's `/usr/bin` has two thousand binaries in it and has
never once felt heavy, because coexistence isn't the same as interference.

So "how many skills is too many" is the wrong denominator. The right question
is **per-task surface area**: how much machinery is in play for the request
you actually made. Ours stays constant as the catalog grows — one routed
skill, its checkpoint, its handoffs — whether the catalog holds 22 entries
or 270.

## What actually keeps 27 from rotting

That's the theory; here's the discipline that keeps it true in practice,
because "it's fine, it's routed" is exactly what a junk drawer would say:

- **Every skill must name the gap it closes.** The
  [v1.7 changelog entry](/changelog) for oc-signal-forge literally itemizes
  the neighbors — telemetry-ops meters, dash-forge renders, monitoring-ops
  watches — and then names the orphaned question ("is this number true?") it
  exists to own. Can't name the gap, don't get a slug.
- **Lockstep versioning.** One bump moves all 27, so there's one catalog
  version, one changelog, one review — not 27 independently drifting
  micro-products wearing a shared logo.
- **A "Not breaking" ledger.** Every release states which cross-skill
  contracts changed. Growth that breaks neighbors isn't growth; it's sprawl
  with a release cadence.
- **Skills that route away, and skills that refuse.** deploy-ops hands
  bare-metal to fleet-ops instead of growing tentacles;
  [oc-modularize-ops](/skills/oc-modularize-ops)'s headline feature is
  telling you *no*. A catalog where components shed scope is under selection
  pressure against bloat.
- **Routing is evaluated, not vibed.** Since
  [v1.5](/blog/2026-06-23-v1-5-build-the-ai-app) there's a routing goldset —
  given a dev request, does opchain pick the right skill? — run like any
  other eval. Bloat has a measurable symptom, so we measure it.

## When it *would* be too many

Credibility requires naming the failure condition, so: the catalog is too big
the day **two skills plausibly claim the same trigger** and the router's
goldset accuracy dips; the day a skill exists because a launch needed a
headline rather than because a gap had an orphaned question; the day
`/oc-ops next` hesitates. Those are our tripwires, checked per release. The
day one trips, we merge something — publicly, in the changelog, with the
same straight face we used to add it.

27 isn't the point, and neither was 22. The point is that the *unit of
growth* is a sealed, single-purpose, individually-evaluated component with a
named remit — and you can keep adding those for a very long time before the
drawer jams. Ask your `/usr/bin`.

Browse all 27 in the [skill library](/skills), or see how they wire together
on the [architecture map](/architecture). If you can find the junk skill,
the feedback widget is right there — we'll either defend the remit or merge
it, in public.
