# 00 — Project Overview

## Current State

**opchain** is a product + marketing property in a single repo:

- **The product:** a set of 10 interconnected Claude Code skills (`skills/*/SKILL.md`
  files + one shared `orchestrator.md`) that form an end-to-end software development
  pipeline. Skills chain by reading each other's JSON checkpoints from
  `.checkpoints/`, so context flows forward without manual handoffs.
- **The showcase site:** `opchain.dev` (served by the `opchain-dev` Cloudflare Worker)
  — 5 static pages (Introduction, Architecture, Skill Library, Install, Try It) plus
  two backend endpoints (feedback → Linear, email-gated AI chat demo).

### Pipeline at a glance

```
discover → spec → design → build → audit → ship → scale

reverse-spec ──► app-architect ──► git-ops ──► deploy-ops
                       │
                       ├── auto-invokes stack-forge   (Phase 2)
                       ├── design pipeline             (Phase 3, ux-engineer)
                       ├── build loop                  (Phase 6, Generator/Evaluator)
                       └── launch handoff              (Phase 7)

code-auditor ──► runs at any stage, gates deploy
integrations-engineer ──► runs when external APIs needed
scale-ops ──► advisory; no pipeline chain
checkpoint-protocol ──► persistence layer used by every skill
```

Sources: `README.md` L28–L46, `skills/orchestrator.md` L56–L85.

### Audience / users

- Claude Code CLI users who want a structured pipeline instead of ad-hoc prompting.
- Claude.ai / Claude Desktop users who can upload individual `.skill` files via Settings → Customize → Skills.
- Teams that want to check a standard set of skills into `.claude/skills/` for shared workflow conventions.

Source: `README.md` L93–L118.

### Delivery model

- **Install:** copy individual `SKILL.md` files or download `public/opchain-skills.zip`.
- **No backend required for the product:** each skill is a self-contained prompt package. The site's Worker backend is only for the marketing demos and feedback.
- **No API keys required** for users of the product itself.

### Try It (product demo surface)

`tryit.html` lets a visitor chat with 9 of the skills (not `checkpoint-protocol`) via a
5-exchange email-gated session. Each skill has its own system prompt that
reproduces a compact version of that skill's persona/output
(`src/opchain-try.js` L17–L136). This is a marketing demo, not the real product —
install removes the cap and unlocks the checkpoint protocol.

### Confidence

| Claim | Confidence |
|---|---|
| "opchain is both product and marketing site in one repo" | HIGH — entire repo structure, `CLAUDE.md` explicit |
| 10 skills total (1 protocol + 9 working skills) | HIGH — 10 `SKILL.md` files + `checkpoint-protocol` + `orchestrator.md` |
| 9 of 10 skills are demoable via Try It | HIGH — `SKILL_PROMPTS` has 9 entries (`src/opchain-try.js` L17–L136) |
| Product does not require API keys | HIGH — skills are prompt bundles |
| Pipeline ordering | HIGH — explicit in `orchestrator.md` and `README.md` |
| "tri-dev is retired" | HIGH — explicit, `orchestrator.md` L308 |

### Gaps & Recommendations

- **No formal positioning doc or ICP.** README gives taglines ("skills that ship"), but there's no written description of who the ideal user is, what they previously did, and what measurable outcome they get. Not a blocker for the site, but a gap for growth/marketing work.
- **Branding split.** The repo still references `aidops.dev` (allowed origin, README mentions) alongside `opchain.dev`. `CLAUDE.md` notes the code was extracted from aidops and this repo now owns opchain. Worth documenting which domain is canonical and for what.
- **No versioning.** Skills don't carry version numbers. If the contract changes, downstream consumers have no way to pin a version.
