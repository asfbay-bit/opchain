---
title: "Our cost report was wrong by 13×"
description: "Yesterday we told you building opchain cost $937. The real number is $72. The bug, the fix, and why plausible numbers are the most dangerous kind."
date: "2026-06-28"
author: opchain
pillar: engineering
series: "Dogfooding opchain"
featured: true
tags: [engineering, dogfooding, cost, postmortem]
---

Yesterday we published
[a cost report](/blog/2026-06-27-what-building-opchain-with-opchain-cost)
saying opchain cost **$937.41** to build. The real number is **$71.73**. This
post is the difference between those two numbers — an apology to arithmetic,
a postmortem, and the best free advertising
[oc-signal-forge](/skills/oc-signal-forge) will ever get, at our expense.

The bug is two sentences long. The lesson is not.

## The bug

Claude Code stores each session as append-only JSONL. As an assistant message
streams and updates, the transcript can carry **multiple snapshot lines for
the same message** — same `message.id`, progressively longer content, each
snapshot with a `usage` block. The report summed usage **per line**.

That's it. Every long message was counted once per snapshot. Sum-per-line
over an at-least-once log is a classic, and we walked into it wearing a
lanyard that said "cost attribution expert."

The multiplier landed at ~13× rather than 2× or 3× for a nasty reason: the
number of snapshots grows with message length, and message length correlates
with cost. **The error was weighted toward exactly the messages that cost the
most.** Expensive build-loop generations got counted a dozen times; cheap
one-liners got counted once or twice. The bug didn't just inflate the total —
it inflated it *selectively*, which also quietly distorted the phase shares.
(Order held; magnitudes moved. The original post is annotated, not deleted.)

## Why it survived review

Because $937 is a *plausible* number. Seven weeks of Opus-heavy agentic
development? Sure. Nobody blinked.

A wrong number that looks wrong dies in code review. A wrong number that
looks like your life gets published, cited, and budgeted against. Plausible
is the most dangerous thing a broken metric can be — and the failure mode is
general: nothing about this is special to LLM spend. Any pipeline that joins
logs to money can produce a confident, plausible, wrong chart.

Worse: we had a reconciliation source *the whole time*. The Anthropic console
shows actual billed usage. Checking it was step zero, and we skipped step
zero because the chart looked reasonable. The chart always looks reasonable.

## The question that killed it

The number finally died when someone asked the signal-forge question — not
"does this look right?" but **"if this were true, what else would have to be
true?"**

If we'd really spent $937 at our measured cache-hit rate, the implied token
throughput would have blown past what our actual active hours — and the API's
own rate limits — could physically deliver. The number wasn't just wrong; it
was *impossible*, and had been impossible in public for a full day. One
independent invariant beat ten reasonable-looking charts.

## The fix

Mechanically boring, as good fixes are:

1. **Dedup on `message.id`, keep the final snapshot**, then sum. Sum over
   *entities*, never over *log lines* — logs are at-least-once delivery of
   facts, not facts.
2. **Reconcile against the invoice.** The report now compares its total to
   console billing and fails loudly past a small tolerance, so the next
   methodology bug can't clear its throat without tripping an alarm.
3. **Unit plausibility checks.** Implied tokens/second and dollars/hour get
   sanity-bounded against wall-clock. Numbers that require time travel are
   rejected without a meeting.

## The uncomfortable part

We shipped oc-signal-forge — a skill whose entire pitch is *"adversarially
verify a metric before wiring it to a surface"* — **two days before failing
that exact standard ourselves.** That's embarrassing, and it's also the
strongest argument for the skill we could have accidentally manufactured:
verification can't be a virtue you possess. It has to be a **gate you can't
skip**, because when the chart flatters your priors, you will not volunteer.

The rebuilt cost pipeline — dedup, reconciliation, plausibility bounds — is
now the worked example in signal-forge's reference docs. We failed our own
standard in public, so the least we can do is invoice the failure for parts.

## The checklist, portable edition

- Sum over entities (dedup on a real key), never over log lines.
- Reconcile every money metric against an independent source. Step zero.
- Ask "if this were true, what else would be true?" — then check *that*.
- Make the refutation step a gate, not a virtue.

Point [`/oc-signal`](/skills/oc-signal-forge) at the metric your team trusts
most, or start with `/oc-cost` from
[oc-cost-ops](/skills/oc-cost-ops) and let the corrected math run on your own
history. The right number, it turns out, was 13× more affordable — we'd love
to tell you your surprise runs the same direction.
