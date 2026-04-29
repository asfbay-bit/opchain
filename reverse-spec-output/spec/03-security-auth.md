# 03 — Security & Auth

_Refreshed 2026-04-28 by `/reverse-spec` targeted update. Replaces the
2026-04-17 version, which still described the email-gated Try-It auth
surface (deleted in `claude/remove-try-it`) and called CSP "Missing"
(shipped in Sprint 7c)._

## Current State

### Auth model

There is **no user auth and no session state**. Every route is public.
The previous email-gated Try-It chat — which carried HMAC-signed session
tokens, IP/email rate-limits, and an `ANTHROPIC_API_KEY` exchange — was
removed. Stale clients hitting `/api/try/*` get a clean **410 Gone** with
`{ "error": "The Try-It chat has been removed." }`.

Source: `src/index.js:381-388`, plus `claude/remove-try-it` history in
`git log` (commit `6511b1d`).

### Authorization

None. The Worker authorizes by route shape only — `POST /api/feedback`,
`POST /api/notify`, `GET /api/health`, plus the assets pass-through. No
roles, no per-user entitlements, no admin surface.

### Rate limiting

| Limit | Value | Scope | Implementation |
|---|---|---|---|
| `/api/notify` submissions per IP | 3 / 60s | `CF-Connecting-IP` | KV `ratelimit:notify:{ip}` with `expirationTtl: 60` |

That is the entire rate-limit surface. If `env.NOTIFY` (KV) isn't bound,
the limit is skipped and the submission still succeeds — the handler
degrades open by design (see `src/index.js:295-303`).

`/api/feedback` has **no rate limit**. The de-facto controls are CORS
allow-list, Zod schema validation, and Linear's own throttling.

Source: `src/index.js:262-329` (`handleNotify`).

### CORS

- **Allowed origins (8):** `opchain.dev`, `www.opchain.dev`,
  `staging.opchain.dev`, `opchain-dev.4fstpkkw72.workers.dev`,
  `aidops.dev`, `www.aidops.dev`, `localhost:8787`, `localhost:3000`,
  `localhost:4321`.
- **Methods:** `POST, GET, OPTIONS`
- **Headers:** `Content-Type, X-Opchain-Request-Id`
- **Exposed:** `X-Opchain-Request-Id, X-Opchain-Version`
- **Credentials:** not set (implicitly disallowed)

Source: `src/index.js:35-46, 49-65`.

### Security headers — full stamp

Applied to every response by `applyBaselineHeaders` (idempotent, called
both inside the asset path and unconditionally in the outer `fetch`):

```
X-Content-Type-Options:        nosniff
Strict-Transport-Security:     max-age=31536000; includeSubDomains
X-Frame-Options:                DENY
Referrer-Policy:                strict-origin-when-cross-origin
Permissions-Policy:             camera=(), microphone=(), geolocation=(),
                                payment=(), usb=(), accelerometer=(),
                                gyroscope=(), magnetometer=()
```

Source: `src/index.js:73-82` (constants), `src/index.js:104-109`
(`applyBaselineHeaders`), `src/index.js:493-501` (`fetch` outer stamp).

### Content Security Policy (Sprint 7c)

CSP is HTML-only — non-HTML responses get the baseline headers above
without a CSP. For HTML responses the Worker:

1. Reads the body from the assets binding.
2. Generates a fresh **per-request 16-byte base64url nonce** via
   `crypto.getRandomValues` (`generateNonce`, `src/index.js:91-98`).
3. Substitutes `__OPCHAIN_NONCE__` in the body with that nonce.
   The placeholder is stamped onto every `<script>` tag at
   build time by `scripts/inject-nonce-placeholder.mjs`. The most
   recent eval (Sprint 7c eval-round-1) measured 105 `<script>` tags
   across 20 HTML files.
4. Emits the matching CSP header.

Built CSP (`buildCspHtml`, `src/index.js:100-112`):

```
default-src 'self';
script-src  'self' 'nonce-<n>' 'strict-dynamic'
            https://*.i.posthog.com
            https://static.cloudflareinsights.com;
connect-src 'self'
            https://*.i.posthog.com
            https://cloudflareinsights.com;
style-src   'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src     'self' data:;
font-src    'self' https://fonts.gstatic.com;
frame-ancestors 'none';
base-uri    'self';
form-action 'self'
```

`'unsafe-inline'` was removed from `script-src` in Sprint 7c. It remains
on `style-src` because Tailwind 4 emits inline `style=` attributes;
converting that is backlog item B-08.

`'strict-dynamic'` is present on `script-src` so a nonce-blessed script
can load further scripts (notably PostHog) without listing additional
hashes. The explicit `https://*.i.posthog.com` and
`https://static.cloudflareinsights.com` hosts remain for browsers
that don't honour `'strict-dynamic'`.

