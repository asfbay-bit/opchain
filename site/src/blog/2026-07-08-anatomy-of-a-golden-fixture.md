---
title: "Anatomy of a golden fixture"
description: "What 'equivalence oracle from real traffic' actually means: capture at the seam, scrubbing, determinism traps, replay tolerance — and when fixtures rot."
date: "2026-07-08"
author: opchain
pillar: engineering
series: "Seams & Signals in practice"
draft: true
tags: [engineering, testing, fixtures, modularize]
---

[Monday's playbook](/blog/2026-07-06-cut-a-live-monolith-without-losing-a-byte)
leaned its whole weight on one phrase: *golden fixtures captured from real
traffic, used as an equivalence oracle*. "Zero functionality loss" is only
as strong as that oracle, and the oracle is only as strong as its worst
fixture. So this post takes one apart — field by field, trap by trap —
because the difference between a fixture set and a false sense of security
is entirely in the details below.

## What a fixture actually is

One golden fixture is a five-tuple, recorded — never authored — at a seam:

1. **Boundary** — which interface this crossed (API route, queue topic,
   batch entry point)
2. **Input** — the request/message, byte-faithful
3. **Observed output** — what the system returned
4. **Observed side effects** — rows written, events emitted, files produced
5. **Context snapshot** — the clock, config, and flag state at capture

The "never authored" rule is the load-bearing one. A hand-written test
asserts what the team *believes* the system does; traffic records what it
*does*, including the behaviors nobody remembers shipping and no test
defends. You are not writing an exam the new system can study for. You are
subpoenaing the old system's actual conduct.

## Capture: where, how long, and the tail

Tap at the seam interface itself — not the edge of the app — so what you
record is exactly what the extracted module will owe. Volume policy has two
halves: a **full-capture window** (days, not hours: you want at least one
weekend, one deploy, one month-boundary if finance is anywhere nearby) and
a **stratified tail** — deliberately retained rare paths (error responses,
maximum-size payloads, the weird enum values) that a uniform sample would
drown in checkout traffic. Batch jobs get captured on their own schedule,
in full, at least twice; a batch you captured once is an anecdote.

## Scrubbing: PII dies at capture

Production traffic is full of people. The rule is the same one
[our telemetry design](/blog/2026-06-29-telemetry-should-be-off-by-default)
runs on: make the dangerous thing impossible by construction, not by
promise. Scrubbing happens **at capture time** — raw traffic never lands on
disk — via *deterministic pseudonymization*: the same real customer maps to
the same fake identity every time, so joins, dedup logic, and "same user
twice" behaviors still replay truthfully, while the stored fixture contains
nobody. A schema-level denylist backs it up: fields that can't exist in a
fixture file, enforced by the capture tool, not by vigilance.

## Determinism traps, ranked by how much of your week they eat

Replay only proves equivalence if a fixture *can* replay identically. Five
things conspire against that:

- **Time.** The number-one offender. The new service must replay under the
  fixture's captured clock — injected, not mocked ad hoc. Monday's
  playbook found its one real bug here: a UTC-vs-store-local rendering
  shift moving midnight orders across a day boundary. (Time zones also
  [got this blog](/blog/2026-06-28-our-cost-report-was-wrong-by-13x)'s
  sister site — every date on it — earlier this month. Respect the clock.)
- **Randomness.** UUIDs, shuffles, sampled logic. Seedable at replay, or
  mapped: fixture ids and live ids get a translation table so "same id as
  before" remains checkable without demanding literal equality.
- **Ordering.** Unordered collections that happen to arrive ordered will
  betray you on the new runtime. Canonicalize (sort, normalize) both sides
  before diffing — but *declare* which fields are order-insensitive;
  canonicalizing everything hides real regressions in genuinely ordered
  output.
- **Floats and formatting.** `19.9999999` vs `20.0`, `2026-07-08` vs
  `2026-07-08T00:00:00Z`. Per-field tolerance and canonical forms, written
  down, versioned with the fixtures.
- **External calls.** Anything crossing to a third party gets
  record-and-stub: the fixture carries the upstream's captured response,
  and replay never touches the real vendor. (Your equivalence proof should
  not depend on Stripe's uptime — a cousin of
  [the build-time vendor rule](/blog/2026-06-19-your-deploy-shouldnt-call-someone-elses-api).)

## Replay tolerance: the diff function is the contract

Exact-bytes equality is the wrong default; canonical equivalence with
per-field rules is the real contract. The discipline is that the tolerance
spec is **explicit, versioned, and small** — and that every mismatch is a
defect until *proven* a formatting artifact, never the reverse. The moment
"eh, probably formatting" enters the vocabulary, the oracle is decorative.
A diff you can't explain is a bug you haven't met yet.

## Fixture rot

Fixtures age like certificates, not like wine. The capture window is a
photograph of traffic that keeps evolving — new fields, new clients, new
weird. A green replay against a stale set is a lie with a checkmark. So:
fixtures carry their capture date, expire on a schedule, and re-capture is
a standing chore, not a heroic one. When the extracted service has been
live a while, yesterday's *its* traffic becomes the next capture — the
oracle changes custody, which is how you know the migration actually ended.

## The general shape

Notice this is the same move every time this series makes it: **don't
argue the system is equivalent — record reality, replay it, and make the
diff the judge.** Fixtures are to migrations what
[eval sets are to prompts](/blog/2026-06-22-evaluate-dont-eyeball) and
reconciliation is to metrics: the mandatory, unskippable step where your
confidence has to survive contact with evidence.

[`/oc-modularize`](/skills/oc-modularize-ops) runs this whole discipline as
its fixtures phase — capture policy, scrubbing, determinism harness, and a
replay gate that doesn't care how sure you are.
