---
title: "Vibe coding is fine until it isn't"
description: "Vibe coding isn't the enemy — it's the right tool for exploration. The mistake is not noticing the moment you've crossed from exploring into shipping, where the rules change."
date: "2026-06-24"
author: opchain
pillar: opinion
tags: [opinion, process]
---

"Vibe coding" — describing what you want in plain language and letting the model
run, steering by feel rather than by spec — gets dunked on a lot, usually by people
selling rigor. This isn't that post. Vibe coding is genuinely great at the thing
it's great at. The failure isn't doing it; the failure is **not noticing when
you've crossed the line** from the work where it's the right tool into the work
where it quietly stops being.

opchain is sometimes read as anti-vibe-coding. It isn't. It's a set of tools for
exactly that crossing — for the moment a throwaway becomes a thing you have to
ship and keep alive.

## Where vibe coding is the right call

When you're exploring, vibe coding is the best tool there is. You don't know what
you're building yet; the point is to find out fast. Writing a spec for a thing you
might delete in an hour is waste. The whole value is the tight loop: think it,
say it, see it, react.

Concretely, vibe code freely when:

- You're prototyping to learn — does this API feel right, is this UI direction
  alive or dead?
- The cost of being wrong is "I delete it and try again," not "a user loses data."
- You're the only person who will ever touch this code, and only for the next hour.
- You're spiking a hard problem to understand its shape before committing to an
  approach.

In all of these, the discipline people want to sell you — specs, tests, eval sets,
review gates — is overhead with no payoff, because nothing here has to *last*. Vibe
away.

## Where it quietly stops working

The trouble is that the transition is invisible. Nobody announces "this prototype
is now production." It just accretes. The spike you wrote to understand the problem
becomes the thing on the demo. The demo becomes what a customer uses. The code you
were going to delete in an hour is now load-bearing, and you never made a decision
to make it so.

The line gets crossed the moment **any** of these becomes true:

- Someone other than you will read, change, or depend on the code.
- Being wrong now costs more than a redo — real data, real money, real users.
- It has to still work next month, after you've forgotten how it works.
- There's an LLM in the loop whose output you're trusting without measuring.

Past that line, the properties that made vibe coding fast turn into liabilities.
"Steer by feel" was efficient when you held the whole thing in your head. Now the
thing is bigger than your head, spread across sessions, and the model
[forgets it all between chats](/blog/2026-06-24-why-your-ai-coding-agent-forgets).
"I tried it and it worked" was fine for a spike and is dangerous for a feature,
because a [capable model hides
bugs](/blog/2026-06-22-evaluate-dont-eyeball) behind plausible output. Feel doesn't
scale past the size of what you can personally verify.

## The fix isn't more rigor — it's rigor at the right moment

The wrong lesson is "always write the spec first." That kills the exploration that
makes vibe coding valuable. The right lesson is to **notice the crossing and change
gears when you hit it.**

That's the entire shape of opchain. It doesn't forbid the fast loop; it gives you a
clean place to graduate into when the fast loop's assumptions stop holding:

- The throwaway is becoming real → [oc-app-architect](/skills/oc-app-architect)
  turns the vibe into a spec, a design, and a sprint plan, so the intent is written
  down instead of living in a context window that's about to clear.
- You're about to commit code others will depend on →
  [oc-bug-check](/skills/oc-bug-check) is the two-minute gate that catches the
  type error, the leaked secret, the failing test before they land.
- There's a model in the loop you're trusting on faith →
  [oc-prompt-ops](/skills/oc-prompt-ops) puts it under an eval set so "it felt
  right" becomes "it scores 0.86."

None of that is overhead when the code has to last. It's the cheapest insurance
there is, paid at the exact moment the risk profile flips.

## The skill is knowing where you are

Good engineers aren't the ones who never vibe code. They're the ones who always
know which mode they're in. They'll spike a wild idea with zero ceremony in the
morning and, the moment that spike is going to ship, stop and write the thing down,
add the gate, build the eval. Same person, same afternoon, two different gears —
chosen on purpose.

Vibe coding is fine. It's better than fine; it's the right way to explore. It just
isn't a way to *ship*, and the expensive mistake is letting a prototype slide into
production without ever shifting gears. Notice the line. Cross it deliberately.

When your vibe-coded thing starts becoming real, that's the cue — point
[oc-app-architect](/skills/oc-app-architect) at it and let the
[checkpoint protocol](/blog/2026-06-24-what-a-checkpoint-actually-contains) carry
the intent the context window can't.
