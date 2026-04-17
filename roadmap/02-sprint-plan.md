# Sprint Plan — opchain.dev Redesign

Seven sprints. Each passes an app-architect Evaluator gate before the next
starts (pass threshold: all criteria ≥ 6/10 per `skills/app-architect/SKILL.md`
L297–L299).

Effort estimates are `CLAUDE: <hrs> | USER: <hrs>`. Usable as-is for the
Generator → Evaluator build loop or as a human roadmap.

---

## Sprint 0: Foundation — safety rails & staging

**Goal:** Make the repo safe to iterate on and create a staging environment
before any design work starts.

### Features (punch-list coverage)

- Gap H1 (hardcoded fallback secret), H2 (no CI / no tests), H3 (no staging), M1 (KV prod in dev), L1 (no `.env.example`), L6 (unstructured logs), L7 (no version identifier).

### Deliverables

- New folder layout planned: introduce `site/` (Astro app) alongside current
  `src/` + `public/`. Old site remains the production deploy during sprints 1–5.
- `wrangler.jsonc` gets `env.staging` with its own worker name + KV preview id + separate `route`/`custom_domains` to `staging.opchain.dev`.
- `DEPLOY_API_TOKEN` fallback removed; unset env triggers 500 with a log line.
- `.env.example` created and linked from `CLAUDE.md`.
- GitHub Actions workflow `.github/workflows/ci.yml`: `npm ci`, `npm run build`, `npm test`, `npm run type-check`. Runs on PR + push to main.
- GitHub Actions workflow `.github/workflows/deploy.yml`: deploy to staging on push to `main`; manual approval to promote to production (until Sprint 6).
- Build-time version stamp: esbuild `define` for `__OPCHAIN_VERSION__` = short SHA; surfaced in `GET /api/health` response and as a `<meta name="x-opchain-version">`.
- `scripts/verify-catalog.sh` (temp, shell) checks `public/skills.js` matches `skills/*/` — fails CI on drift. Replaced by the real collection in Sprint 1.

### Test Requirements

- Unit: HMAC round-trip, `isValidEmail`, label/priority maps, `corsHeaders()` with allowed/denied origins.
- Integration: `GET /api/health` returns 200 with `version` field; Worker refuses to sign tokens when `DEPLOY_API_TOKEN` unset.
- CI: workflow exists and passes on the baseline.

### Definition of Done

- Pushing a branch runs CI.
- `wrangler deploy --env staging` puts the existing site on `staging.opchain.dev`.
- Production deploy still works via `npm run deploy` (unchanged).
- No test failures; `tsc --noEmit` passes (on the converted modules only — full TS comes in Sprint 1).

### Dependencies

None. Can start immediately.

### Estimated Effort

CLAUDE: 6 | USER: 2 (DNS for `staging.opchain.dev`, GitHub OIDC setup, CF API token review)

---

## Sprint 1: Single Source of Truth for Skills

**Goal:** Collapse catalog drift; all skill metadata flows from one place.

### Features

- Gap M2 (catalog drift across 3 files), L7 (versioning lead-in), M10 (per-skill versioning).

### Deliverables

- Add `version:`, `phases:`, `triAgent:`, `shortDesc:`, `triggers:`, `commands:` fields to each `skills/<id>/SKILL.md` YAML frontmatter. Backfill from `public/skills.js` + `orchestrator.md`.
- Add `site/src/content/config.ts` Astro content-collection schema (Zod) typing the frontmatter.
- Write `site/src/lib/skills.ts` exporting `getAllSkills()`, `getSkill(id)`, `getTryablePrompts()`.
- Parse SKILL.md body to extract the "description" / first-paragraph for the detail page.
- Delete `public/skills.js`; anything that still references it is pointed at the generated output.
- `src/opchain-try.js` `SKILL_PROMPTS`/`SKILL_NAMES` gets replaced by a runtime import from the shared catalog (prompts live in a new per-skill frontmatter field `tryPrompt:` or a sibling `tryit.md`).
- `scripts/verify-catalog.sh` from Sprint 0 is removed (replaced by schema validation at build time — any missing field fails the Astro build).
- Design decision recorded: `tryPrompt:` goes in frontmatter vs. sibling file. Recommend sibling `skills/<id>/TRYIT.md` so prompts can be multiline markdown without YAML gymnastics.

### Test Requirements

