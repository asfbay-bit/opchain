---
title: "Your deploy shouldn't call someone else's API"
description: "Our deploys required a Linear API key to render a marketing page. On convenience integrations that quietly join the critical path — and demoting them."
date: "2026-06-19"
author: opchain
pillar: engineering
tags: [engineering, deploys, dependencies]
---

Today we removed a third-party API call from our deploy path, and the story
of how it got there — and how it *almost* got promoted from "annoying" to
"incident" — is a compact case study in a failure mode most teams are
quietly incubating: **the build-time dependency on somebody else's uptime.**

## How it crept in

Our [/changelog](/changelog) roadmap used to be generated at build time from
Linear — a script pulled the project board and rendered it into the page.
Perfectly reasonable origin story: the data lived in Linear, the page wanted
the data, the build was where the two could meet. One small script. It even
had error handling.

Then, back in May, we hit the sibling bug: an upstream returning *empty*
looked identical to *success*, and we nearly shipped a blank roadmap. The
fix at the time was to **fail loud** — require the API key, refuse to build
on an empty result. Correct call, and we'd make it again. But notice what
it did to the dependency graph: shipping a CSS fix to opchain.dev now
required Linear — a project-management SaaS — to be up, reachable, and in
possession of a valid key. Our deploy had acquired a *second vendor*, and
nobody had decided that on purpose.

## The promotion nobody approved

That's the actual anti-pattern, and it's worth naming precisely: **a
convenience integration silently joining the critical path.** The roadmap
pull was decorative — marketing-page furniture. But because it ran inside
`deploy`, its failure modes were promoted to deploy severity: expired key,
rate limit, vendor incident, DNS hiccup — each now a potential "cannot ship
anything, including the fix for the thing that's actually broken."

The loud-fail hardening made this *visible* without making it *right*.
Step one, make the failure undeniable; step two, ask why that failure is
possible at all. (Step two took us a month. The honest timeline is part of
the lesson.)

## The fix was demotion, not resilience

The engineering-brain reflex is to armor the integration: retries, caching,
a fallback snapshot. All of that adds machinery to keep the dependency
*while* pretending it isn't one. We did the simpler thing — **demoted the
data to source control.** The roadmap is now a hand-maintained static file
in the repo, edited when the roadmap actually changes (which is measured in
weeks, not builds). The Linear pull script survives for a future re-wire —
as a *content tool a human runs*, never again as a deploy gate.

The general test, applicable to your repo today:

> For each network call in your build: if this endpoint is down at 2 a.m.
> and production is on fire, am I willing to be unable to deploy?

If no — and for anything decorative the answer is no — the data belongs in
the repo, refreshed *out of band*. Static-with-manual-refresh feels
primitive next to live-at-build-time. It's also the version where your
deploy has exactly one vendor in it.

## The scoreboard

Deploy-blocking failure modes removed: every Linear outage, key rotation,
and rate limit. Freshness lost: none that a reader could detect — the
roadmap changes when we decide it does, which was always true; now the
deciding edits a file instead of a board. Machinery added: zero. Lines of
build script deleted: all of them.

The [deploy pipeline](/skills/oc-deploy-ops) teaches this as doctrine now —
third parties belong behind runtime boundaries with graceful degradation,
not inside build ones with veto power. Audit your own build for quiet
vendors; the grep is free and the 2 a.m. version of you is grateful.
