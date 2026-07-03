---
title: "Telemetry should be off by default"
description: "Opt-out analytics is a dark pattern in a trench coat. opchain's usage metering is opt-in, local-first, and content-free by schema — here's the design."
date: "2026-06-29"
author: opchain
pillar: opinion
tags: [opinion, telemetry, privacy]
---

Developer tools have normalized a strange ritual: install something, and it
starts reporting on you. The checkbox is pre-ticked, the data is described as
"anonymous usage information," and the opt-out lives four screens deep in a
config file you'll find the day you read a Hacker News thread about it.
Opt-out telemetry is a dark pattern in a trench coat, and the trench coat is
the word "anonymous."

We just shipped a telemetry system —
[oc-telemetry-ops](/skills/oc-telemetry-ops), in
[v1.6](/blog/2026-06-25-v1-6-the-instrumented-pipeline) — so this is the
post where we're contractually obligated to explain why ours won't do that,
structurally, not just pinky-promise.

## The four design rules

**1. Off means off, and on is a verb.** Nothing is recorded until you run
`/oc-telemetry enable`. Not "minimal data," not "essential diagnostics" —
nothing. Enabling is an explicit command you type, with output that tells you
exactly what just changed. Most telemetry asks forgiveness. Ours asks
permission, in writing, and then mostly stays home.

**2. Local-first, in a file you can open.** Metering lands in
`.checkpoints/usage.sqlite` — in *your* repo, on *your* disk. It's not a
black-box beacon; it's a database you can open with `sqlite3` and audit over
coffee. The default flow ends there. Nothing leaves the machine as a side
effect of using the tool.

**3. Content-free by schema.** This is the load-bearing one. The tables
record *which skill ran, which phase, when, and roughly how much* — and there
is **no column that could hold a prompt**, a file path, a diff, or anything
you typed. Privacy by policy is a promise; privacy by schema is a type error.
The safest data is the column that doesn't exist.

**4. Aggregates only, visible in public.** If you additionally choose to
contribute, what leaves is an anonymized aggregate — counts, not events — and
it feeds a [dashboard anyone can see](/dashboard). The sharing surface being
*public* keeps us honest: we can't collect creepier data than we're willing
to display next to our logo.

## The price we pay, on purpose

Opt-in means small-n. Small-n means biased. The dashboard undercounts real
usage, skews toward enthusiasts, and will never impress an investor the way
a silently-harvested MAU chart does. We know. We'd rather have **sparse
honest data than comprehensive data collected dishonestly** — partly as
ethics, mostly as engineering: decisions built on coerced data are built on a
sample of people who didn't care enough to say no, which is its own bias,
just a less flattering one to name.

And yes — we enabled it on ourselves first, the same week we
[pointed the cost tooling at our own history](/blog/2026-06-27-what-building-opchain-with-opchain-cost).
First data subject, first embarrassment rights. It's been a productive week
for both.

## The actual principle

Telemetry is a feature that serves the *vendor*, running on the *user's*
machine. That's not evil — we clearly think it's worth building — but it
means it deserves the consent bar of any software that phones home about
you, not the consent bar of a default.

If your tool's insight engine collapses the moment users get a real choice,
you didn't have product analytics. You had surveillance with a dashboard.

Read the schema yourself in
[oc-telemetry-ops](/skills/oc-telemetry-ops), check what the aggregate looks
like on the [dashboard](/dashboard) — and if you do run
`/oc-telemetry enable`, thanks. We'll try to deserve the rows.
