# Sprint 7c Contract — CSP nonce migration

Negotiated by app-architect on 2026-04-19. Closes the CSP gap from
`roadmap/03-post-launch.md` "what else" #1, per
`roadmap/04-sprint-7-revised.md` Sub-sprint 7c.

## Goal

Drop `'unsafe-inline'` from `script-src` so CSP reviewers stop flagging
the site. Keep `style-src 'unsafe-inline'` for now (Tailwind utility
patterns occasionally inject inline `style=` attributes; nonce-on-style
is more invasive than the value adds).

## Approach: build-time placeholder + runtime Worker substitution

Verified during contract negotiation that:

- The built site has 5–6 inline `<script>` tags per page (theme init,
  consent banner, Astro module bundles for theme toggle / privacy
  reset / feedback widget, plus per-page islands).
- Hash-based CSP would require regenerating ~6 hashes per build and
  growing the CSP header proportionally; brittle when scripts change.
- Strict-dynamic + nonce on inline + script-src 'self' for externals
  is the canonical pattern.

Chosen mechanism: bake a static placeholder `nonce="__OPCHAIN_NONCE__"`
on every inline script during build, then have the Worker substitute
that placeholder with a per-request random nonce on every HTML
response. Single string replacement, no HTML parsing cost.

## Deliverables

1. **Build step:** `scripts/inject-nonce-placeholder.mjs` — walks
   `public/**/*.html` after Astro emits and adds
   `nonce="__OPCHAIN_NONCE__"` to every `<script>` tag (inline or
   external — externals also need it under strict-dynamic). Idempotent
   so repeated runs don't double-stamp. Wired into the prebuild
   pipeline immediately after `astro build`.
2. **Worker substitution** (`src/index.js`):
   - Generate a per-request nonce (16 bytes from `crypto.getRandomValues`,
     base64-url encoded) for every HTML response.
   - Substitute `__OPCHAIN_NONCE__` with the actual nonce in the
     response body. Use a `TransformStream` + `TextDecoder` /
     `TextEncoder` for streaming, OR `response.text()` then re-wrap if
     simpler — measure the size first.
   - CSP header now reads
     `script-src 'self' 'nonce-{N}' 'strict-dynamic' https://*.i.posthog.com https://static.cloudflareinsights.com`
     with the same nonce token. `'strict-dynamic'` lets nonce-blessed
     scripts load further scripts without re-listing hosts; the
     allow-list stays for legacy fetchers (Safari, etc.).
3. **Tests** (`tests/csp-nonce.test.js`):
   - Unit: nonce generator returns 16 bytes, base64-url, ≥ 22 chars.
   - Integration: `applySecurityHeaders` on an HTML response writes a
     CSP header with `nonce-...`, no `'unsafe-inline'` in `script-src`.
   - Integration: HTML body returned by the Worker has every `<script>`
     tag carrying the same nonce as the CSP header.
4. **Update existing tests** that assert on the old CSP header
   (`tests/security-headers.test.js` — verify what it currently asserts
   and adjust).
5. **Playwright extension** (`site/tests/e2e/routes.spec.ts` or new
   `csp.spec.ts`): assert `page.consoleErrors()` contains zero
   `Refused to execute inline script` messages on every route. Done as
   a separate test in the existing `e2e` job.
6. **README/CLAUDE.md note** — short paragraph on why the placeholder
   token exists in the build output and what does the substitution.

## Testable Criteria

| # | Criterion | How to verify |
|---|---|---|
| C1 | `'unsafe-inline'` gone from `script-src` | grep `src/index.js`; assert in unit test |
| C2 | Per-request nonce in CSP header | unit test on `applySecurityHeaders` |
| C3 | Inline scripts carry the same nonce | integration test against Worker `fetch` |
| C4 | Browser console clean on every route | Playwright check |
| C5 | `securityheaders.com` rating ≥ A | manual one-off after deploy |
| C6 | `style-src` still permits `'unsafe-inline'` | explicit test (no regression) |

## Out of scope

- Style-src nonce migration. Tailwind 4's runtime utilities occasionally
  inject `style="…"` on elements; nonce-on-style would require a
  separate sweep. Backlog item B-08 (added to `05-post-sprint-7-backlog.md`).
- CSP report-uri / report-to — useful but adds an endpoint. Backlog.
- Subresource Integrity (SRI) on the Cloudflare Insights + Google
  Fonts links. Backlog.

## Definition of Done

- All four `Worker` Vitest categories still pass plus the new
  `csp-nonce.test.js` (≥3 new tests).
- Playwright e2e adds the console-clean assertion; passes in CI.
- The CSP header on a fresh `wrangler dev` request includes
  `nonce-` and excludes `'unsafe-inline'` from `script-src`.
- The same nonce appears on every `<script>` tag in the rendered HTML.
- Sprint 7 checkpoint marks `sprint-7c` complete; Sprint 7 itself
  marked complete (with the 7b debt logged via PR #46).
