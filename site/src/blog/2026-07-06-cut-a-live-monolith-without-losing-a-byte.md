---
title: "Cut a live monolith without losing a byte"
description: "A narrated /oc-modularize run on a live order-management monolith: golden fixtures, the seam plan, the replay proof — and the exit where it tells you no."
date: "2026-07-06"
author: opchain
pillar: playbook
series: "Seams & Signals in practice"
draft: true
tags: [playbook, monolith, modularize, migration]
---

Everyone has a monolith story, and most of them end the same way: a heroic
extraction, a quiet data discrepancy discovered months later, and a
postmortem with the phrase "edge case" doing unpaid overtime. This playbook
is the opposite story — a narrated
[`/oc-modularize`](/skills/oc-modularize-ops) run where the cut either
happens with **receipts proving nothing changed**, or doesn't happen at all.

The subject is a composite of real runs (names sanded off, numbers real
enough to argue with): a six-year-old order-management monolith — orders,
inventory, and a reporting module whose nightly batch had grown from "a
cron job" to "the reason deploys wait until 11 p.m." The ask: extract
reporting into its own service.

## Phase 0: the gate where it says no

`/oc-modularize` opens with an interview it's allowed to fail you on. Not
"how do we cut" but **"is cutting warranted"**: Is deploy contention real or
anecdotal? Does the module scale independently or just feel important? Is
there a team boundary, or one team about to own a distributed system for
aesthetics? Roughly half the monoliths we've pointed it at get some version
of *no* — usually "your problem is a missing index and a job queue, and
both cost a day, not a quarter."

This one earned its yes on the numbers: reporting was 4% of code, 61% of
peak memory, and the only reason deploys were nocturnal. A cut with a
falsifiable justification survives the moment, six weeks in, when everyone
briefly wishes they'd never started. Write the justification down; you'll
want it.

## Phase 1: capture the golden fixtures

Before a single file moves, the skill captures **golden fixtures from real
traffic** at the chosen seam — recorded input/output pairs plus observed
side effects, which become the *equivalence oracle* for everything after.
For this system: 8,214 request/response pairs across 11 days at the
reporting API boundary, plus the nightly batch captured twice in full
(batch jobs live on their own calendar; capture them on it).

The fixtures are the contract, and they're deliberately *not authored by
humans*. Hand-written tests encode what the team believes the system does.
Traffic encodes what it actually does — including the 2021 rounding rule on
partial refunds that nobody remembered, defended by no test, and load-bearing
for the finance export. Chesterton's fence, except the fence is revenue.

## Phase 2: the seam plan

With the oracle banked, the skill plans the seam proper: interface,
data ownership, and strategy. Data ownership is where extractions really
die, so it's explicit: the reporting service gets **read models fed by
events** — it owns its rollup tables, and touches order tables never.
Strategy: **parallel-copy** — run the extracted service alongside the
monolith on mirrored traffic — rather than strangler-fig, because a nightly
batch gives you a perfect natural replay window. (Strangler wins when
traffic is continuous and you need incremental cutover; the skill picks per
seam, and says which and why.)

The bulk code move itself is handed to
[oc-migration-ops](/skills/oc-migration-ops)' Structural type — rollback
points at every step, no innovation in the moving-files department. Moving
files is a solved problem; the oracle is the hard part.

## Phase 3: the replay proof

Now the part that makes "zero functionality loss" a claim instead of a
hope: the extracted service must **replay every fixture identically**
before the cut counts. Not "the demo works." All 8,214, plus both batch
runs, diffed.

Ours failed on replay 1, and the failure is the whole sales pitch: the
extracted service rendered the nightly report in UTC while the monolith
used store-local time — a one-hour shift that moved a sliver of midnight
orders across a day boundary. Revenue totals off by 0.3% on two fixture
days. The kind of bug that sails through review, passes every hand-written
test, and gets discovered by an accountant in Q3. The fixture diff caught
it in an afternoon, because the fixtures didn't know what the answer
*should* be — only what it *was*.

Fix, replay again, green across the set. *That* green is the cutover
ticket.

## Phase 4: land it and prove it stays landed

Deployment goes to [oc-fleet-ops](/skills/oc-fleet-ops) (topology declared,
IaC plan-gated — no `apply` without a reviewed plan), and the ongoing
truth-telling goes to [oc-signal-forge](/skills/oc-signal-forge): the
migration's success metrics get adversarially verified before anyone
toasts, because
[v1.7's whole thesis](/blog/2026-06-26-v1-7-seams-and-signals) is that the
seam and the signal are one project, not two.

## Where this playbook stops

Honesty section: fixtures are an oracle for **captured behavior**. Traffic
that never occurred in the capture window — the leap-year path, the
customer with 40,000 line items — isn't in the oracle, and replay can't
vouch for it. The capture policy (how long, how stratified, how the rare
paths get included, how fixtures are scrubbed and kept deterministic) is
its own discipline with its own traps, and it deserves its own post —
that's next on this series' calendar.

Run [`/oc-modularize`](/skills/oc-modularize-ops) on the monolith you've
been circling. Bring real traffic and a willingness to hear *no* — both
exits of that gate are the product working.
