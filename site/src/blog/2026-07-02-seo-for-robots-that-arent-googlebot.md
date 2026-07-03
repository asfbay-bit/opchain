---
title: "SEO for robots that aren't Googlebot"
description: "AI agents are a traffic class now. How opchain.dev advertises its MCP server to them — ARD catalog, llms.txt, did:web — and the robots.txt line we refused."
date: "2026-07-02"
author: opchain
pillar: engineering
tags: [engineering, mcp, discovery, agents]
---

A growing share of your next users will never see your homepage. They'll be
represented by an agent that got asked *"help me ship this app,"* went
looking for tools, and either found yours — machine-readably, verifiably —
or found someone else's. Being **callable** (we ship [an MCP
server](/skills)) turns out to be the easy half. Being **findable** is a
whole discovery surface, and almost nobody's writing down how to build it.

So here's ours, end to end: every endpoint opchain.dev serves so that
software can discover, evaluate, and verify the software that helps you build
software. (The recursion is load-bearing; by now you know
[the house rules](/blog/2026-06-24-how-opchain-is-built-with-opchain).)

## One catalog, many costumes

The rule that makes the whole surface trustworthy: **everything derives from
one generated catalog at request time.** No hand-maintained copies, no build
step between the product and its advertisements — staging advertises
staging, and the menu is printed from the kitchen, not by the marketing
department. From that single source:

- **`/.well-known/ai-catalog.json`** — an [Agentic Resource
  Discovery](https://agenticresourcediscovery.org/spec/) manifest. One entry:
  the MCP server, with every skill id listed as a `capability` and real
  intent phrases as `representativeQueries`. These are the meta keywords of
  the agent era — except this time the incentive points at honesty, because
  the reader can *call the endpoint* and check.
- **`/.well-known/mcp.json`** — the server card the ARD entry resolves to:
  endpoint, transport, and a tool list pulled from a **live server
  instance**, so the card physically can't drift from the server. Docs that
  can't lie are the best genre of docs.
- **`/llms.txt`** — a plain-Markdown index for text-first crawlers: each
  skill's raw docs plus the key entry points, in the format an LLM would ask
  for if you let it design the web.
- **`/skills.json`** — the full machine-readable catalog. It lives at the
  root rather than under `/api/` for a delightfully dumb reason: our
  `robots.txt` disallows `/api/`, and publishing a catalog for robots at a
  path we tell robots not to read seemed like a joke we'd rather not
  maintain.
- **JSON-LD** in every page head — `Organization`, `WebSite`, per-page nodes
  — for the crawlers that still think in schema.org.

## Prove who's talking: did:web

An ARD manifest claims an identity; a good agent should ask *says who?* Ours
answers `host.identifier: "did:web:opchain.dev"`, which resolves to a DID
document at `/.well-known/did.json` holding a public Ed25519 key. did:web's
trust anchor is domain control — serving that document over HTTPS on the
domain *is* the proof. The private key was minted locally on a developer
machine, never in CI, and exists so that future assertions (a signed trust
manifest, for instance) can be verified against the same identity. Agents
don't extend trust on vibes, and honestly, they're ahead of most of us
there.

## Getting listed where agents shop

Discovery isn't only inbound. `server.json` in the repo is our entry in the
official [MCP Registry](https://registry.modelcontextprotocol.io) — a
*remote* listing pointing at `https://opchain.dev/mcp`. Publishing runs on
every version tag via GitHub **OIDC** — no long-lived registry secret to
leak, rotate, or explain in a postmortem. The directory sites (PulseMCP,
Glama, Smithery, mcp.so) crawl the registry from there, the way search
engines once crawled webrings. Everything old is new again, including,
apparently, webrings.

## The seams

Two honest ones, per house rules:

**The robots.txt line we refused.** ARD defines three discovery hooks: the
well-known manifest, a `<link rel="ai-catalog">` tag, and an `Agentmap:`
line in `robots.txt`. We ship two of three. Lighthouse's SEO audit rejects
non-standard `robots.txt` directives, and our CI runs Lighthouse budgets that
fail the build below threshold — so the robots' sitemap would have flunked
the humans' robot inspection. We chose the budget. The agents can cope; it's
in their catalog. Which they can find. Two other ways.

**The day Cloudflare challenged our robots.** Bot protection once served the
`/mcp` endpoint a *"Just a moment…"* interstitial — an I-am-not-a-robot
check aimed at clients whose whole identity is being robots. Agents don't
click verify boxes; they just report your server as broken. That incident got
a runbook, a WAF skip-list for the discovery paths, and a tripwire: the
daily canary now **fails loudly** if the challenge page ever comes back.
Agent-facing uptime is uptime. Monitor it like you mean it.

## Try it, robot or otherwise

```bash
curl -s https://opchain.dev/.well-known/ai-catalog.json | jq '.entries[0].capabilities'
curl -s https://opchain.dev/llms.txt | head -20
```

Or skip discovery and go straight to being a caller: point any MCP client at
`https://opchain.dev/mcp`, or [install the skills](/install) directly. If
you're human, the [skill library](/skills) still renders in colors. For now,
we keep both audiences.