Source: `src/index.js:84-112` (constants + builders),
`src/index.js:198-218` (`applySecurityHeaders` HTML branch), test
coverage in `tests/csp-nonce.test.js` and `tests/security-headers.test.js`.

### Input validation

Every POST endpoint runs through `parseBody(request, schema)` from
`src/lib/schemas.js`, which:

- Rejects non-JSON bodies with `{ code: "invalid_json" }`, status 400.
- Rejects schema mismatches with `{ code: "invalid_body", issues }` and
  Zod's per-field error trail, status 400.

Schemas (`src/lib/schemas.js`):

- `FeedbackSchema` — `type` ∈ {bug, feature, improvement, general},
  `title` 3–200 chars, `description` ≤ 5000 chars,
  `priority` 0–4, optional `skill` ≤ 60 chars, optional valid `email`.
- `NotifySchema` — `email` required, optional `role`/`teamSize`/`building`
  (≤ 280 chars), `source` ∈ {install, skill-download, bundle-download,
  homepage, other}.

### Secrets

| Env var | Used by | Notes |
|---|---|---|
| `LINEAR_API_KEY` | `handleFeedback` | Without it, /api/feedback returns 503 `not_configured` |
| `LINEAR_TEAM_ID` / `LINEAR_PROJECT_ID` | `handleFeedback` | Optional overrides; defaults baked in |
| `POSTHOG_PROJECT_API_KEY` | `src/lib/analytics.js` | Without it, server-side capture is a silent no-op |
| `POSTHOG_HOST` | `src/lib/analytics.js` | Defaults to `https://eu.i.posthog.com` |
| `PUBLIC_POSTHOG_KEY` | site/Astro at build time | Without it, the consent banner still renders but accept is a no-op |
| `PUBLIC_POSTHOG_HOST` | site/Astro at build time | Defaults to `https://eu.i.posthog.com` |

A real `.env.example` now exists at the repo root, replacing the
"discoverable only by reading code" state of the previous spec.

`ANTHROPIC_API_KEY` and `DEPLOY_API_TOKEN` are **gone** — both belonged
to the deleted Try-It chat. If they're still set as Cloudflare secrets
in the dashboard, they're inert.

### Lead data (PII)

`/api/notify` writes lead records to KV `NOTIFY` under the key
`lead:<sha256(lower(email))>`:

```jsonc
{
  "email": "<plaintext>",
  "role": "...",
  "teamSize": "...",
  "building": "...",
  "source": "install | skill-download | bundle-download | ...",
  "ip": "<CF-Connecting-IP>",
  "userAgent": "...",
  "submittedAt": "ISO-8601",
  "requestId": "<uuid>"
}
```

The plaintext email is stored *inside* the value; the key is hashed for
opaqueness if KV is exfiltrated and for idempotent upserts (re-submit
overwrites). **No TTL** is set — lead retention is unbounded.

Source: `src/index.js:262-329`.

### Confidence

| Claim | Confidence |
|---|---|
| No user auth, no session tokens | HIGH |
| CSP `script-src` enforces nonce + strict-dynamic | HIGH (Vitest covers nonce uniqueness, placeholder substitution, header content) |
| `style-src` retains `unsafe-inline` | HIGH (B-08 backlog) |
| Lead data has no TTL | HIGH (no `expirationTtl` on the `lead:` put) |
| Anthropic / Try-It auth fully removed | HIGH (verified — no `ANTHROPIC_API_KEY` reference, /api/try → 410) |

## Gaps & Recommendations

| Finding | Impact | Recommendation |
|---|---|---|
| **Lead data TTL absent** — `lead:` KV entries persist indefinitely | MEDIUM | Add explicit `expirationTtl` (e.g. 18 months) or document the retention decision in `docs/privacy.md` |
| **`style-src` still allows `unsafe-inline`** (B-08) | LOW–MED | Migrate Tailwind utilities that emit inline `style=` (or move to CSS variables); then drop `unsafe-inline` from `style-src` |
| **`/api/feedback` has no rate limit** | LOW | The Linear API key is the upstream cap; consider per-IP throttling (the same pattern as `/api/notify`) once a feedback-spam incident actually occurs — premature otherwise |
| **CORS allow-list still includes `aidops.dev` / `www.aidops.dev`** | LOW | Audit whether aidops still embeds opchain APIs; remove if not. Also confirm the workers.dev default domain is still desired |
| **No CSP browser-level verification in CI** (B-09) | LOW | Backlog: swap the Playwright `webServer` to `wrangler dev` so e2e covers a real CSP-served HTML response and asserts no "Refused to execute inline script" console errors |
| **`Content-Length` deletion on the HTML CSP path** | LOW | Documented in code; relies on Cloudflare adding `Transfer-Encoding`. Worth a regression test if the runtime ever changes |
