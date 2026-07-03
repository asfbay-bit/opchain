---
title: "v1.3 — The pipeline meets your PM tool"
description: "PM-MCP runtime across five skills, a platform menu that spans Cloudflare to Rust, and release-ops — opchain now cuts its own releases. Starting with this one."
date: "2026-05-12"
author: opchain
pillar: release
tags: [release, pm-tools, integrations]
updated: "2026-06-06"
---

> *Editor's note (June 6): skill and command names in this post predate the
> [oc- rename](/blog/2026-06-06-we-renamed-every-skill-in-one-pr) — today's
> `/discover` is `/oc-discover`, `release-ops` is `oc-release-ops`, and so
> on. Links point at the current pages. The history stays as written.*

Until now, opchain and your project tracker lived in different universes. The
pipeline would plan sprints, build them, and evaluate them — and then you'd
alt-tab to Linear or Jira and transcribe what just happened like a court
stenographer for your own robots. v1.3 closes that gap, and closes it in both
directions.

## PM-MCP runtime, in five skills

Five skills now speak to your PM tool at runtime over MCP — Linear, GitHub
Issues, or Jira, resolved from one `pm.yaml` and a shared tool registry:

- **[app-architect](/skills/oc-app-architect)** reads a ticket as
  discovery input (`/discover --ticket ADEV-123`) and writes sprint
  contracts back as comments — so the plan of record lives where your team
  already looks. (It's the worked example; the same registry pattern serves
  the other four.)
- On each sprint pass or fail, the build loop **transitions the child
  ticket** and posts the evaluator score. Your board reflects reality
  without a human retyping it.
- Every write carries an **idempotency marker**, so re-running a phase never
  double-posts. Agents retry things; your ticket history shouldn't read like
  a stutter.

The design principle: the PM tool is for *state changes the team needs to
see*. Passing checks post nothing. Failures and contracts post once. Silence
remains the default — we'd rather under-notify than train you to ignore us.

## The platform menu

[stack-forge](/skills/oc-stack-forge) breaks out of the JavaScript
monoculture: the platform menu now spans **Cloudflare, Django, Rails, Go,
and Rust**, each with real deploy patterns and test strategies rather than a
paragraph of vibes. The stack decision was always the pipeline's front door;
now the front door has more than one hinge.

## release-ops — the 18th skill, hired to ship itself

The new **[release-ops](/skills/oc-release-ops)** (`/release`) owns
release cadence: it reads every skill's checkpoint since the last release,
proposes the next semver and theme, drafts the changelog from what *actually
shipped* (not what we hoped would), bumps all skills in lockstep, and hands
off to git-ops and deploy-ops.

Its first assignment was the release announcing its own existence. This very
one. `/release plan` proposed "1.3.0", drafted the entry you'll find on
the [changelog](/changelog), and walked the ship checklist — a new hire whose
onboarding task was writing its own offer letter. It went fine, which is
either reassuring or ominous, and we've decided to find it reassuring.

## The through-line

Both halves of v1.3 are the same idea: **the pipeline should push its state
to the places humans already trust** — the ticket board, the changelog —
instead of hoarding it in a terminal scrollback. Checkpoints made the
pipeline durable for the *agent*; v1.3 makes it legible to the *team*.

All 18 skills move to `1.3.0` in lockstep. Browse the
[skill library](/skills), or [install](/install) and point `/discover` at
the oldest ticket in your backlog. It's not getting younger.
