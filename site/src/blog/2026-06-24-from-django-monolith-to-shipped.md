---
title: "From Django monolith to shipped in an afternoon"
description: "An old Django app, no docs, no tests, one nervous developer. A narrated walkthrough of reverse-spec → app-architect → deploy that turns 'I'm scared to touch it' into a shipped change."
date: "2026-06-24"
author: opchain
pillar: playbook
tags: [playbook, django, legacy, reverse-spec]
---

The scariest code is the code that works and nobody understands anymore. A
five-year-old Django monolith, no docs, the tests that exist are stale, and the one
person who knew how it fit together left two jobs ago. You need to add a feature.
You're scared to touch it, and that fear is rational.

This is a narrated walkthrough of turning that situation into a shipped change in
an afternoon — not by rewriting the monolith (you won't, and you shouldn't), but by
*understanding it first*, then making one surgical change with the lights on. The
skills doing the work: [oc-reverse-spec](/skills/oc-reverse-spec),
[oc-app-architect](/skills/oc-app-architect), and
[oc-deploy-ops](/skills/oc-deploy-ops).

## The brief

- **Input:** a Django app, ~40k lines, deployed on Render, no current spec, ~30%
  test coverage of unknown freshness.
- **The ask:** add an export-to-CSV feature to the orders view.
- **The fear:** the orders view touches billing, and nobody's sure what depends on
  what.
- **Definition of done:** the feature ships, and you understand the blast radius
  *before* you write the code, not after an incident.

The fear is the real problem here. The feature is small. What makes it scary is the
unknown coupling, and the whole afternoon is about converting unknown into known
before you change anything.

## Step 1 — Reverse-spec the part you have to touch

Don't document the whole monolith — that's a week, and you don't need it. Point
[oc-reverse-spec](/skills/oc-reverse-spec) at the orders module and let it produce
spec docs *from the code as it actually is*: the data model, the request flow, what
the orders view reads and writes, and — the part you actually care about — what
else reaches into the same models.

This is the inverse of normal spec work. You're not deciding what to build; you're
recovering what's already true. The output is the map you wish the previous
developer had left: "the orders view writes to `Order` and `LineItem`; billing
reads `LineItem.total` in `invoices/tasks.py`; here's the signal that fires on
save." Now the coupling is on paper instead of in your nightmares.

## Step 2 — Read the blast radius before you touch a line

With the reverse-spec in hand, the scary question has an answer. Export-to-CSV is a
*read* feature — it queries orders and serializes them. The spec confirms it
doesn't write, so the billing coupling you were afraid of (which lives on the
*write* path, on save) is out of scope. The fear was real but the risk wasn't, and
you know that now because you looked, not because you guessed.

This is the step the brave-but-foolish version skips. They add the feature, it
works in dev, and three weeks later an export query under load locks a table that
billing needs. The reverse-spec is what turns "it worked when I tried it" into "I
know what this touches."

If the change *had* been on the write path — say, adding a field to `Order` that
billing reads — this is where you'd escalate to
[oc-migration-ops](/skills/oc-migration-ops) for an incremental migration plan with
rollback points, rather than a cowboy schema change. Knowing which of those two
worlds you're in is the entire value of looking first.

## Step 3 — Plan the change as a small, contained unit

Hand the reverse-spec to [oc-app-architect](/skills/oc-app-architect). You're not
running the full idea-to-app pipeline — you're using it for a scoped feature on an
existing codebase, which it's built to do: it picks up the recovered spec as
baseline and produces a tight plan for just the CSV export. A view, a serializer, a
URL, a button, and — because this is now shippable code, not a spike — tests for
the happy path and the empty-orders case.

The plan is small on purpose. The reverse-spec already did the hard part by bounding
the change; app-architect just turns that bounded change into a checklist and a
contract, so the build can't quietly sprawl back into the billing code you
established was out of scope.

## Step 4 — Build it with tests, against the spec

Now the actual code, which is the easy part precisely because steps 1–3 made it
easy. The export view queries orders, streams a CSV (Django's `StreamingHttpResponse`
keeps a big export from eating memory), and the button lands on the orders template.
Tests cover the happy path and the empty state. The contract from step 3 is the
definition of done, so you know when you're finished rather than guessing.

This is also where you write the tests the monolith was missing for *this* slice.
You don't backfill coverage for 40k lines — you leave the orders module better than
you found it by a few honest tests, and move on.

## Step 5 — Ship it the way the app already ships

[oc-deploy-ops](/skills/oc-deploy-ops) takes it from here on the Render target the
app already lives on: run the audit gate, deploy to a preview/staging environment,
smoke-test the export against real-ish data, then promote to production. Because the
change is read-only and bounded, the deploy is low-drama — which is the entire point
of having spent the afternoon bounding it.

## What the afternoon actually bought

You shipped a feature, yes. But the durable win is that you converted a 40k-line
fear into a known, bounded change *before* writing code, and you left behind a
spec for the orders module that the next person — maybe you in six months — will
read instead of fearing.

The monolith is still a monolith. You didn't rewrite it, and you were right not to.
You just stopped flying blind in the one corner you had to touch. That's the legacy
playbook: **understand the slice, bound the change, ship with the lights on.**

Start with [oc-reverse-spec](/skills/oc-reverse-spec) on the module you're scared
of, or browse the [AI recipes](/ai-recipes) for more end-to-end flows.
