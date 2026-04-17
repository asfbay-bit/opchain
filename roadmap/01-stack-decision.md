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

## Analytics

**Cloudflare Web Analytics** — privacy-first, free, one `<script>` tag.
Optional; confirm before Sprint 3 includes it.

## Cost estimate

- Workers Free → $0 until 100k requests/day.
- Anthropic Haiku usage scales with Try-It demand; dominant cost under any
  realistic traffic. Assume ≤ $50/mo at current demo cap.
- Linear + GitHub — unchanged (team already pays).
- Net: **no new line items** from the redesign.
