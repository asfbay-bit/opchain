# Blog content calendar — July 2026

> Extends [`blog-overhaul-plan.md`](./blog-overhaul-plan.md) (§5 slate, §9 S6
> cadence). That doc owns the strategy — pillars, voice, QA checklist; this
> one owns the *schedule* for the 30-day window **2026-07-03 → 2026-08-01**.
>
> Owner: opchain. Authored via `/oc-app-architect`. Created 2026-07-02.

## 0. Cadence note (read before adding slots)

The overhaul plan's S6 cadence says **~2 posts/month** and its §2 non-goals
say *"we publish when we have something worth a developer's 8 minutes, not on
a content-calendar quota."* July deliberately runs hotter — **M/W/F** — because
the v1.6 + v1.7 launch window generated a real backlog of things worth
saying (two releases, a public 13× correction, three new skills that each
earn a playbook). The quota principle survives as the **slip rule**:

> A slot that isn't worth 8 minutes by its publish date **slips**. We never
> ship filler to keep a streak. The calendar is a slate with target dates,
> not a treadmill.

After this window, cadence drops back toward S6 unless August generates its
own backlog.

## 1. Where things stand (as of 2026-07-02)

| Bucket | Count | Notes |
|---|---|---|
| Prehistory backfill (Wave 0) | 5 | 2026-05-12 → 06-19: v1.3 release, deploy-gap postmortem, oc- rename, MCP/Codex v1.4.3, Linear deploy-decoupling. Backdated 2026-07-02, anchored to real commits; the v1.3 post carries an era-names editor's note |
| Waves 1–2 (overhaul plan §5) | 11 | 2026-06-20 → 06-24, live |
| Launch-gap backfill | 7 | 2026-06-25 → 07-01: v1.6 + v1.7 release narratives, cost-report pair (incl. the 13× correction), telemetry stance, wire-1.1 playbook, "27 skills" |
| Published today | 1 | `2026-07-02-seo-for-robots-that-arent-googlebot` |
| **Staged, ready to flip** | 2 | `2026-07-06-cut-a-live-monolith-without-losing-a-byte` · `2026-07-08-anatomy-of-a-golden-fixture` (both `draft: true`; flipped by the scheduled publish bot on their dates) |
| Drawered | 1 | `2026-07-03-we-deleted-our-deploy-pipeline-on-purpose` — owner call 2026-07-04, moved to `site/drafts/` (permanently unpublished; slot slipped) |

Featured/hero: `2026-06-28-our-cost-report-was-wrong-by-13x` (newest
`featured: true` wins the index hero automatically; the 06-24 flag can stay).

Series ledger: **"Dogfooding opchain"** is now 5 parts (06-21, 06-22, 06-24,
06-27, 06-28). July opens **"Seams & Signals in practice"** (4 parts below).

## 2. The 30-day slate

Every post passes the overhaul plan **§8 checklist** before publish — thesis
up top, shows the seams, concrete over abstract, one clear next action,
description 120–160 chars, ≥2 internal links.

| Date | Day | Working title | Pillar | Series | Hook / thesis | Key sources | Status |
|---|---|---|---|---|---|---|---|
| Jul 3 | Fri | ~~We deleted our deploy pipeline on purpose~~ | opinion | — | Slipped permanently (owner call, 2026-07-04). Post preserved in `site/drafts/`. | — | 🗑 **dropped** |
| Jul 6 | Mon | **Cut a live monolith without losing a byte** | playbook | Seams & Signals in practice | Narrated `/oc-modularize` run: fixture capture → seam plan → replay proof — including the path where it refuses. | `skills/oc-modularize-ops`; v1.7 changelog | ✍️ **staged** — flip `draft` |
| Jul 8 | Wed | **Anatomy of a golden fixture** | engineering | Seams & Signals in practice | What "equivalence oracle from real traffic" actually means: capture, scrubbing, determinism traps (time, randomness, ordering). | oc-modularize-ops references | ✍️ **staged** — flip `draft` |
| Jul 10 | Fri | **From Compose guilt to a governed fleet** | playbook | Seams & Signals in practice | `/oc-fleet` end to end: declare topology → pick IaC → mandatory plan gate → day-2 (scale/drain/replace). | `skills/oc-fleet-ops` | planned |
| Jul 13 | Mon | **The dashboard is not the deliverable** | opinion | — | A chart that renders ≠ a signal that's true; question-first metrics. Sequel to the 13× saga. | oc-signal-forge; 06-28 post | planned |
| Jul 15 | Wed | **Wire a metric you can actually trust** | playbook | Seams & Signals in practice | Narrated `/oc-signal` build: question → instrumentation → harvester → adversarial refutation → dash-forge handoff. | `skills/oc-signal-forge` | planned |
| Jul 17 | Fri | **Flags all the way down** | engineering | — | The flag registry as single source of truth: layered eval (default → env → PostHog), fail-closed, kill switches, build-fails-on-drift. | `src/lib/flags/registry.js`; `gen-flags.mjs` | planned |
| Jul 20 | Mon | **Your staging environment is lying to you** | opinion | — | Elevates the [May 15 postmortem](../site/src/blog/2026-05-15-the-deploy-that-forgot-to-happen.md) to principle — don't re-tell the incident, argue the doctrine. | May 15 post; Jul 3 post | planned |
| Jul 22 | Wed | **Give your API a birth certificate** | playbook | — | `/oc-api` Designer→Builder→Conformance: OpenAPI-first, schema↔code parity, SDK gen, drift gates. | `skills/oc-api-dev` | planned |
| Jul 24 | Fri | **Docs that can't lie** | engineering | — | Derive every public claim from the artifact it describes: mcp.json from a live server, release surfaces guarded by script, llms.txt from the catalog. | `src/lib/discovery.js`; `check-release-surfaces.mjs`; Jul 2 post | planned |
| Jul 27 | Mon | **Slop is a choice** | opinion | — | Generic AI output is what you get when nothing in the loop is paid to say no. Skeptical evaluators ("5/10 means mediocre — give it") as the anti-slop mechanism. | oc-app-architect Phase 6; oc-ux-engineer | planned |
| Jul 29 | Wed | **v1.8 — _(theme via `/oc-release plan`)_** | release | — | The story behind v1.8, whatever oc-release-ops proposes from the sprint checkpoints. | `.checkpoints/`; `/changelog` | ⏳ conditional — slips if no release |
| Jul 31 | Fri | **Month one on the dashboard** | engineering | Dogfooding opchain | First month of opt-in telemetry aggregates: what sparse-but-honest data does and doesn't support. | `/dashboard`; oc-telemetry-ops | ⏳ conditional — needs data; fallback below |

