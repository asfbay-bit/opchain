---
title: "Why your AI coding agent forgets everything"
description: "The context window is not memory, and treating it like memory is why your coding agent loses the plot between chats. The fix is older than LLMs: write it down."
date: "2026-06-24"
author: opchain
pillar: opinion
featured: true
tags: [memory, checkpoints, claude-code, opinion]
---

You've felt it. You spend an hour with Claude getting the spec right, the data
model agreed, three screens designed. You close the tab. You come back the next
morning, ask for the next screen, and it redesigns the navigation you already
signed off on, re-asks a question it answered yesterday, and quietly contradicts
a decision from the first session.

The instinct is to blame the model — *it's not smart enough to remember.* That's
the wrong diagnosis, and the wrong diagnosis leads to the wrong fixes (bigger
context windows, longer system prompts, pasting the whole history back in). The
real problem is a category error: **we keep treating the context window as
memory, and it isn't.**

## The context window is a desk, not a filing cabinet

A context window is working space. It's the desk where the model does the current
task. Desks are great — wide ones are better than narrow ones — but a desk is not
where you *store* anything. When the session ends, the desk gets cleared. When the
window fills, the oldest papers slide off the edge. Nothing on a desk is durable
by design.

Human engineers don't keep a project in their heads between days either. We lose
the plot too — after a weekend, after a meeting, after lunch. We just don't
notice, because decades ago we externalized the fix and stopped thinking of it as
a fix at all. We write things down. Specs, ADRs, tickets, READMEs, commit
messages, a `TODO.md`. The filing cabinet is the codebase and its documents. The
desk is wherever we happen to be working that hour.

LLM agents arrived with an enormous desk and **no filing cabinet**, and we've
spent two years trying to make the desk bigger instead of building the cabinet.

## Bigger context windows don't fix it

They help the single longest session. They do nothing for the thing that actually
hurts: continuity *across* sessions, across teammates, across the inevitable
moment the window resets. Three reasons a bigger desk is the wrong investment:

- **Sessions end.** A 1M-token window is still cleared when you close the tab. The
  failure isn't running out of room mid-thought; it's that *nothing carries over*.
- **Attention degrades.** Even within a huge window, models attend unevenly —
  the decision you made 200K tokens ago is technically "in context" and
  practically ignored. Presence is not salience.
- **It doesn't compose.** Your teammate's session can't read your desk. A cron
  job that resumes the work at 2am can't read your desk. Anything that isn't
  written down somewhere shared simply doesn't exist to the next actor.

You cannot scale your way out of a structural problem. A desk that never gets
filed is a desk you re-clear every morning.

## The fix is a checkpoint, written down

The boring, correct answer is the one engineering already settled: **persist the
state outside the model.** Not in the context window — in a file.

That's what a checkpoint is. After each meaningful step — a spec approved, a
sprint finished, a decision made — write the durable facts to disk: what phase
you're in, what's been decided, what's done, what's next. At the start of the
next session, the agent reads the checkpoint back *before* doing anything else,
and picks up exactly where you left off.

In opchain this is the
[checkpoint protocol](/architecture): a small JSON file per skill at
`.checkpoints/<skill>.checkpoint.json`, tracked in git like any other source.

```json
{
  "skill": "oc-app-architect",
  "phase": "design-approved",
  "decisions": ["stack: astro + cloudflare", "auth: none, static site"],
  "next_actions": ["generate punch list", "decompose sprints"]
}
```

Three properties make it work, and all three come from it being a *file*, not a
prompt:

1. **It survives the session.** Close the tab, come back next week — the state is
   on disk, not on a cleared desk.
2. **It's the source of truth, not a summary.** The agent doesn't reconstruct
   intent from a transcript it might misread. It reads decisions stated as
   decisions.
3. **It's shared.** Your teammate's session reads the same file. So does a
   scheduled job. So does code review — the checkpoint is in the diff.

## "Just paste the history back in" isn't the same thing

The common workaround is to re-feed the conversation: paste yesterday's chat, or
have the model summarize itself. It's better than nothing and worse than a
checkpoint, for one reason — **a transcript is a record of deliberation, not a
record of decisions.** It contains every idea you considered and rejected, with
no marker for which won. The model re-reads the whole argument and is as likely to
re-open a settled question as to honor it. A checkpoint stores the *conclusion*:
"auth: none." There's nothing to relitigate.

Summaries have the opposite failure: they're lossy in exactly the places that
matter, smoothing over the one hard constraint that the next step hinges on.

## Write it down

None of this is novel. "Externalize state" is the oldest idea in computing, and
"write down what you decided" is the oldest idea in engineering. The only new
thing is that we briefly forgot it, dazzled by a model that could hold a whole
project on one enormous desk — right up until the desk got cleared.

Your AI coding agent doesn't forget because it's dumb. It forgets because you're
asking the desk to be the filing cabinet. Build the cabinet.

That's the entire premise of opchain: a set of [skills](/skills) plus a
[checkpoint protocol](/architecture) so the work survives the session. If the
"redesigns what it already designed" loop sounds familiar,
[install it](/install) and trigger a skill by name — the next session reads the
checkpoint back and keeps going.
