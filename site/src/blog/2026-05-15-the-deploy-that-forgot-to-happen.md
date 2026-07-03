---
title: "The deploy that forgot to happen"
description: "Production ran six days stale while staging previewed a branch that never shipped. Nothing crashed — that was the problem. Here's the canary that fixed it."
date: "2026-05-15"
author: opchain
pillar: engineering
tags: [engineering, deploys, postmortem]
---

On May 13 we noticed opchain.dev was serving code from six days ago. No
alarm had fired, because nothing was *broken* — the site was up, fast, and
wrong. Meanwhile staging.opchain.dev, the thing we eyeball before every
production push, was cheerfully previewing a commit that production would
never receive. This is the postmortem, published on the principle that the
embarrassing incidents are the ones worth writing down.

## What happened

Two failures compounded, which is how real incidents work:

**Failure one: production drifted silently.** Our deploys are manual —
`wrangler deploy` from a laptop — which means the failure mode isn't a
botched pipeline run, it's a deploy that simply *doesn't occur*. Six days of
merges landed on `main`. Everyone assumed someone had shipped. The site
never crashed, never erred, never gave anyone a reason to look. **Absence of
change is invisible in every monitoring system we had** — uptime checks
confirm the patient has a pulse, not that the patient is the right person.

**Failure two: staging was previewing a parallel universe.** When we did go
to verify, staging was running `7303ab6` — a feature-branch SHA that wasn't
reachable from `main` at all. Someone (fine: us) had deployed staging from a
working branch to check a change, and staging stayed there. The "I just
looked at staging, it's safe to ship" gate was validating code that would
never ship. Staging's entire value is *"this is what prod is about to
become."* Deployed from anywhere but `main`, it's a very convincing
screenshot of nothing.

## What we built instead of feeling bad

Feelings don't page. Within a day we shipped two guardrails:

- **A daily drift canary.** A scheduled workflow curls the production
  `/api/health` endpoint — which serves the deployed git SHA — and compares
  it to `main`. If prod is behind, it opens a tracking issue. One issue, not
  a daily pile: it reopens the same one if you close it without actually
  deploying. It is, functionally, a colleague who asks "did you ship that?"
  every morning and cannot be socially engineered.
- **A staging doctrine.** Staging deploys from `main`, checked out and
  pulled, full stop. Want to preview a branch? That's what local dev and PR
  builds are for. The rule is now written where the deploy command lives, so
  the mistake has to walk past the sign to happen.

We also made a related failure *loud* while we were in there: the build now
refuses to ship if a required upstream (our roadmap data source) silently
returns nothing — the same class of bug, "absence looks like success,"
wearing a different hat.

## The lesson that generalizes

Every alerting setup we'd ever built watched for **things happening**:
errors, spikes, crashes. This incident was a **thing not happening**, and
nothing watches for those by default. Silent staleness beats loud breakage
at evading detection, because it produces zero signals — no stack trace, no
graph discontinuity, nothing.

The fix pattern is portable and cheap:

1. Make the system **state its version** somewhere a script can read
   (`/api/health` returning the git SHA costs ten lines).
2. **Compare it to intent** — the tip of `main` — on a schedule.
3. Route drift to a surface that **nags until resolved**, not a channel that
   scrolls away.

If your deploys are manual — and [sometimes they should
be](/skills/oc-deploy-ops) — the canary isn't optional hygiene. It's the
load-bearing half of the design. Humans forget; that's not a flaw to fix,
it's a constant to engineer around.

Steal the pattern: a version-stamped health endpoint, a daily diff, one
self-reopening issue. Total cost, an afternoon. Total cost of not having it:
six days of visitors reading last week's website, and this post.
