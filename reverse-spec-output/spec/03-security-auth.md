# 03 — Security & Auth

## Current State

### Auth model

There is **no user auth**. The site is public and read-only for most routes. The
only authenticated surface is the **Try It demo**, which uses a lightweight
email-gated session token.

#### Session token

- Format: `<uuid>:<email>:<base64-HMAC-SHA256>`
- Signed with env var `DEPLOY_API_TOKEN` (falls back to literal
  `'opchain-dev-secret'` if not set — **risk**, see gaps).
- Verified on every `/api/try/chat` call.
- Not persisted server-side (the email is extracted from the token itself on verify).

Source: `src/opchain-try.js` L154–L193.

#### Email validation

`isValidEmail` uses `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Deliberately permissive;
good enough for a marketing gate, not for authenticated product access
(`src/opchain-try.js` L149–L151).

### Authorization

None beyond "the skill must be in `SKILL_PROMPTS`" (`src/opchain-try.js` L312–L315).
No roles, no per-user entitlements. The rate limit is the control.

### Rate limiting (per-session)

| Limit | Value | Scope | Implementation |
|---|---|---|---|
| Sessions per IP per hour | 20 | IP (from `CF-Connecting-IP`) | KV `opchain-try-ip:{ip}` window, `IP_WINDOW_SEC=3600`, `IP_MAX_SESSIONS=20` |
| Exchanges per email per 24h | 5 | email (lowercased) | KV `opchain-try-email:{email}`, `EMAIL_TTL_SEC=86400`, `MAX_EXCHANGES=5` |
| Max tokens per response | 2048 | per-request | `MAX_TOKENS` constant |
| Max messages passed to Anthropic | `MAX_EXCHANGES * 2` = 10 | per-request | `cleanMessages.slice(-10)` |
| Max content chars per message | 4000 | per-message | `String(m.content).slice(0, 4000)` |

Source: `src/opchain-try.js` L7–L13, L201–L221, L346–L351.

### CORS

- Allowed origins list: 7 exact-match origins (opchain.dev, www.opchain.dev, Cloudflare
  default worker domain, aidops.dev, www.aidops.dev, localhost:8787, localhost:3000).
- Method allow list: `POST, OPTIONS`.
- Headers allow list: `Content-Type`.
- Credentials: not set (implicitly disallowed).

Source: `src/index.js` L41–L49, L60–L71.

### Security headers

Applied to every static response via `applySecurityHeaders`:

- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

**Missing:** CSP, Referrer-Policy, X-Frame-Options / frame-ancestors, Permissions-Policy.
Source: `src/index.js` L73–L78.

### Secrets

| Env var | Used by | Source of truth |
|---|---|---|
| `LINEAR_API_KEY` | `handleFeedback` | `.dev.vars` + Cloudflare dashboard |
| `ANTHROPIC_API_KEY` | `handleChat` | `.dev.vars` + Cloudflare dashboard |
| `DEPLOY_API_TOKEN` | HMAC signer for session tokens | `.dev.vars` + Cloudflare dashboard |

`CLAUDE.md` documents these; there is no `.env.example` in the repo.

### Lead data

Emails of Try It users are persisted to KV (`opchain-leads:{email}`) **with no TTL**.
This is the only persistent PII collected by the system (`src/opchain-try.js` L273–L282).

### Confidence

| Claim | Confidence |
|---|---|
| No user auth | HIGH — no login UI, no user records, no OAuth |
| HMAC-SHA256 signing for session tokens | HIGH — direct from code |
| Lead data has no TTL | HIGH — `put` call omits `expirationTtl` |
| Fallback secret is the literal string `opchain-dev-secret` | HIGH — `src/opchain-try.js` L285 and L306 |

## Gaps & Recommendations

| Finding | Impact | Recommendation |
|---|---|---|
| **Hardcoded fallback secret** `'opchain-dev-secret'` is used if `DEPLOY_API_TOKEN` is not set. If prod ever deploys without the env var, tokens become forgeable. | HIGH | Fail-closed: throw/500 if `DEPLOY_API_TOKEN` is unset, rather than silently defaulting. |
| **No CSP** on static pages | MEDIUM | Add `Content-Security-Policy` with `default-src 'self'; script-src 'self'`. The `tryit.js` markdown renderer sets innerHTML from LLM output; CSP is a defense-in-depth layer alongside `escapeHtml`. |
| **Client XSS surface in `renderMarkdown`** | MEDIUM | `tryit.js` L411–L470 hand-rolls markdown. It escapes HTML before parsing, but any future change could regress. Consider `DOMPurify` or a vetted renderer. |
| **No `X-Frame-Options`/`frame-ancestors`** | MEDIUM | Add to `applySecurityHeaders`. |
| **No per-email spam check** — anyone can submit arbitrary lookalike emails to fill the leads table | LOW | Current rate limit (20 IP/hr) caps abuse at ~480/day per attacker IP. Adding a disposable-email check (e.g. via Mailcheck list) would help. |
| **Lead data TTL absent** | MEDIUM | Add TTL (e.g. 1 year) or document retention policy. |
| **CORS allow list includes `aidops.dev`** — historical but should be audited | LOW | Confirm aidops still embeds opchain APIs; if not, remove. |
| **No CSRF on `/api/feedback`** — but POST + Content-Type check + CORS origin match is the de-facto mitigation. | LOW | Accept as-is given stateless design; document the reasoning. |
| **`console.error` logs contain Linear response bodies** (`src/index.js` L155) | LOW | May leak issue IDs to logs; acceptable for internal observability. |
