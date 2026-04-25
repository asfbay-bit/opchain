import type { Walkthrough } from "./types";

/**
 * Scenario 6 — security-auditor runs the posture + hardening pass on a
 * live SaaS heading into SOC2. code-auditor runs the code-level pass
 * underneath (chain). Demonstrates the quality-gate pair that now sits
 * between build and deploy: code-auditor finds code bugs, security-auditor
 * asks "what's the threat model?" and "is the infra hardened?"
 */
export const securityHardening: Walkthrough = {
  id: "security-hardening",
  title: "Pass a security review before SOC2 audit",
  tagline: "SOC2-ready in one pass",
  summary:
    "A pre-audit posture review: STRIDE threat model, OWASP mapping, CSP + TLS + WAF hardening, and a remediation PR list.",
  description:
    "A Next.js SaaS with 80 paying customers is heading into its first SOC2 audit. Sales already promised it'd be ready. The founder wants to know what's going to fail before the auditor finds it. security-auditor runs its four-stage sweep — threat model (STRIDE), OWASP Top 10 compliance mapping, infrastructure hardening (CSP, TLS, DNS, WAF, Cloudflare config), and attack-surface mapping — and produces a prioritised remediation list. code-auditor chains in underneath for the code-level findings. deploy-ops is informed that the next prod deploy must clear both gates. The output is a one-screen posture score plus a ranked backlog of fixes the team can burn through in a sprint.",
  inputs: [
    "Live Next.js SaaS · Cloudflare in front · Supabase Postgres · 80 paying customers",
    "First SOC2 Type I audit in ~6 weeks",
    "Founder has read the OWASP Top 10 once; nobody on the team is a security specialist",
    "No existing threat model; no documented CSP; WAF is on default Cloudflare ruleset only",
  ],
  outputs: [
    {
      id: "threat-model",
      label: "STRIDE threat model + OWASP map",
      kind: "threat-model.md",
      body:
`# Threat Model — heads-down-app

**Produced by** security-auditor Phase 1 (Threat Model) · **Method:** STRIDE per trust boundary

## System boundaries

\`\`\`
[browser] ──https──► [cloudflare edge] ──https──► [vercel / next.js] ──tls──► [supabase]
                           │
                           └──► [stripe] ──https──► [back-channel webhooks]
\`\`\`

Three trust boundaries:

1. **Internet → Edge** (Cloudflare). WAF, bot protection, rate-limit live here.
2. **Edge → App** (Vercel). TLS terminated again; request identity is the user session cookie.
3. **App → Data** (Supabase). Postgres RLS and per-row policies are the last line.

## STRIDE findings (ranked by exploitability × impact)

| # | Category | Component | Finding | Sev |
|---|----------|-----------|---------|-----|
| 1 | **T**ampering | App → Supabase | Service-role key used for tenant-isolated queries instead of per-tenant JWT; RLS is effectively bypassed. | CRITICAL |
| 2 | **I**nfo disclosure | Edge → App | No \`Content-Security-Policy\` header; any script injection has full reign over the page. | HIGH |
| 3 | **D**enial of service | Internet → Edge | Cloudflare WAF is on default rules; \`/api/*\` has no rate-limit; no Challenge page on suspicious traffic. | HIGH |
| 4 | **I**nfo disclosure | App | Error responses include stack traces in production (500s reveal source paths). | HIGH |
| 5 | **S**poofing | App | Session cookie is \`HttpOnly\` but not \`SameSite=Strict\` — CSRF on any state-changing GET. | MEDIUM |
| 6 | **E**levation of privilege | App | Admin role is checked at the route level, not at the data level. RLS does not enforce it. | MEDIUM |
| 7 | **R**epudiation | App | No audit log for admin actions (user impersonation, plan change, team transfer). | MEDIUM |
| 8 | **T**ampering | App ↔ Stripe | Webhook endpoint verifies signature ✓, but not IP origin; relies solely on HMAC. | LOW (defence-in-depth gap) |

## OWASP Top 10 (2021) compliance map

| # | Category | Status | Notes |
|---|----------|--------|-------|
| A01 | Broken Access Control | **FAIL** | Finding #1, #6 |
| A02 | Cryptographic Failures | PASS | TLS 1.3 only; no plaintext at rest; no hand-rolled crypto. |
| A03 | Injection | PASS | Parameterised queries throughout; no string-concat SQL; input validation via Zod at edges. |
| A04 | Insecure Design | **PARTIAL** | No threat model on file before this one; auth-flow design documented but not adversarial-reviewed. |
| A05 | Security Misconfiguration | **FAIL** | Finding #2, #3, #4 |
| A06 | Vulnerable Components | PASS | \`npm audit\` clean; automated weekly PRs via Dependabot. |
| A07 | Identification & Auth | PASS | Session cookies HttpOnly; bcrypt for passwords; OAuth handled by auth provider. |
| A08 | Software / Data Integrity | PASS | Deploys signed; no dynamic \`eval\` or unsigned remote script. |
| A09 | Logging & Monitoring | **PARTIAL** | App errors logged; admin actions not (Finding #7). |
| A10 | Server-Side Request Forgery | PASS | No user-supplied URLs are fetched server-side. |

## Recommendation

Findings #1 and #2 are the hard blockers for SOC2 — an auditor will flag them inside 10 minutes. Findings #3, #4 are SOC2 Common Criteria CC6.1 (logical access) concerns. The rest are SOC2-adjacent but acceptable for Type I if on a roadmap.

Chaining to **code-auditor** for a code-level sweep underneath this posture review — we want to know if the RLS bypass (Finding #1) is actually triggered from any route, not just theoretically possible.

Checkpoint: \`.checkpoints/security-auditor.checkpoint.json\`.`,
    },
    {
      id: "hardening-plan",
      label: "Infrastructure hardening plan",
      kind: "hardening.md",
      body:
`# Infrastructure Hardening Plan

**Produced by** security-auditor Phase 3 (Hardening) · **Targets:** edge, DNS, TLS, CSP, WAF, error handling

## CSP — \`Content-Security-Policy\`

Ship a strict CSP with a per-request nonce, in **report-only mode for 7 days** before enforcing. This catches false positives before they break customer flows.

\`\`\`
Content-Security-Policy-Report-Only:
  default-src 'self';
  script-src 'self' 'nonce-{{nonce}}' https://cdn.stripe.com;
  style-src 'self' 'nonce-{{nonce}}';
  img-src 'self' data: https://*.supabase.co;
  connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co;
  frame-src https://js.stripe.com https://hooks.stripe.com;
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  report-uri /csp-report;
\`\`\`

Enforcement cutover: remove \`-Report-Only\` after 7 days of zero unexplained violations.

## TLS + DNS

- Cloudflare SSL mode → **Full (strict)**. Currently on "Full"; \`strict\` rejects origin certs that don't chain to a trusted CA. (Already do; only the mode setting is wrong.)
- Min TLS version → **1.2**. TLS 1.3 preferred; disabling 1.0/1.1 cleans up auditor checkbox #4.
- HSTS header with \`max-age=63072000; includeSubDomains; preload\`. Submit to the preload list after 30 days of stable HSTS.
- CAA DNS records — restrict who can issue certs for \`opchain.dev\` to Let's Encrypt + Cloudflare only.

## WAF + rate-limit

- Cloudflare WAF: enable the **Managed Rulesets** (default is "basic" only). Turn on the Cloudflare Managed Ruleset + OWASP Core Rule Set.
- Rate-limit rule on \`/api/*\` — 60 req/min/IP for anon; 600 req/min/IP for authenticated (cookie-scoped). Above that → Challenge page, not block (avoids false positives on corporate NAT).
- Bot Fight Mode → **on** for \`/signup\`, \`/login\`, \`/api/auth/*\`.

## Error handling

- Strip stack traces from production responses. Log them server-side only.
- \`next.config.js\` \`productionBrowserSourceMaps: false\` (already set) — but confirm they're not leaking through other routes.
- Custom 500 page that returns a correlation id; the id maps to the full trace in the log aggregator.

## Cookie hardening

- \`SameSite=Strict\` on the session cookie (was \`Lax\`).
- \`__Host-\` prefix on the session cookie (already \`Secure\` + \`HttpOnly\`).
- Session rotation on privilege change (already done).

## Admin audit log

New table: \`admin_audit_log\`. Every admin action writes one row: actor, target, action, timestamp, ip, user-agent, success/failure. Retained 7 years (SOC2 CC7.2 retention).

## Cloudflare settings summary

| Setting | Current | Target |
|---------|---------|--------|
| SSL Mode | Full | Full (strict) |
| Min TLS | 1.0 | 1.2 |
| HSTS | off | max-age=63072000; preload |
| WAF ruleset | basic | CF Managed + OWASP Core |
| Rate-limit /api/* | off | 60/min anon · 600/min auth |
| Bot Fight Mode | off | on (auth paths) |
| Security Level | medium | high |

Checkpoint: \`.checkpoints/security-auditor.checkpoint.json\` (Phase 3).`,
    },
    {
      id: "remediation-backlog",
      label: "Remediation backlog (prioritised)",
      kind: "backlog.md",
      body:
`# Remediation Backlog — SOC2 Prep

**Produced by** security-auditor after chaining through code-auditor.
**Prioritisation:** SOC2 blocker > CC6 finding > defence-in-depth > hygiene.

## SOC2 blockers (must fix before auditor arrives)

### B-1 — Supabase: switch to per-tenant JWT for RLS

- **Finding:** service-role key used for tenant-scoped queries; RLS is a suggestion, not a control.
- **Fix:** generate a short-lived JWT per-request with the tenant id as a claim; swap \`createClient\` to use \`getSupabase(userJwt)\` in every API route.
- **Scope:** 23 API routes + \`lib/supabase/server.ts\`.
- **Verification:** code-auditor confirmed 23 call-sites; added a lint rule (\`no-service-role-in-request\`) that fails CI on regression.
- **Est:** 1–2 days.

### B-2 — Content-Security-Policy (report-only first, then enforce)

- **Finding:** no CSP; any XSS has full page reign.
- **Fix:** add CSP via \`middleware.ts\`, nonce-per-request, start in \`Content-Security-Policy-Report-Only\` mode. Collect reports at \`/csp-report\` for 7 days.
- **Scope:** \`middleware.ts\`, \`app/csp-report/route.ts\`, \`app/layout.tsx\` (nonce plumbing).
- **Verification:** security-auditor will re-scan after enforcement day.
- **Est:** 1 day.

### B-3 — Strip stack traces from production 500s

- **Finding:** error pages render stack traces containing source paths. Disclosure.
- **Fix:** \`global-error.tsx\` renders a clean page with a correlation id; only the server log has the trace.
- **Scope:** one file.
- **Verification:** 4 routes tested in staging — clean pages everywhere.
- **Est:** 2 hours.

## CC6 findings (should fix before audit)

### C-1 — Cloudflare WAF: enable managed rulesets + rate-limit /api/*

- **Fix:** enable CF Managed Ruleset + OWASP Core Rule Set; add rate-limit (60 anon, 600 auth) on \`/api/*\`.
- **Scope:** Cloudflare dashboard, no code.
- **Est:** 30 minutes.

### C-2 — SSL mode → Full (strict); Min TLS → 1.2; HSTS on

- **Scope:** Cloudflare dashboard.
- **Est:** 15 minutes (no app code change; origin already presents a valid cert).

### C-3 — Admin audit log

- **Fix:** new \`admin_audit_log\` table + wrapper \`logAdminAction()\` at every admin route entry point. 7-year retention policy.
- **Scope:** one migration, one wrapper function, 6 admin routes.
- **Est:** 1 day.

## Defence-in-depth

### D-1 — SameSite=Strict on session cookie + \`__Host-\` prefix

- **Est:** 1 hour; regression-test login flows (OAuth redirect interactions can trip on \`Strict\`).

### D-2 — Stripe webhook IP allow-list

- **Fix:** in addition to HMAC, verify \`X-Forwarded-For\` against Stripe's published CIDR block.
- **Est:** 2 hours.

### D-3 — CAA DNS records

- **Est:** 10 minutes.

## Hygiene

### H-1 — Documented threat model on file

- **Fix:** commit this document to \`docs/security/threat-model.md\`. Review quarterly.
- **Est:** 10 minutes (the doc already exists; just commit it).

## Sprint proposal

\`\`\`
Sprint A (this week)       B-1, B-2 (report-only), B-3, C-1, C-2
Sprint B (next week)       B-2 (enforce), C-3, D-1, D-2, D-3
Hygiene (ongoing)          H-1, re-scan after enforcement, audit re-run monthly
\`\`\`

Both sprints pass through app-architect's normal build → code-auditor → security-auditor → deploy-ops chain. No one-off patches direct to prod.

Checkpoint: \`.checkpoints/security-auditor.checkpoint.json\`.`,
    },
  ],
  skills: ["security-auditor", "code-auditor", "deploy-ops"],
  runtime: "≈ 11 exchanges",
  steps: [
    { type: "beat", label: "01 · Threat model", caption: "security-auditor runs STRIDE + OWASP", skills: ["security-auditor"] },

    {
      type: "exchange", role: "user",
      content:
`First SOC2 audit in six weeks. We're a Next.js SaaS on Cloudflare + Supabase, 80 paying customers. I read the OWASP Top 10 once. Nobody here is a security specialist.

What's going to fail when the auditor looks?`
    },
    {
      type: "exchange", role: "claude", skill: "security-auditor",
      content:
`Invoking **security-auditor** in \`/secaudit\` mode. Four-stage sweep:

1. **Threat model** — STRIDE per trust boundary, OWASP mapping.
2. **Attack-surface map** — every externally-reachable endpoint + what it trusts.
3. **Hardening pass** — CSP, TLS, DNS, WAF, rate-limiting, error handling.
4. **Remediation backlog** — ranked by SOC2 impact × exploitability.

Note: I operate **above** code-auditor — I'm asking "what's the threat model?" and "is the infra hardened?", not "does this function have a bug?". I'll chain to code-auditor once I have findings that need a code-level sweep underneath.

Give me: repo root, \`wrangler.toml\` / \`next.config.js\` / \`middleware.ts\`, your Supabase project settings (service-role vs. anon usage), and one example API route that reads tenant-scoped data. Starting the threat model in parallel.`
    },
    {
      type: "exchange", role: "user",
      content:
`Repo is clean Next 15 + middleware.ts. Supabase: we pretty much always use the service-role key server-side "because RLS is a pain". One example route is /api/tasks — reads \`tasks\` where \`team_id = session.teamId\`.

middleware.ts just handles auth redirects right now. No CSP set anywhere. Cloudflare is on default settings.`
    },
    {
      type: "exchange", role: "claude", skill: "security-auditor",
      content:
`That phrase — "we always use the service-role key because RLS is a pain" — is the audit killer. If the service role is used for tenant-scoped queries, **RLS is effectively disabled for those queries**; the \`where team_id = session.teamId\` is a bug-class away from cross-tenant data disclosure.

Running STRIDE per boundary. Top findings:

1. **CRITICAL — Tampering.** Supabase service-role key used for tenant-scoped queries. Fix: swap to per-tenant JWT with \`team_id\` claim, let RLS enforce.
2. **HIGH — Info disclosure.** No CSP. Any XSS gets full page reign.
3. **HIGH — DoS.** Cloudflare on default ruleset; \`/api/*\` has no rate-limit.
4. **HIGH — Info disclosure.** Production 500s render stack traces with source paths.
5. **MEDIUM — Spoofing.** Session cookie is \`SameSite=Lax\` — CSRF on state-changing GET.
6. **MEDIUM — Elevation of privilege.** Admin role checked at route level, not row level.
7. **MEDIUM — Repudiation.** No audit log for admin actions.
8. **LOW — Tampering.** Stripe webhook verifies HMAC but not IP origin (defence-in-depth gap).

OWASP map: A01 (Broken Access Control) FAIL, A05 (Security Misconfiguration) FAIL, A04 / A09 PARTIAL. The rest PASS.

Findings 1 + 2 are **hard SOC2 blockers** — the auditor will flag them in ten minutes. I'm chaining to **code-auditor** now to confirm Finding #1's exploit path — is the RLS bypass actually triggered from any route, not just theoretically?

Writing \`.checkpoints/security-auditor.checkpoint.json\`.`,
      artifacts: ["threat-model"],
    },

    { type: "beat", label: "02 · Code-level chain", caption: "code-auditor sweeps underneath", skills: ["code-auditor"] },

    {
      type: "exchange", role: "claude", skill: "code-auditor",
      content:
`Invoked by security-auditor for the code-level sweep underneath Finding #1. Running \`/audit security\` with a narrow scope: every call-site of the Supabase client.

\`\`\`
 files scanned       147 (TS/TSX)
 supabase imports    23 distinct call-sites
 service-role uses   23 / 23  ← all of them
 anon / user-jwt uses 0 / 23
 rls-aware           0 / 23
\`\`\`

Every single tenant-scoped query runs with the service role. The \`where team_id = session.teamId\` filter is the only defence against cross-tenant reads. A missing \`where\` clause, a wrong column reference, or an injection that slips past Zod validation would leak across tenants.

**Lint rule added** to \`.eslintrc.json\`:
\`\`\`
"no-service-role-in-request": "error"
\`\`\`
CI will fail on any new service-role use from a request handler. The 23 existing call-sites are grandfathered via \`// eslint-disable-next-line\` comments with \`TODO(security-auditor): B-1\` — so they remain visible until remediation lands.

Chaining back to security-auditor to fold this into the remediation backlog.`
    },

    { type: "beat", label: "03 · Hardening plan", caption: "security-auditor writes the infra playbook", skills: ["security-auditor"] },

    {
      type: "exchange", role: "claude", skill: "security-auditor",
      content:
`Phase 3 — **Hardening pass.** Infra-level fixes that don't require code changes (or require minimal ones).

**Content-Security-Policy.** Ship a strict CSP with per-request nonce, in \`Report-Only\` mode for 7 days before enforcing. Catches false positives before they break customer flows.

**TLS.**
- Cloudflare SSL → Full (**strict**) — currently "Full", which accepts self-signed origin.
- Min TLS version → 1.2 (was 1.0).
- HSTS \`max-age=63072000; includeSubDomains; preload\`.
- CAA DNS records restricting cert issuance to Let's Encrypt + Cloudflare.

**WAF + rate-limit.**
- Enable CF Managed Ruleset + OWASP Core Rule Set (currently "basic").
- Rate-limit \`/api/*\`: 60 req/min/IP anon, 600 req/min/IP auth. Response is **Challenge page**, not block — avoids false positives on corporate NAT.
- Bot Fight Mode on \`/signup\`, \`/login\`, \`/api/auth/*\`.

**Error handling.** \`global-error.tsx\` renders a correlation id; the full trace only lives in the log aggregator.

**Cookie hardening.** \`SameSite=Strict\` + \`__Host-\` prefix on the session cookie.

**Admin audit log.** New \`admin_audit_log\` table, 7-year retention (SOC2 CC7.2).

Writing the hardening plan.`,
      artifacts: ["hardening-plan"],
    },

    { type: "beat", label: "04 · Remediation backlog + deploy gate", caption: "security-auditor hands off to the build pipeline", skills: ["security-auditor", "deploy-ops"] },

    {
      type: "exchange", role: "user",
      content: "OK. How do I know the next deploy actually cleared all this?"
    },
    {
      type: "exchange", role: "claude", skill: "security-auditor",
      content:
`I update the **deploy-ops** gate to require a passing security-auditor check before any prod deploy. From now on, \`/deploy prod\` runs:

1. \`code-auditor /audit pre-deploy\` — code-level findings.
2. \`security-auditor /sec verify\` — re-scans the top-8 STRIDE findings; any still RED blocks the deploy.
3. \`deploy-ops\` gate proceeds only when both pass.

Remediation backlog is ranked for a two-sprint burn:

**Sprint A (this week):** B-1 (RLS fix), B-2 (CSP report-only), B-3 (stack-trace strip), C-1 (WAF), C-2 (TLS / HSTS).
**Sprint B (next week):** B-2 enforce, C-3 (admin audit log), D-1 (SameSite=Strict), D-2 (Stripe IP), D-3 (CAA).

Each goes through the normal app-architect build loop — code-auditor + security-auditor + deploy-ops chain on every sprint. No one-off patches.

Re-run \`/secaudit\` after Sprint A; I'll re-score and show you what moved.`,
      artifacts: ["remediation-backlog"],
    },
    {
      type: "exchange", role: "claude", skill: "deploy-ops",
      content:
`Noted. \`deploy-ops\` pre-flight updated:

\`\`\`
 gate checks (prod deploy)
   ✓ code-auditor:      grade ≥ B (required)
   ✓ security-auditor:  no OPEN findings of severity HIGH or CRITICAL
   ✓ tests:             full suite green
   ✓ type-check:        clean
\`\`\`

The current deploy would fail the security gate — B-1 and B-2 are OPEN CRITICAL/HIGH. Next green deploy is after Sprint A.

Checkpoint: \`.checkpoints/deploy-ops.checkpoint.json\`.`
    },
  ],
};