- Unit: schema validator accepts all 10 existing skills; fails cleanly on missing field.
- Integration: `getTryablePrompts()` returns exactly the 9 tryable skills (excludes `checkpoint-protocol`).
- Build: `astro build` fails if any SKILL.md has a malformed frontmatter.

### Definition of Done

- Renaming/adding a skill requires edits in ONE place (the skills/ directory).
- `public/skills.js` is deleted.
- Try-It and Skill Library read from the same generated catalog.
- All existing Try-It system prompts preserved (no behavior regression).

### Dependencies

Sprint 0 (needs TS + CI in place).

### Estimated Effort

CLAUDE: 10 | USER: 1 (review frontmatter additions per skill)

---

## Sprint 2: Design System v2

**Goal:** Establish the visual language for the redesign before any pages
are rebuilt. Per app-architect Phase 3, design precedes build.

### Features

- Closes M3 (stub pages — requires design direction first), L2 (focus-visible), L3 (tokenize danger color). Adds a styleguide page.

### Deliverables

- `site/src/styles/tokens.css` — CSS custom properties for colors, typography, spacing, radius, shadows, motion. Canonicalizes the current palette, adds `--danger`, `--success`, `--info`, layered elevation shadows, a typography scale (`--fs-xs` through `--fs-3xl`).
- `tailwind.config.ts` — reads tokens via `theme: { extend: { colors: 'var(--…)' ... } }`.
- Icon strategy: adopt `lucide-astro` (or a handpicked SVG set) — 15–25 icons inventoried for nav, feedback, skills, CTAs.
- Component library as Astro components (`site/src/components/ui/`): `Button`, `Card`, `Pill`, `Input`, `Textarea`, `Badge`, `Alert`, `CodeBlock`, `Nav`, `Footer`.
- Every interactive component has defined states: default, hover, focus-visible, active, disabled, loading.
- Styleguide page at `site/src/pages/styleguide.astro` — renders every token and every component variant. Accessible only in non-production builds (or behind `?debug=1`).
- Typography system: pick one display font (Inter, Geist, or the current system stack with tightened letter-spacing) + one mono for code blocks.
- Motion tokens: `--ease-standard`, `--duration-fast/base/slow`; one subtle `prefers-reduced-motion` guard.

### Test Requirements

- Playwright: styleguide page renders without errors on dark theme; every documented component appears.
- Unit: token module exports the expected keys.
- Visual regression (optional, via Playwright + snapshot): styleguide screenshot diffed across PRs.

### Definition of Done

- Token file is the single source of truth for every color/size.
- No page uses hex colors directly — all via tokens or Tailwind utilities.
- Focus-visible ring is consistent across every interactive element.
- Styleguide renders the full component library.

### Dependencies

Sprint 0 (foundation), Sprint 1 (skills catalog is not required but nice to have for realistic styleguide demos).

### Estimated Effort

CLAUDE: 14 | USER: 3 (brand direction approval — accept/adjust the display font and any palette shifts)

★ **Design Direction Approval Gate** per `skills/app-architect/SKILL.md` L216.

---

## Sprint 3: Page Rebuilds (content-complete)

**Goal:** Rebuild all marketing pages with real content, using the design
system from Sprint 2. No stubs.

### Features

- M3 (stubs), L8 (OpenGraph/robots/sitemap).

### Deliverables

- `/` Introduction — refined hero, pipeline-phase overview cards, "try it / install / browse" CTAs.
- `/architecture` — **real content**: pipeline diagram (mermaid, rendered at build time via `rehype-mermaid` or a server-side renderer), checkpoint protocol explainer, per-skill upstream/downstream table, "how skills chain" walkthrough. Content sourced from `skills/orchestrator.md` + reverse-spec `spec/02-architecture.md`.
- `/skills` Skill Library — filter panel preserved; skill cards use the new Card + Pill + Badge components; adds trigger keywords + version badge.
- `/skills/[id]` — new per-skill detail page with: trigger commands, how-it-fits-the-pipeline, full SKILL.md rendered, "Try It with this skill" CTA.
- `/install` — real content: 3 tabs (Claude Code CLI, Claude Desktop, Team/git), copy-paste commands with a "Copy" button, troubleshooting FAQ.
- `/tryit` (UI only in this sprint; wiring in Sprint 4) — new layout matching Sprint 2 components.
- Global nav + footer in Astro layout; `active` state driven by route, not hand-maintained per page.
- `robots.txt`, `sitemap.xml` (Astro integration), OpenGraph + Twitter meta tags.