**Pillar mix for the window:** 4 engineering · 4 opinion · 4 playbook · 1
release — consistent with the plan's credibility-weighted target.

## 3. Spares bench (swap-ins for slipped slots)

- **How this blog ships itself** (engineering) — content collection, zod
  schema quirks (no `z.coerce`, dates as strings), `draft:true` staging, the
  OG-card pipeline, RSS. Cheap to write; designated fallback for Jul 31.
- **The evaluator is not your friend — that's the point** (opinion) —
  isolated-context grading, why "mostly works" must FAIL.
- **439 tests for a "static" site** (engineering) — what Vitest + Playwright
  + Lighthouse budgets actually guard on a marketing page, and why.
- **Checkpoint archaeology** (engineering) — reading six weeks of
  `.checkpoints/` history like tree rings: what the pipeline did when nobody
  was journaling.

## 4. Publishing runbook (mechanics)

1. **File:** `site/src/blog/YYYY-MM-DD-kebab-slug.md`. The filename (minus
   `.md`) is the URL slug — date prefix included, permanent once live.
2. **Frontmatter contract** (schema: `site/src/content.config.ts`): `title`
   ≤60 chars ideally (hard cap 120); `description` 120–160 (hard cap 200);
   `date` is a plain `"YYYY-MM-DD"` string; exactly one `pillar` of
   `engineering | opinion | playbook | release`; optional `series`,
   `featured`, `updated`, `tags`.
3. **Future posts stay `draft: true` until their date.** The site is static
   and does **no date-based filtering** — a future-dated published post
   renders immediately on the next deploy. The draft flag is the only
   embargo. Drafts get no page, no RSS entry, no OG card — flipping the flag
   is the entire publish action.
   - **Flips are automated** (since 2026-07-04): a scheduled agent runs each
     publish morning, flips only a draft dated *exactly that day*, opens the
     PR, merges on green CI, and notifies that a deploy is owed. Overdue
     drafts are never auto-flipped — a missed day is a human decision.
     Permanently unpublished posts live in `site/drafts/` (the drawer),
     outside the collection glob, where the bot can't see them.
4. **Publish flow:** flip `draft` → PR → CI green → merge → `npm run
   deploy:staging` (from `main`, always) → eyeball `/blog` → `npm run
   deploy`. OG cards and RSS regenerate automatically at build.
5. **Corrections:** annotate, never silently rewrite — correction blockquote
   up top, `updated:` field set, original numbers struck through. Precedent:
   the [Jun 27 post](../site/src/blog/2026-06-27-what-building-opchain-with-opchain-cost.md).
6. **Hero rotation:** set `featured: true` on the new flagship; the newest
   featured post wins automatically. Retire stale flags opportunistically.

## 5. Standing sources for future slates

Mine these when planning August: merged PRs since the last release
(`oc-release-ops` reads them anyway), `.checkpoints/` next_actions graveyards
(every abandoned plan is a post about *why*), incident runbooks under
`docs/runbooks/`, and any number the team argued about for >10 minutes (if it
was worth arguing about, it's worth a post).
