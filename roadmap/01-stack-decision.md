# Stack Decision (stack-forge auto-invoke)

App-architect Phase 2 auto-invokes stack-forge before Phase 4. Since the
reverse-spec establishes the current stack as the baseline, this section
records the decision for the **redesign**, not the original build.

## Platform: Cloudflare Workers + Workers Assets

**Keep.** Reasons:
- Existing domain, existing KV namespace, existing secrets — migration cost = 0.
- Edge-first latency is ideal for a marketing site with a chat streaming endpoint.
- Free tier covers realistic opchain.dev traffic.
- `run_worker_first: true` gives us the custom routing we need (zip download headers, root rewrites, future redirects) without a separate CDN layer.

Alternatives considered: Cloudflare Pages (simpler but the Worker layer with
custom route logic is already warranted); Vercel (good DX but reintroduces
vendor lock-in and cost); self-hosted (no).

## Frontend framework: Astro 5

**Adopt.** Reasons:
- Content-collection APIs map naturally to `skills/<id>/SKILL.md` frontmatter — we parse each SKILL.md as a typed collection entry and render detail pages automatically.
- Zero-JS by default; islands (`client:load`) only where interactivity is needed (skill-library filter, Try-It chat). Keeps Lighthouse scores high.
- First-class CF Workers adapter (`@astrojs/cloudflare`) outputting a single Worker that serves the static site + API routes.
- MDX support lets the Architecture page embed real mermaid diagrams and code samples.
- Native TS throughout.

Alternatives considered:
- **Keep vanilla HTML** — simplest but loses content-collection, means continuing to hand-maintain `skills.js`. Drops us back into the drift problem we're trying to solve.
- **Next.js / SvelteKit / Remix** — overkill for a 5–15 page site with one streaming endpoint.
- **Eleventy** — good for static-only, but doesn't give us the TypeScript/type-safety story or islands for the chat UI.

## Backend runtime: Cloudflare Worker (TypeScript)

**Rewrite `src/` as TypeScript.** Reasons:
- Closes gap M9 (typed pipeline) without adopting a server framework.
- Plays with Astro's CF adapter (Astro emits the Worker; our API handlers live under `src/pages/api/` or as standalone Astro endpoints).
- Keeps the single-Worker deploy model.

## Storage: Cloudflare KV (unchanged)

**Keep.** Three key patterns; wrap behind a typed module (`src/lib/kv.ts`) so
shapes are defined once.

No database needed. If lead capture grows, consider D1 in a future roadmap.

## Auth: none (site) + HMAC session (Try-It)

**Keep the HMAC session pattern, but make it fail-closed.** `DEPLOY_API_TOKEN`
becomes required at request time; no fallback literal.

## Validation: Zod

**Adopt.** Reasons:
- Runtime validation for every API input.
- Inferred TypeScript types from Zod schemas — one source of truth for shapes.
- Tiny (zod-mini variant if bundle size matters on the Worker).

## Styling: Tailwind 4 + CSS variables

**Adopt Tailwind 4** with the existing brand palette defined as CSS
variables (so non-utility CSS can still reach them). Rationale:
- Preserves the current design tokens (`--bg`, `--surface`, `--accent`, etc.) as
  the canonical source.
- Utility classes for rapid component composition.
- Generated styleguide page lists every utility in use (scripted from the
  Tailwind config).

Dark-mode remains the only theme; no light-mode work in this roadmap (but
the token structure leaves room for it).

## Testing: Vitest + Miniflare + Playwright

- **Vitest** — unit tests for lib modules, handlers (with a KV mock), markdown render.
- **Miniflare** / `unstable_dev` — integration tests against the Worker.
- **Playwright** — smoke tests for critical paths (homepage loads, skill library filter works, Try-It gate accepts email). Runs in CI on every PR.

## CI/CD: GitHub Actions + `cloudflare/wrangler-action`

- PR: lint, type-check, test, build, preview deploy to `preview-<pr>.opchain.dev` (via Astro's CF Pages-style preview or a wrangler env).
- Main merge: deploy to `staging.opchain.dev`, run smoke tests, then (on green) promote to `opchain.dev`.
- OIDC for CF credentials — no long-lived tokens in GitHub.

## Observability: Cloudflare Logs + structured `console.log` JSON

No external vendor. Enough for this scale.

## Analytics: Cloudflare Web Analytics + PostHog Cloud

Two-tier:

**Tier 1 — Cloudflare Web Analytics.** Pageviews, referrers, Core Web
Vitals. One `<script>` tag, cookieless, no consent banner needed. Wired
into the global Astro layout (`site/src/layouts/Base.astro`) in Sprint 6.

**Tier 2 — PostHog Cloud.** Event-level funnel tracking:

| Event | Fired from | Purpose |
|---|---|---|
| `$pageview` | client (PostHog SDK autocapture) | Deduped pageviews for the funnel |
| `notify_submitted` | server (`/api/notify` 2xx) | Top of funnel — lead capture from `CaptureModal` |
| `feedback_submitted` | server (`/api/feedback` 2xx) | Qualitative signal |
| `zip_downloaded` | server (`GET /skills/*.zip`, `GET /opchain-skills.zip`) | Conversion proxy |
| `install_copy_clicked` | client (`/install` page) | CTA efficacy per install flow |

The Try-It chat events (`demo_email_submitted`, `demo_chat_started`,
`demo_chat_completed`, `demo_skill_selected`) were retired with the
email-gated chat in `claude/remove-try-it`. The new `/demo` is a
static walkthrough; if we add interaction events for it later, they
should follow the `demo_*` namespace and land here.

Declared in `site/src/lib/analytics.ts` as `ClientEvent` but **not
yet wired** (kept reserved so call sites don't invent ad-hoc names):
`skill_filter_used`, `skill_detail_viewed`, `in_action_scenario_opened`.
Wire them in the matching components when the corresponding UX questions
become real (filter usage on `/skills`, detail-page engagement, demo
scenario opens). Until then, dashboards depending on them will be empty.

Rationale:

- Client SDK only loads **after** consent; server-side `capture()` calls fire
  unconditionally (no PII included — hashed email as `distinct_id` for
  funnel stitching; actual email stays in KV, not in PostHog).
- Event taxonomy lives in `site/src/lib/analytics.ts`; every call goes
  through a typed wrapper so event names + properties stay consistent.
- PostHog Cloud EU for GDPR alignment; project API key stored as a
  non-secret env var (it's client-visible anyway).
- Session replay, feature flags, experiments — all available in PostHog
  but **off** by default for this roadmap.

Consent banner (Sprint 5): simple accept/decline bar, choice persisted in
`localStorage`, respected before any PostHog client init. No CF WA gating
(it's cookieless).

## Privacy

`/privacy` page added in Sprint 6 documenting:
- What's collected (pageviews via CF WA, funnel events via PostHog after
  consent, emails via Try-It KV).
- Retention (lead TTL 365 days; PostHog event retention per their plan).
- User controls (cookie opt-out link, mailto for data export/delete).

## Cost estimate

- Workers Free → $0 until 100k requests/day.
- Anthropic Haiku usage scales with Try-It demand; dominant cost under any
  realistic traffic. Assume ≤ $50/mo at current demo cap.
- PostHog Cloud free tier: 1M events/mo + 5K session recordings. At
  opchain.dev's scale, well within free. Upgrade only if recordings are
  enabled.
- Cloudflare Web Analytics: free.
- Linear + GitHub — unchanged (team already pays).
- Net: **no new line items** at the expected traffic level.