### Test Requirements

- Playwright: all 5 top-level routes return 200; `/skills/app-architect` renders; filter "plan" returns ≥ 3 skills; mermaid diagrams rendered as inline SVG (not client-side JS).
- Axe a11y scan: 0 violations on each route.
- Lighthouse (headless CI): Performance ≥ 95, Accessibility ≥ 95 on `/` and `/skills`.

### Definition of Done

- Zero stub pages.
- Per-skill detail page generated for all 10 skills.
- Diagrams are static SVG in HTML (no render-time flash).
- Site works with JS disabled except for Skill Library filter and Try It chat.

### Dependencies

Sprint 1 (skill catalog), Sprint 2 (components).

### Estimated Effort

CLAUDE: 18 | USER: 2 (copy review on Install and Architecture pages)

★ **Punch List Approval Gate** per `SKILL.md` L223 — sign off on the final screen set before Sprint 4 wires interactivity.

---

## Sprint 4: Try-It Rewrite

**Goal:** Port the Try-It chat to the new codebase with UX improvements and
harden the streaming path.

### Features

- M4 (XSS surface in markdown renderer), M8 (hardcoded Anthropic model), M7 (hardcoded Linear IDs), L4 (no retries), L5 (no request IDs).

### Deliverables

- `/tryit` page as an Astro island (`client:load`), written in TS.
- Replace bespoke markdown renderer with `marked` + `DOMPurify` (or a vetted alternative), with a content-security-policy compatible mount.
- Retry + jitter (single retry, 500ms base) on Anthropic 5xx.
- `ANTHROPIC_MODEL` env var override (defaults to current Haiku).
- Request-ID propagation: generate `X-Request-Id`, attach to every log line, log Anthropic's returned `request-id` for correlation.
- `src/lib/kv.ts` typed KV wrappers; handlers no longer touch KV directly.
- Zod schemas for every POST body (`/api/try/start`, `/api/try/chat`, `/api/feedback`).
- Client: visible "X exchanges remaining" counter, keyboard shortcuts (Cmd/Ctrl+Enter to send, Esc to cancel stream), error UI with retry button, auto-scroll opt-out.
- Feedback widget: small floating button on every page, opens a dialog that posts to `/api/feedback`.

### Test Requirements

- Unit: Zod schemas accept valid payloads, reject malformed; KV wrapper round-trips; markdown renderer treats hostile inputs safely (XSS test vectors from OWASP).
- Integration: full happy-path session start → chat → end; email exhaustion → 429; invalid token → 401; Anthropic failure → 502 with no KV increment.
- Playwright: submit email → see chat UI; send a starter prompt → stream appears; counter decrements.

### Definition of Done

- Original `src/opchain-try.js` + `public/tryit.js` deleted.
- All three API endpoints return validation errors with consistent shape `{ error, code }`.
- No direct `env.DATA.*` calls from handlers.
- Zero regressions vs. current Try-It feature set.

### Dependencies

Sprint 1 (skill catalog with `tryPrompt`), Sprint 3 (page shells).

### Estimated Effort

CLAUDE: 16 | USER: 2 (test the feedback widget, review new error copy)

---

## Sprint 5: API Hardening & Security Polish

**Goal:** Remaining security + observability gaps from the reverse-spec.

### Features

- M5 (no CSP / X-Frame-Options / Referrer-Policy / Permissions-Policy), M6 (lead data TTL), L10 (wrangler schema URL), L5 (upstream request-IDs — finishes what Sprint 4 started).

### Deliverables

- `applySecurityHeaders` extended: CSP with `default-src 'self'; script-src 'self'; connect-src 'self' https://api.anthropic.com; style-src 'self' 'unsafe-inline'` (or nonce-based), Referrer-Policy `strict-origin-when-cross-origin`, X-Frame-Options `DENY`, Permissions-Policy sensible defaults.
- Lead KV entries TTL of 365 days (configurable via `LEAD_TTL_DAYS` env).
- Structured JSON log lines for: feedback submitted, chat started, chat completed, rate-limit hit, upstream failure. One-line schema documented.
- Light e2e smoke test that runs post-deploy against staging, hitting `/api/health` + `/` + `/opchain-skills.zip` + sending a fake feedback (test mode flag).
- Dependabot / Renovate config file for weekly `esbuild`, `wrangler`, `astro`, `tailwindcss` bumps.
- README + `CLAUDE.md` updated to reflect the new layout, scripts, and envs.

