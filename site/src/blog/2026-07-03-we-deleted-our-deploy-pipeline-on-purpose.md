---
title: "We deleted our deploy pipeline on purpose"
description: "Removing CI/CD made our deploys more reliable. A defense of the logged-in laptop, the daily drift canary, and knowing which failure mode you actually have."
date: "2026-07-03"
author: opchain
pillar: opinion
draft: true
tags: [opinion, deploys, ci-cd, cloudflare]
---

There's a genre of engineering post where the author deletes something
sacred and reliability improves, and everyone in the comments has a great
time. We regret to inform you this is one of those. We deleted our deploy
workflows — the whole CI/CD path to production — and our deploys got
*better*. We're as annoyed about it as you are.

To be precise about the heresy: opchain.dev, a site whose entire product is
**automated software delivery discipline**, deploys to production when a
human runs `npm run deploy` on a laptop. On purpose. Here's the reasoning,
because it generalizes better than the punchline suggests.

## What actually happened

The standard setup: GitHub Actions, a Cloudflare API token, `wrangler deploy`
on merge. The problem: our Workers use custom domains, so a deploy isn't just
"upload code" — it can touch **routes and DNS in the zone**. The Actions
token could never reliably manage those. Deploys would land the code, then
fail partway through the domain wiring and leave the bindings in a broken
state — the deploy equivalent of a mover who gets your couch into the
elevator and then goes home.

Diagnose, re-scope token, retry, repeat. After the third broken-binding
incident we noticed the pattern: **every recent production incident was
caused by the machinery meant to prevent production incidents.** A human
running `wrangler` as a logged-in account has the full session and simply
does not hit that class of failure. So we deleted the workflows.

## The principle hiding in the anecdote

Continuous deployment is a bet: *our automation fails less often than our
discipline does.* Usually a great bet — it's why CD won. But when the
automation itself is the flaky component, the bet inverts, and inverts
nastily: a human who sees a weird error **stops**; a pipeline that hits one
retries it into a broken state at 2 a.m. and doesn't feel bad about it.

The mistake we'd been making was treating "automated" as a synonym for
"reliable." They're independent axes. So we re-drew the line:

> **Automate the verification. Automate the guardrails. Automate the nagging.
> Automate the action only when the action is boring.**

Our deploy action wasn't boring — it was the flakiest step in the whole
system — so *it* went manual, and everything around it got more automated
than before.

## What replaced the pipeline (this is the actual content)

Deleting CD without replacing its guarantees would just be YOLO with a blog
post. The guarantees moved into guardrails:

- **CI still gates everything.** Tests, typecheck, site build, e2e,
  Lighthouse budgets on every PR. CI's job is *"is this safe to ship?"* — it
  just no longer holds the trigger.
- **Prod tells you what it's running.** The build stamps the git SHA into
  the Worker; `/api/health` serves it. No archaeology, just `curl`.
- **A daily drift canary.** A scheduled check compares prod's SHA to `main`
  and opens a tracking issue when production falls behind. Close it without
  deploying and it reopens — a very polite, unfireable nag. Manual deploys'
  real failure mode isn't botched runs; it's *forgetting*. So we automated
  the remembering.
- **Staging deploys from `main`, only.** Learned the hard way: on May 13 we
  eyeballed a staging that had been deployed from a feature branch — a SHA
  not even reachable from `main` — while prod sat six days stale. (That
  incident has [its own postmortem](/blog/2026-05-15-the-deploy-that-forgot-to-happen);
  the canary above was born there.) Staging's entire epistemic value is
  *"this is what prod is about to become."* Deploy it from anywhere else and
  you're QA-testing a parallel universe.
- **Rollback is two commands** — list deployments, roll back, ~30 seconds to
  previous code. Cheap rollback is what makes a human trigger safe at all.

Note what that adds up to: we didn't remove automation. We **relocated** it —
out of the action, into the verification. There is arguably *more*
automation watching our deploys now than when a robot performed them.

## Where this advice expires

An honest opinion post names its own boundary, so: this works because we're
a small team with
one deploy target and the judgment to eyeball a staging URL meaningfully. At
N engineers × M services, "the laptop" stops scaling and you should take the
pipeline — our own [oc-deploy-ops](/skills/oc-deploy-ops) skill will design
you the properly-automated version, staging gate and all, and it would
politely raise an eyebrow at our setup. Same lesson as
[the dogfooding post](/blog/2026-06-21-dogfooding-has-a-stopping-point):
following your own tool off a cliff isn't rigor.

The transferable part isn't "delete your pipeline." It's the diagnostic:
**which failure mode do you actually have?** Automation-induced breakage, or
human forgetfulness? Ours was the first. The fix for the first is fewer
robots holding triggers and more robots holding clipboards. The fix for the
second is the opposite. Most teams never ask the question — they cargo-cult
the answer for a failure mode they don't have.

Steal the cheap parts today: a version-stamped health endpoint, a drift
canary that nags, a staging that only ever comes from `main`. Then ask
[`/oc-deploy`](/skills/oc-deploy-ops) what your pipeline should look like —
and if it disagrees with this post, listen to it. It knows what team size
you are.
