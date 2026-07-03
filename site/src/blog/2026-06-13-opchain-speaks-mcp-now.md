---
title: "opchain speaks MCP now"
description: "v1.4.3 extends opchain past Claude Code: a hosted MCP server at opchain.dev/mcp puts the skills in reach of Codex and any MCP client. The roadmap said v1.8."
date: "2026-06-13"
author: opchain
pillar: release
tags: [release, mcp, codex]
---

opchain grew up inside Claude Code — skills on disk, read by one agent, in
one CLI. As of v1.4.3, that's no longer the boundary: there's a hosted **MCP
server at `opchain.dev/mcp`**, and any MCP-speaking agent — Codex first
among them — can reach the skill catalog over the wire. A point release with
a headline feature, which deserves both the announcement and an explanation
of the version number.

## What shipped

- **The hosted server.** JSON-RPC over streamable HTTP at
  [`https://opchain.dev/mcp`](/install). It serves the same catalog the
  [skill library](/skills) renders — same source of truth, different
  audience. No API key, no signup; it's a docs surface that answers tool
  calls.
- **The Codex install flow.** [/install](/install) now has a path for
  Codex and generic MCP clients alongside the Claude Code one. Point your
  client at the endpoint, and the skills that were "a Claude Code thing"
  become "a thing your agent can consult."
- **The plumbing honesty.** The Worker that serves this site now also
  terminates MCP. One deploy ships both, which keeps the server honest: it
  physically cannot describe a catalog other than the one the site ships.

## The version number is a confession

Sharp-eyed roadmap readers will note the MCP server was slated for **v1.8**
— several releases out. We built it early anyway, sat on it briefly, and
shipped it as a point release. The honest sequence: the prototype turned out
to be a weekend, not a quarter, because the catalog already had one
machine-readable source of truth (the same generated file the site builds
from). When the expensive part of a roadmap item evaporates, holding the
feature hostage to its original quarter is process cosplay. So: `1.4.3`,
"extend opchain to Codex," months ahead of its own plan. We'll take the
scheduling embarrassment; it points the right direction.

## Why this matters more than a port

The narrow read is "opchain works in another tool now." The wider one is
about what a skill *is*. On disk, a skill is instructions an agent follows.
Over MCP, the same skill is **queryable expertise** — an agent mid-task can
ask "how does the opchain pipeline gate a deploy?" and get the actual
contract, current as of the last deploy, instead of a months-stale training
impression of our docs.

That reframes the catalog from *product for Claude Code users* to
*reference any agent can consult*. The pipeline discipline — spec gates,
evaluator loops, [checkpoints](/skills/oc-checkpoint-protocol) — stops being
locked to one runtime. Agents are becoming each other's users; serving them
well is not a novelty feature, it's distribution.

## Try it

Claude Code users: nothing changes, the skills stay local-first —
[install](/install) as ever. Codex (or anything MCP-speaking): add
`https://opchain.dev/mcp` and ask it what opchain would do before you merge
that branch. The answer comes from the same catalog, whichever door you use
— one product, now with two runtimes and, as of this week, no favorite
child.