### Test Requirements

- Integration: every API response includes the expected security headers; a request without `Origin` still gets nosniff + HSTS; CSP blocks inline scripts in a Playwright test page.
- Lighthouse: Best Practices ≥ 95.

### Definition of Done

- All HIGH and MED gaps from `reverse-spec-output/gap-analysis.md` closed or explicitly deferred.
- No fallback secrets, no hardcoded model, no hardcoded Linear IDs.
- Weekly dependency PRs auto-opened.

### Dependencies

Sprint 4 (handlers live in TS, easy to extend).

### Estimated Effort

CLAUDE: 8 | USER: 1 (review log schema, confirm CSP doesn't break anything user-expected)

---

## Sprint 6: Cutover & Launch

**Goal:** Swap `opchain.dev` from the old `public/` + `src/` to the new
`site/` output with zero visitor-visible downtime.

### Features

- Migration mechanics, final launch checklist.

### Deliverables

- Redirect map for any URL changes (`/architecture.html` → `/architecture`, `/install.html` → `/install`, `/skills.html` → `/skills`, `/tryit.html` → `/tryit`). Implemented via Astro redirects or Worker router.
- `wrangler deploy` now emits the Astro build; old `src/index.js` + `build.mjs` removed.
- Smoke tests from Sprint 5 run against prod post-deploy; rollback script documented (`wrangler rollback`).
- Analytics: Cloudflare Web Analytics beacon added (opt-in at roadmap review).
- Feedback PR posted to `asfbay-bit/opchain` with the full diff; old `public/` + `src/` deleted in the same commit so history is clean.
- Launch checklist run per `skills/app-architect/SKILL.md` L449–L460: audit green (→ invoke code-auditor `/audit full`), staging green for 24 h, monitoring in place.

### Test Requirements

- Playwright smoke suite runs in prod post-deploy and fails the deploy action on regression.
- Old trailing-slash and `.html` paths redirect (301) to the new routes.
- Lighthouse Desktop + Mobile on `/`: Performance ≥ 95, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95.

### Definition of Done

- `opchain.dev` serves the new site.
- Zero 5xx in the first 60 minutes post-cutover.
- Rollback rehearsed at least once in staging.
- Old files deleted in the repo.

### Dependencies

All prior sprints.

### Estimated Effort

CLAUDE: 10 | USER: 3 (launch day availability, final approval, sign-off on analytics)

---

## Build Order summary

Follows app-architect Phase 4 "Build Order" guidance (`SKILL.md` L260–L268):

1. **Sprint 0:** scaffold foundation (CI, staging, safety rails).
2. **Sprint 1:** data layer (skills content source of truth).
3. **Sprint 2:** design tokens + base components.
4. **Sprint 3:** screen pages from the punch list.
5. **Sprint 4:** backend/frontend hookup (Try-It).
6. **Sprint 5:** polish, a11y, security headers.
7. **Sprint 6:** deploy + cutover.

---

## Total effort (estimate)

| Sprint | CLAUDE hrs | USER hrs | Cum CLAUDE |
|---|---|---|---|
| 0 — Foundation | 6 | 2 | 6 |
| 1 — SSoT | 10 | 1 | 16 |
| 2 — Design v2 | 14 | 3 | 30 |
| 3 — Page rebuilds | 18 | 2 | 48 |
| 4 — Try-It rewrite | 16 | 2 | 64 |
| 5 — Hardening | 8 | 1 | 72 |
| 6 — Cutover | 10 | 3 | 82 |
| **Total** | **82 hrs** | **14 hrs** | — |

Calendar-wise, if run with one build session per weekday on app-architect's
Generator → Evaluator loop (~1 sprint per 1–2 days including iteration),
expect **2–3 weeks end-to-end**.

---

## What this roadmap explicitly defers

- Adding new product features (beyond the per-skill detail page).
- Light mode / theme switcher (token structure allows for it later).
- User accounts / saved Try-It conversations.
- Payments / upgrade path / pricing page (no commercial motion yet).
- Migration to D1 or R2.
- i18n.
- Interactive diagrams (architecture uses static mermaid; future sprint could make them pan/zoomable).
