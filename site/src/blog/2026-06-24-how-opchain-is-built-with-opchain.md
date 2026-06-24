---
title: "How opchain.dev is built with opchain"
description: "The recursion in full: opchain.dev — this site — is planned, built, audited, and shipped with the opchain skills. A build log of eating our own cooking, including where it gets uncomfortable."
date: "2026-06-24"
author: opchain
pillar: engineering
series: "Dogfooding opchain"
tags: [engineering, dogfooding, meta]
---

This site is built with the thing it sells. Not as a marketing flex — as the
primary way we find out whether the skills are any good. If opchain can't ship
opchain.dev, it has no business asking you to ship anything. This is the build log,
and in keeping with [where this series started](/blog/2026-06-21-dogfooding-has-a-stopping-point),
it's honest about the parts where the recursion is genuine and the parts where it
would be theater.

The short version of "what we use" lives at [/uses](/uses). This is the long
version, with the reasoning left in.

## The pipeline, applied to itself

opchain.dev goes through the same pipeline we'd run on any client project:

- **Plan.** A new surface — a page, a feature, this blog overhaul — starts in
  [oc-app-architect](/skills/oc-app-architect). Discovery, a scoped spec, a design
  pass, a sprint plan. The blog you're reading was planned exactly this way; the
  plan doc is in the repo.
- **Stack.** [oc-stack-forge](/skills/oc-stack-forge) is why this is Astro on
  Cloudflare Workers and not something heavier. Static output, edge-served, no
  cold start on a page view — the decision tree landed there and we wrote down the
  rationale instead of re-litigating it every time someone asks "why not Next?"
- **Build.** The Generator → Evaluator loop, with
  [oc-ux-engineer](/skills/oc-ux-engineer) auto-attaching on UI work to grade
  visual hierarchy and state completeness, so a page can't pass on "it renders"
  alone.
- **Gate.** Every commit goes through [oc-bug-check](/skills/oc-bug-check) — type,
  lint, tests, secrets, build — before it's allowed in. Literally every commit:
  the pre-commit hook reads bug-check's checkpoint and *blocks the commit* if the
  gate didn't pass. We can't bypass our own gate by accident.
- **Ship.** [oc-deploy-ops](/skills/oc-deploy-ops) drives staging then production.

Each of those skills writes a [checkpoint](/blog/2026-06-24-what-a-checkpoint-actually-contains),
so a session that picks up the site next week reads back exactly where the last one
left off. The site's own `.checkpoints/` directory is tracked in git, right next to
the code — you can see the thinking state in the PR diffs.

## Where the recursion is real

The valuable dogfooding isn't "we used the skill," it's "the skill caught something
we'd have missed." Some of it has teeth:

- **The gate has stopped bad commits.** oc-bug-check blocking on a type error or a
  stray secret isn't hypothetical — it's a hook that has to pass before the commit
  lands. The friction is the feature; we feel it the same way you would.
- **The deploy discipline came from our own incident.** The rule that staging must
  deploy from `main` — not a feature branch — exists because we once had staging
  sitting on a branch SHA that wasn't on `main` while production went stale, and the
  "I looked at staging, it's safe to ship" gate silently broke. That scar is now a
  written rule in the deploy flow, which is exactly the kind of hard-won decision a
  skill is supposed to capture so you don't have to bleed for it too.
- **We evaluate our own routing.** opchain's skill-routing is gated on a
  [golden set](/blog/2026-06-22-evaluate-dont-eyeball) — given a dev request, does
  the right skill fire? When we edit a skill's trigger copy, we run that set and
  read the delta, because trigger copy is a prompt and prompts drift.

## Where it gets uncomfortable

Dogfooding is most honest when it admits its limits, so here are ours.

**We don't deploy from CI.** The CLAUDE.md is blunt about it: deploys are manual,
run from a developer laptop with `wrangler login` already done. We *removed* the
automated deploy workflows because the CI Cloudflare token couldn't reliably manage
routes and DNS in the zone, and it kept leaving bindings in a broken state. The
"correct" dogfood story would be a fully automated pipeline. The honest call was
that a logged-in human in `wrangler` avoids a whole class of token-scope failure —
so that's what we do, and we wrote down why. Per [Part
1](/blog/2026-06-21-dogfooding-has-a-stopping-point): dogfooding that overrides good
judgment is a costume, not rigor.

**Not every page earns the full pipeline.** A copy tweak doesn't get a discovery
interview. The skills are scoped to the size of the change — app-architect for a new
surface, a direct edit for a typo. Pretending otherwise would be ceremony for its
own sake, and the skills are supposed to *save* time, not manufacture it.

**The blog overhaul is the freshest example.** This very set of posts came out of an
oc-app-architect planning pass — spec, design, editorial slate, sprint roadmap — and
shipped through the gate and the deploy flow like anything else. The recursion goes
all the way down: a post about building opchain.dev with opchain, written as part of
building opchain.dev with opchain.

## Why bother

Because the alternative is shipping skills we don't personally rely on, and you'd be
able to tell. Every rough edge in opchain is one we hit first, on this site. The
deploy guardrails, the checkpoint merge driver, the pre-commit gate — those exist
because we needed them here, not because we imagined you might.

That's the real argument for dogfooding, and it's the one [this
series](/blog/2026-06-21-dogfooding-has-a-stopping-point) keeps coming back to: not
purity, but quality. We use opchain to build opchain because it's the fastest way to
find out where opchain is wrong — and to fix it before it reaches you.

See the stack at a glance on [/uses](/uses), or
[install opchain](/install) and point it at your own project.
