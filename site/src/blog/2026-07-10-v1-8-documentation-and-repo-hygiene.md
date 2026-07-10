---
title: "v1.8 — Documentation & repo hygiene"
description: "v1.8 adds oc-docs-forge and oc-repo-ops: every PR now ships a documentation packet and passes a fail-closed repo-readiness gate before it can open."
date: "2026-07-10"
author: opchain
pillar: release
tags: [release, documentation, repo-hygiene, git]
---

Every repository has the PR. The body says "misc fixes," the README
describes a flag that was deleted in March, and the generated catalog is
two skills behind the directory it catalogs. Nobody chose this; it's just
what happens when documentation is enforced by conscience. v1.8,
**Documentation & repo hygiene**, replaces the conscience with a gate.
Two new skills, and the catalog goes from 27 to **29**.

The premise is the same one that runs through the whole pipeline: a rule
that isn't checked by something with the power to say no is a suggestion.
[oc-bug-check](/skills/oc-bug-check) already applies that to code — no
commit until the fast gate passes. v1.8 applies it to everything a PR
carries *besides* code.

## The two new skills

- **[oc-docs-forge](/skills/oc-docs-forge)** (`/oc-docs`) writes the
  documentation that must travel with a change. From the actual diff — not
  from what the author remembers changing — it produces the PR body's
  `## Documentation` section, a durable PR comment when the packet runs
  long, and edits to the README, product docs, changelog, and catalogs the
  change makes stale. Its hardest rule is about absence: when no
  user-facing docs changed, the packet must say so *and argue why*, with
  evidence. Silence is not a pass.
- **[oc-repo-ops](/skills/oc-repo-ops)** (`/oc-repo`) is the
  repo-readiness gate. Before a PR opens, it verifies the docs packet
  exists and matches the current diff, generated files agree with their
  sources, catalog surfaces agree with each other, internal links resolve,
  no dirty files that look related to the PR are loitering untracked, and
  no checkpoint points at a file that no longer exists. It fails closed:
  warnings surface, failures block.

## How they chain

The order is a dependency graph, and it runs on every PR:

1. **oc-docs-forge** writes or verifies the documentation packet.
2. **oc-repo-ops** verifies the packet and the repository around it.
3. **oc-bug-check** runs the fast code gate.
4. **[oc-git-ops](/skills/oc-git-ops)** opens the PR — only after all
   three pass.

The design rule underneath: the skill that writes the docs never decides
whether they're good enough. Author, verifier, and executor are three
different skills with three different checkpoints. There's a full
engineering post on why that separation is load-bearing:
[The docs bot doesn't grade its own
homework](/blog/2026-07-10-the-docs-bot-doesnt-grade-its-own-homework).

## Where the seams show (ours, not yours)

Two honest disclosures. First: like [v1.7](/blog/2026-06-26-v1-7-seams-and-signals),
this release ships **contracts first** — the two skills' full command
surfaces and cross-skill wiring land today, and parts of their reference
guts harden over the coming days of dogfooding. Same seam two releases
running; at this point it's less a seam than a doctrine we haven't
written down yet.

Second: our own content calendar had v1.8 penciled in for July 29,
conditional on there being a release at all. It's July 10. The slip rule,
it turns out, works in both directions — slots slip when the work isn't
worth shipping, and ship early when it is. The calendar has feelings
about this; the calendar is not on the release train.

## The through-line

v1.6 gave the pipeline eyes. v1.7 gave it the hard conversations. v1.8
makes every PR pay its paperwork before it's allowed in the building —
which is the least glamorous release we've cut, and the one whose absence
you'd notice first, six months from now, reading a README that lies.

See the updated [architecture diagram](/architecture), browse the
[29 skills](/skills), or [install](/install) and run `/oc-repo audit` on
a repo you trust. Count the findings. We'll wait.
