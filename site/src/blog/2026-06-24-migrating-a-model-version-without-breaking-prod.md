---
title: "Migrating a model version without breaking prod"
description: "A new model drops, or your current one hits end-of-life. Here's the opchain playbook for swapping model versions as a reviewable diff with a measured score delta — not a hope and a redeploy."
date: "2026-06-24"
author: opchain
pillar: playbook
tags: [playbook, claude-api, migration]
---

A new model version lands, or the one you're on gets a sunset date. Either way
you have to move, and the naive move — find-and-replace the model id, redeploy,
hope — is how you ship a silent regression. A model swap changes behavior in ways
that don't show up until a user hits the case you didn't test.

This is a narrated walkthrough of the opchain playbook for it: treat a model
migration like any other risky change — a reviewable diff, gated on a measured
delta, rolled out gradually with a fast path back. The skill that owns this is
[oc-claude-api](/skills/oc-claude-api); the discipline behind it is the same
[evaluate-don't-eyeball](/blog/2026-06-22-evaluate-dont-eyeball) rule that governs
every LLM change.

## The brief

You run a production feature on some Claude model. A newer version is out (faster,
cheaper, or smarter), or your current id is being retired. You need to move to the
new version without:

- a behavior regression your users notice before you do,
- a cost surprise,
- a deploy you can't cleanly roll back.

The definition of done: the new version scores **at least as well** as the old one
on your eval set, the cost-per-request is known, and the change is one revertable
diff.

## Step 1 — Pin what "works" before you change anything

You cannot tell whether a migration regressed if you never measured the baseline.
So before touching the model id, run your eval suite against the *current*
production version and record the scores. If you don't have an eval suite, this is
the moment you build one — 30–50 real, hard cases for the feature in question. See
the [eval post](/blog/2026-06-22-evaluate-dont-eyeball) for what makes a golden set
worth trusting.

[oc-prompt-ops](/skills/oc-prompt-ops) is where this lives: prompts and their
model bindings are versioned artifacts, and the eval score is attached to the
version. The baseline is now a number, not a memory.

## Step 2 — Let oc-claude-api produce the migration diff

`/oc-claude-api` knows the version landscape — model ids, what changed between
versions, the parameters that moved. Point it at the migration and it produces a
**diff PR**, not a vibe: the model id change, plus any parameter or prompt
adjustments the new version calls for, plus notes on behavior changes to watch.

Crucially this is a *diff* — reviewable, commentable, revertable. The whole point
is that "we changed models" shows up in version control as a discrete, attributable
change, the same as any other. If the new version deprecates a parameter or
changes a default, the diff carries that too, so you're not discovering it from a
runtime error.

## Step 3 — Re-run the eval set on the new version

Now the migration earns its keep. Run the same golden set against the new model
and read the **delta**:

- **Scores up or flat** → the migration is safe on the dimensions you measured.
  Ship it.
- **Scores down on some cases** → you've caught the regression *before* prod, in a
  diff review, where it's cheap. Inspect the failing cases. Often a prompt that was
  tuned for the old version's quirks needs a small adjustment for the new one —
  and oc-claude-api's diff already flagged the likely spots.

This is the step the find-and-replace approach skips, and it's the entire
difference between a controlled migration and a gamble. A new model being
"smarter" on average does not guarantee it's better on *your* distribution. Measure
it on yours.

## Step 4 — Check caching and cost

Model migrations are also where [prompt caching](/skills/oc-claude-api) economics
shift. A new version may change tokenization or pricing; a cached prefix that paid
off on the old version should still be paying off on the new one. oc-claude-api
ships caching on by default, but verify the cache hit rate didn't drop after the
swap — a migration that quietly disables caching can multiply your bill without
touching a single visible behavior.

Record the new cost-per-request next to the score delta. "Same quality, 30%
cheaper" is a great migration. "Slightly better quality, 4× the cost" is a decision
you want to make on purpose, not discover on the invoice.

## Step 5 — Roll out gradually, with the door open behind you

Hand the merged diff to [oc-deploy-ops](/skills/oc-deploy-ops): staging first,
smoke-test the golden set against the deployed endpoint (same set, again — your
staging gate *is* the eval), then production. Because the model binding is a
config value, not hardcoded in forty call sites, you can ramp it — a fraction of
traffic on the new version first if your platform supports it — and you can
**roll back in one step** if production traffic surfaces something your 50-case set
didn't.

That last point matters: a golden set is a sample, not a proof. The gradual
rollout plus a one-step revert is what covers the gap between "passed the eval" and
"survives real traffic."

## Why this beats find-and-replace

The naive migration treats a model swap as a trivial text change. It isn't. It's a
behavior change to the least-deterministic component in your stack, and the only
honest way to manage it is to measure before, measure after, and keep a way back.

The opchain version costs you a few extra steps — a baseline run, an eval run, a
cost check — and in exchange the migration is a reviewable diff with a known score
delta and a one-click rollback, instead of a redeploy and a prayer. When the next
version lands, you'll already have the eval set, and the whole thing is an
afternoon.

Start with [oc-claude-api](/skills/oc-claude-api) for the migration diff, and
[oc-prompt-ops](/skills/oc-prompt-ops) to gate it on a measured delta.
