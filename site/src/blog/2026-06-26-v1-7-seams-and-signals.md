---
title: "v1.7 — Seams & Signals"
description: "Three new skills for cutting monoliths safely, running real fleets, and proving your metrics tell the truth. Yes — the day after v1.6. We can explain."
date: "2026-06-26"
author: opchain
pillar: release
tags: [release, signals, monolith, fleet]
---

We shipped [v1.6 yesterday](/blog/2026-06-25-v1-6-the-instrumented-pipeline).
This is not a typo, and the blog's date math is fine. Two releases in two days
is either a process failure or a process working exactly as designed, and
we'd like to argue — with a straight face — that it's the second one.

Here's the explanation. The whole catalog is versioned in **lockstep**: one
changelog, one review, one bump moves all skills. That makes a release cheap,
and when releases are cheap you stop batching them. Big releases are
inventory, and inventory rots. v1.6 was the instrumentation release; the
moment it landed, the next gap was obvious and already specced. So: v1.7,
**Seams & Signals** — the seams between systems, and the signals that prove
they work. The catalog goes from 24 to **27 skills**.

## The three new skills

- **[oc-signal-forge](/skills/oc-signal-forge)** (`/oc-signal`) turns a
  *question* into a trustworthy metric. Most dashboards are confident. Fewer
  are correct. The overlap is the product. signal-forge starts from the
  question a number is supposed to answer, designs the instrumentation,
  builds the harvester and transform — and then **adversarially tries to
  refute the signal** before it's allowed anywhere near a chart. It closes a
  gap you might not have noticed in v1.6:
  [oc-telemetry-ops](/skills/oc-telemetry-ops) meters the pipeline,
  [oc-dash-forge](/skills/oc-dash-forge) renders beautifully,
  [oc-monitoring-ops](/skills/oc-monitoring-ops) watches prod — and none of
  them owned the question *"is this number true?"* Now one of them does.
- **[oc-modularize-ops](/skills/oc-modularize-ops)** (`/oc-modularize`)
  decomposes a live monolith with **provably zero functionality or data
  loss**. The proof isn't vibes: it captures **golden fixtures from real
  traffic** at every boundary and uses them as an equivalence oracle — the
  extracted module must replay identically before the cut counts. Its most
  senior-engineer feature, though, is refusal: if modularization isn't
  actually warranted, it says so and stops. A skill that bills by the "no."
  When the cut is real, it hands the bulk code-move to
  [oc-migration-ops](/skills/oc-migration-ops) and per-module deployment to
  oc-fleet-ops.
- **[oc-fleet-ops](/skills/oc-fleet-ops)** (`/oc-fleet`) takes the territory
  [oc-deploy-ops](/skills/oc-deploy-ops) has always politely declined:
  self-managed infrastructure. Kubernetes, Nomad, Compose, on-prem VMs,
  Terraform and friends. It declares topology, provisions with the right IaC
  tool, rolls the fleet with an actual rollout strategy, and operates day-2.
  One rule is non-negotiable: a **mandatory plan/dry-run gate before any IaC
  apply**, because `terraform apply` without a plan gate is a trust fall with
  your infrastructure.

deploy-ops and fleet-ops are peers, not a hierarchy: managed app →
deploy-ops; self-managed fleet → fleet-ops. The platform matrix's bare-metal
row now routes accordingly.

## How they chain

The point of a skillchain is that the pieces compose, so here's the composed
story. You have a monolith that's earned a decomposition:

1. **oc-modularize-ops** decides whether the cut is warranted (and is willing
   to say no), then captures golden fixtures from real traffic at each seam.
2. **oc-migration-ops** executes the code move with rollback points.
3. **oc-fleet-ops** lands the extracted modules on the fleet, plan-gated.
4. **oc-signal-forge** builds the metrics that prove the migration did what
   it claimed — verified against the fixtures, not against optimism.
5. **oc-monitoring-ops** enforces each signal's freshness SLA from then on.

## Where the seams show (ours, not yours)

Honesty section, as usual: a release this fast ships **contracts first**. The
three skills land with their full command surfaces, architecture diagrams,
and cross-skill wiring on day one; parts of their reference guts will harden
over the coming days of dogfooding, with a checkpoint-protocol
reconciliation sweep already queued behind them. We'd rather ship the
contract and harden the internals in daylight than sit on a finished-looking
release — but you deserve to know which one you're getting on day one.

## The through-line

v1.6 gave the pipeline eyes. v1.7 gives it the two hardest conversations in
engineering: *"this system needs to be cut apart"* and *"this number you love
is wrong."* Both now have owners, evidence standards, and exits.

See the new rails on the [architecture diagram](/architecture), browse the
[27 skills](/skills), or [install](/install) and ask `/oc-modularize` whether
your monolith actually needs cutting. It might say no. That's the feature.
