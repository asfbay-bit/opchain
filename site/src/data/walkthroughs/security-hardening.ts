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

**Produced by** security-auditor Phase 1 (Threat Model) · **Method:** STRIDE per trust boundary · **Compliance lens:** SOC2 Type I + OWASP Top 10 (2021) · **Run-time:** 22 minutes

## 1. Scope + assumptions

- **In scope:** the live SaaS, end-to-end. Browser → Cloudflare → Vercel-hosted Next.js → Supabase Postgres → Stripe webhooks.
- **Out of scope:** the marketing site (separate worker, no auth, no PII).
- **Threat-actor profiles considered:** anonymous internet attacker · disgruntled customer with valid creds · curious employee with no admin role · partner integration via API (Stripe).
- **Not considered:** nation-state APT, social engineering of the founder, physical access to laptops.

## 2. System boundaries

\`\`\`
[browser] ──https──► [cloudflare edge] ──https──► [vercel / next.js] ──tls──► [supabase]
                           │                              │                          │
                           │                              │                          └─ RLS, per-row policies
                           │                              ├─ session cookie auth
                           │                              ├─ middleware: rate-limit, headers
                           │                              └──► [stripe] ──https──► [back-channel webhooks]
                           ├─ WAF managed rules
                           ├─ Bot Fight Mode
                           └─ rate-limit / IP allow-list
\`\`\`

Three trust boundaries:

1. **Internet → Edge** (Cloudflare). WAF, bot protection, rate-limit live here.
2. **Edge → App** (Vercel). TLS terminated again; request identity is the user session cookie.
3. **App → Data** (Supabase). Postgres RLS and per-row policies are the last line.

## 3. Data classification

| Class | Examples | Storage | Retention |
|---|---|---|---|
| Highly sensitive | password hashes, session tokens, Stripe customer ids | Postgres + Stripe | session: 30d idle; pwd: never deleted |
| PII | email, display name, team membership | Postgres | retained while account active; 30d soft-delete |
| Operational | logs, metrics, traces | CF + Vercel | 14d |
| Public | marketing copy | static assets | indefinite |

## 4. STRIDE findings (ranked by exploitability × impact)

### 4.1 Per trust boundary

#### Boundary 1 — Internet → Edge (Cloudflare)

| # | STRIDE | Finding | Sev |
|---|---|---|---|
| 3 | DoS | CF WAF on default rules; \`/api/*\` has no rate-limit; no Challenge page on suspicious traffic. | HIGH |

#### Boundary 2 — Edge → App (Vercel)

| # | STRIDE | Finding | Sev |
|---|---|---|---|
| 2 | Info disclosure | No \`Content-Security-Policy\` header; any script injection has full reign over the page. | HIGH |
| 4 | Info disclosure | Error responses include stack traces in production (500s reveal source paths). | HIGH |
| 5 | Spoofing | Session cookie is \`HttpOnly\` but not \`SameSite=Strict\` — CSRF on any state-changing GET. | MEDIUM |

#### Boundary 3 — App → Data (Supabase)

| # | STRIDE | Finding | Sev |
|---|---|---|---|
| 1 | Tampering | Service-role key used for tenant-isolated queries instead of per-tenant JWT; RLS is effectively bypassed. | CRITICAL |
| 6 | Elevation of privilege | Admin role is checked at the route level, not at the data level. RLS does not enforce it. | MEDIUM |

#### Boundary 3' — App ↔ Stripe (back-channel)

| # | STRIDE | Finding | Sev |
|---|---|---|---|
| 8 | Tampering | Webhook endpoint verifies signature ✓, but not IP origin; relies solely on HMAC. | LOW (defence-in-depth gap) |

#### Cross-boundary (audit + repudiation)

| # | STRIDE | Finding | Sev |
|---|---|---|---|
| 7 | Repudiation | No audit log for admin actions (user impersonation, plan change, team transfer). | MEDIUM |

### 4.2 Findings sorted by exploitability × impact

| # | Component | Sev | Exploitability | Impact | Risk |
|---|---|---|---|---|---|
| 1 | App → Supabase | CRITICAL | HIGH (service-role key used in every API route) | HIGH (cross-tenant leak) | 9.5 |
| 2 | Edge → App | HIGH | MED (XSS still requires injection foothold) | HIGH (full page exfil) | 7.5 |
| 3 | Internet → Edge | HIGH | HIGH (default WAF + no rate-limit) | MED (downtime, not breach) | 7.0 |
| 4 | App | HIGH | MED (one trigger of a 500 anywhere) | MED (path disclosure) | 6.0 |
| 5 | App | MED | MED (CSRF requires same-tab attack vector) | MED (state-change action) | 5.0 |
| 6 | App | MED | LOW (requires existing user session + privilege confusion) | HIGH (privilege escalation) | 5.0 |
| 7 | App | MED | N/A (audit gap, not exploit) | MED (compliance + forensics) | 4.5 |
| 8 | App ↔ Stripe | LOW | LOW (HMAC strong) | LOW (defence-in-depth only) | 2.0 |

## 5. OWASP Top 10 (2021) compliance map

| # | Category | Status | Notes |
|---|---|---|---|
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

## 6. SOC2 Trust Services Criteria mapping

| TSC | Status | Findings |
|---|---|---|
| CC1 (Control environment) | PASS | Org chart documented; founder owns security responsibility. |
| CC2 (Communication & info) | PASS | Privacy policy on file; user-facing. |
| CC3 (Risk assessment) | **PARTIAL** | This document fills the gap going forward. |
| CC4 (Monitoring) | **PARTIAL** | Finding #7 — admin action audit log missing. |
| CC5 (Control activities) | **FAIL** | Finding #1 — RLS not enforced. |
| CC6 (Logical & physical access) | **FAIL** | Findings #2, #3, #4. |
| CC7 (System operations) | PASS | Deploy + rollback runbook on file. |
| CC8 (Change management) | PASS | PR + audit gate on every change. |
| CC9 (Risk mitigation) | **PARTIAL** | Backlog established (separate artifact). |

## 7. Recommendation

Findings #1 and #2 are the hard blockers for SOC2 — an auditor will flag them inside 10 minutes. Findings #3, #4 are SOC2 Common Criteria CC6.1 (logical access) concerns. The rest are SOC2-adjacent but acceptable for Type I if on a roadmap.

Chaining to **code-auditor** for a code-level sweep underneath this posture review — we want to know if the RLS bypass (Finding #1) is actually triggered from any route, not just theoretically possible.

## 8. Out of scope (deliberately)

- **Code-level vulnerability scan.** That's code-auditor's job; chained underneath.
- **Penetration test.** Recommend after remediation lands; out of scope for this pre-audit pass.
- **Third-party vendor risk review.** Recommended but separate engagement; not blocking SOC2 Type I.
- **Disaster recovery / business continuity.** Already documented in deploy-ops runbook.

Checkpoint: \`.checkpoints/security-auditor.checkpoint.json\`.`,
    },
    {
      id: "hardening-plan",
      label: "Infrastructure hardening plan",
      kind: "hardening.md",
      body:
`# Infrastructure Hardening Plan

**Produced by** security-auditor Phase 3 (Hardening) · **Targets:** edge, DNS, TLS, CSP, WAF, error handling, cookies, audit log · **Implementation effort:** ~2 days total · **No application code change** for half of the items.

## 1. Content-Security-Policy

Ship a strict CSP with a per-request nonce, in **report-only mode for 7 days** before enforcing. This catches false positives before they break customer flows.

### 1.1 The header (report-only first)

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

### 1.2 Implementation

- \`middleware.ts\` generates a per-request \`nonce\` (16 random bytes, base64).
- Header set on every response.
- \`app/layout.tsx\` reads the nonce and applies it to every \`<script>\` tag (Next 15 supports nonce inheritance for Server Components).
- \`POST /csp-report\` handler ingests violations, logs to Sentry, never throws.

### 1.3 Enforcement cutover

After 7 days with zero unexplained violation reports:

1. Change header name to \`Content-Security-Policy\` (drop \`-Report-Only\`).
2. Keep \`report-uri\` for ongoing visibility.
3. Re-run the \`/secaudit\` pass; expect Finding #2 to flip to GREEN.

### 1.4 Known false-positive surfaces (to whitelist or fix)

- Stripe Checkout iframes — already in \`frame-src\`.
- Supabase realtime websocket — already in \`connect-src\`.
- Inline styles in the legacy \`/dashboard/legacy\` route — fix during the dashboard refactor; meanwhile use the nonce.

## 2. TLS + DNS

| Setting | Current | Target | Action |
|---|---|---|---|
| Cloudflare SSL mode | Full | **Full (strict)** | Toggle in dashboard. \`strict\` rejects origin certs that don't chain to a trusted CA — we already chain to LE. |
| Min TLS version | 1.0 | **1.2** | Toggle in dashboard. TLS 1.3 preferred; disabling 1.0/1.1 cleans auditor checkbox #4. |
| HSTS | off | \`max-age=63072000; includeSubDomains; preload\` | Set via Cloudflare > SSL/TLS > Edge Certificates > HSTS. Submit to preload list after 30d of stable HSTS. |
| CAA DNS | absent | Let's Encrypt + Cloudflare only | Add via DNS dashboard. Prevents rogue cert issuance. |
| Always Use HTTPS | on | on | (already correct) |

### 2.1 HSTS preload submission

After 30 days with HSTS active and no rollback:

1. Visit \`hstspreload.org\`.
2. Submit \`headsdown.app\`.
3. Wait ~6-8 weeks for browser inclusion.
4. Note: HSTS preload is **near-permanent** — removing the domain takes months. Be confident before submitting.

## 3. WAF + rate-limit

### 3.1 WAF rulesets to enable

- **Cloudflare Managed Ruleset** — bundled OWASP-aligned rules; on by default in higher tiers, off here.
- **OWASP Core Rule Set** — independent OWASP CRS; pair with Cloudflare's for defence in depth.
- Both run in **Block** mode for high-confidence rules; **Challenge** for medium-confidence (avoids false positives on corporate NAT).

### 3.2 Rate-limit rules

| Rule | Rate | Action |
|---|---|---|
| \`/api/*\` (anon) | 60/min/IP | Challenge |
| \`/api/*\` (authenticated) | 600/min/IP | Challenge |
| \`/api/auth/*\` | 5/min/IP | Block + 1h cooldown |
| \`/api/billing/checkout\` | 5/min/user | 429 |
| \`/csp-report\` | 50/min/IP | Drop silently |

### 3.3 Bot Fight Mode

Enable for: \`/signup\`, \`/login\`, \`/api/auth/*\`. These are the credential-stuffing surfaces.

## 4. Error handling

- Strip stack traces from production responses. Log them server-side only.
- \`next.config.js\`: \`productionBrowserSourceMaps: false\` (already set) — but confirm they're not leaking through other routes.
- Custom \`global-error.tsx\` renders a clean correlation id; the id maps to the full trace in the log aggregator.

### 4.1 Implementation sketch

\`\`\`tsx
// app/global-error.tsx
"use client";
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html>
      <body>
        <h1>Something went wrong</h1>
        <p>Reference: <code>{error.digest ?? "unknown"}</code></p>
        <p>Please try again. If the problem persists, contact support with the reference above.</p>
      </body>
    </html>
  );
}
\`\`\`

The \`error.digest\` is Next 15's stable correlation id; backend logs are searchable by this id.

## 5. Cookie hardening

| Cookie | Setting | Current | Target |
|---|---|---|---|
| Session | \`SameSite\` | \`Lax\` | **\`Strict\`** |
| Session | name | \`session\` | \`__Host-session\` (\`__Host-\` prefix forces \`Secure\` + path=/ + no Domain attr) |
| Session | \`Secure\` | yes | yes |
| Session | \`HttpOnly\` | yes | yes |
| Session | rotation on privilege change | yes | yes |
| CSRF (legacy) | — | absent | not needed (covered by SameSite=Strict + Origin check) |

### 5.1 SameSite=Strict caveat

OAuth redirect interactions can trip on \`Strict\` (the redirect from the OAuth provider arrives without a referrer that matches). Mitigation: special-case the OAuth callback path with a one-shot \`SameSite=Lax\` cookie that promotes to \`Strict\` after the first authenticated request.

## 6. Admin audit log

New table: \`admin_audit_log\`. Every admin action writes one row.

\`\`\`prisma
model AdminAuditLog {
  id          String   @id @default(cuid())
  actorId     String   // user performing the action
  targetType  String   // "User", "Team", "Subscription", etc.
  targetId    String
  action      String   // "impersonate", "plan_change", "team_transfer", etc.
  before      Json?    // state before (snapshot)
  after       Json?    // state after (snapshot)
  ipAddress   String
  userAgent   String
  success     Boolean
  reason      String?  // free-text rationale
  createdAt   DateTime @default(now())

  @@index([actorId, createdAt])
  @@index([targetType, targetId, createdAt])
}
\`\`\`

Retained 7 years (SOC2 CC7.2 retention).

### 6.1 Wrapping admin routes

\`\`\`ts
// lib/admin/audit.ts
export async function logAdminAction(opts: {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  reason?: string;
}) {
  await db.adminAuditLog.create({ data: { ...opts } });
}
\`\`\`

Every admin route entry-point calls \`logAdminAction\` after the action settles (success or failure).

## 7. Cloudflare settings summary

| Setting | Current | Target |
|---|---|---|
| SSL Mode | Full | Full (strict) |
| Min TLS | 1.0 | 1.2 |
| HSTS | off | max-age=63072000; preload |
| WAF ruleset | basic | CF Managed + OWASP Core |
| Rate-limit /api/* | off | 60/min anon · 600/min auth |
| Bot Fight Mode | off | on (auth paths) |
| Security Level | medium | high |
| Always Use HTTPS | on | on (no change) |
| Email Obfuscation | off | on |
| Hotlink Protection | off | on |

## 8. Hardening checklist (for the engineer doing the work)

- [ ] Add CSP middleware + nonce plumbing (1 day).
- [ ] Set \`/csp-report\` route + Sentry forwarding (30 min).
- [ ] Toggle CF SSL Mode → strict (5 min).
- [ ] Toggle CF Min TLS → 1.2 (5 min).
- [ ] Set HSTS via CF dashboard (10 min).
- [ ] Add CAA DNS records (10 min).
- [ ] Enable WAF managed rulesets (15 min).
- [ ] Configure rate-limit rules in CF dashboard (30 min).
- [ ] Enable Bot Fight Mode on auth paths (5 min).
- [ ] Replace \`global-error.tsx\` (30 min).
- [ ] Bump session cookie to \`SameSite=Strict\` + \`__Host-\` (1 h, includes regression test on OAuth redirect).
- [ ] Add \`admin_audit_log\` migration + wrapper + 6 admin route call-sites (1 day).

Total: **~2 days of focused work**, half of which is dashboard toggles.

Checkpoint: \`.checkpoints/security-auditor.checkpoint.json\` (Phase 3).`,
    },
    {
      id: "remediation-backlog",
      label: "Remediation backlog (prioritised)",
      kind: "backlog.md",
      body:
`# Remediation Backlog — SOC2 Prep

**Produced by** security-auditor after chaining through code-auditor · **Prioritisation:** SOC2 blocker > CC6 finding > defence-in-depth > hygiene · **Audit window** ~6 weeks · **Total est. effort** ~12 engineering days

## 1. Severity mapping

| Tier | Definition | SLA |
|---|---|---|
| **B (blocker)** | Hard SOC2 fail; auditor will flag in < 10 min | This sprint (Sprint A) |
| **C (CC6)** | Common-Criteria finding; auditor will flag on first review | This + next sprint |
| **D (defence-in-depth)** | Not a SOC2 fail; nice to have | Next sprint or backlog |
| **H (hygiene)** | Not exploitable; documentation/process | Ongoing |

## 2. SOC2 blockers (must fix before auditor arrives)

### B-1 — Supabase: switch to per-tenant JWT for RLS

- **Finding:** service-role key used for tenant-scoped queries; RLS is a suggestion, not a control.
- **Why critical:** a single \`where team_id=session.teamId\` typo would leak across tenants.
- **Fix:**
  1. Generate a short-lived JWT per-request with \`tenant_id\` as a claim.
  2. Swap \`createClient\` to use \`getSupabase(userJwt)\` in every API route.
  3. Enable RLS on every tenant-scoped table; write policies that filter on the JWT claim.
- **Scope:** 23 API routes + \`lib/supabase/server.ts\` + 14 RLS policies.
- **Verification:** code-auditor confirmed 23 call-sites; added a lint rule (\`no-service-role-in-request\`) that fails CI on regression.
- **Est:** 1–2 days.
- **Owner:** founder (handle directly given criticality).
- **Done when:** \`bin/audit/rls-coverage.sh\` reports 100% of tenant tables protected; lint rule green; integration test confirms cross-tenant query is rejected.

### B-2 — Content-Security-Policy (report-only first, then enforce)

- **Finding:** no CSP; any XSS has full page reign.
- **Fix:**
  1. Add CSP via \`middleware.ts\`, nonce-per-request.
  2. Start in \`Content-Security-Policy-Report-Only\` mode.
  3. Collect reports at \`POST /csp-report\` for 7 days.
  4. After 7 days of zero unexplained violations, drop \`-Report-Only\`.
- **Scope:** \`middleware.ts\`, \`app/csp-report/route.ts\`, \`app/layout.tsx\` (nonce plumbing).
- **Verification:** security-auditor re-scan after enforcement day; \`/csp-report\` log shows zero unexplained violations.
- **Est:** 1 day initial + 7-day soak + 1 day enforcement.
- **Done when:** header is \`Content-Security-Policy\` (not \`-Report-Only\`); /secaudit re-scan flips Finding #2 to GREEN.

### B-3 — Strip stack traces from production 500s

- **Finding:** error pages render stack traces containing source paths. Disclosure.
- **Fix:** replace \`global-error.tsx\` with a clean page; only the server log has the trace.
- **Scope:** one file.
- **Verification:** 4 routes tested in staging — clean pages everywhere; \`curl\`-a-500 from production returns no source path.
- **Est:** 2 hours.

## 3. CC6 findings (should fix before audit)

### C-1 — Cloudflare WAF: enable managed rulesets + rate-limit /api/*

- **Fix:**
  - Enable CF Managed Ruleset + OWASP Core Rule Set.
  - Add rate-limit (60 anon, 600 auth) on \`/api/*\`.
  - Bot Fight Mode on \`/signup\`, \`/login\`, \`/api/auth/*\`.
- **Scope:** Cloudflare dashboard, no code.
- **Est:** 30 minutes.

### C-2 — SSL mode → Full (strict); Min TLS → 1.2; HSTS on

- **Fix:**
  - Cloudflare SSL Mode: Full → Full (strict).
  - Min TLS Version: 1.0 → 1.2.
  - HSTS: \`max-age=63072000; includeSubDomains; preload\`.
- **Scope:** Cloudflare dashboard.
- **Est:** 15 minutes (no app code change; origin already presents a valid cert).
- **Note:** HSTS preload submission is a separate decision (see hardening plan).

### C-3 — Admin audit log

- **Fix:** new \`admin_audit_log\` table + \`logAdminAction()\` wrapper at every admin route entry point. 7-year retention policy.
- **Scope:** one migration, one wrapper function, 6 admin routes.
- **Est:** 1 day.

## 4. Defence-in-depth

### D-1 — SameSite=Strict on session cookie + \`__Host-\` prefix

- **Fix:** rename cookie to \`__Host-session\`, set \`SameSite=Strict\`. Special-case OAuth callback path with one-shot \`Lax\` cookie that promotes to \`Strict\`.
- **Est:** 1 hour; regression-test login flows.

### D-2 — Stripe webhook IP allow-list

- **Fix:** in addition to HMAC, verify \`X-Forwarded-For\` against Stripe's published CIDR block.
- **Est:** 2 hours. (Note: already addressed in the Stripe integration audit; this is the same fix from a different lens.)

### D-3 — CAA DNS records

- **Fix:** add CAA records restricting certificate issuance to Let's Encrypt + Cloudflare only.
- **Est:** 10 minutes.

### D-4 — Email obfuscation + hotlink protection

- **Fix:** Cloudflare dashboard toggles. Reduces scraper signal + cross-site image abuse.
- **Est:** 5 minutes.

## 5. Hygiene

### H-1 — Documented threat model on file

- **Fix:** commit the threat-model artifact to \`docs/security/threat-model.md\`. Review quarterly.
- **Est:** 10 minutes (the doc already exists; just commit it).

### H-2 — Subprocessor inventory + DPA on file

- **Fix:** list every subprocessor (Cloudflare, Vercel, Supabase, Stripe, Sentry); confirm DPAs are signed; commit to \`docs/security/subprocessors.md\`.
- **Est:** 30 minutes (most are signed; just consolidate).

### H-3 — Quarterly security review cadence

- **Fix:** add a recurring calendar entry for \`/secaudit\` re-run every 90 days.
- **Est:** 5 minutes.

## 6. Sprint proposal

\`\`\`
Sprint A (this week)       B-1, B-2 (report-only), B-3, C-1, C-2     ~3 days work
Sprint B (next week)       B-2 (enforce), C-3, D-1, D-2, D-3, D-4    ~2 days work
Hygiene (ongoing)          H-1, H-2, H-3 (mostly docs)               ~1 hour
Re-audit                   /secaudit after each sprint               separate cadence
Pen-test                   external; book after Sprint B closes      separate engagement
\`\`\`

Both sprints pass through app-architect's normal build → code-auditor → security-auditor → deploy-ops chain. No one-off patches direct to prod.

## 7. Tracking

Linear project: \`security-soc2-prep\`. Each backlog item maps to a Linear issue with the same id (B-1, B-2, etc.). Closing an issue requires an attached PR + the security-auditor re-scan output as a comment.

## 8. Communication

| Audience | Cadence | What |
|---|---|---|
| Founder | daily during Sprint A/B | Slack DM with what shipped + what's next |
| Investors | end of Sprint A | "We're SOC2-ready" milestone email |
| Customers | only on incident | (no proactive comms during prep) |
| Auditor | week before audit | full scope packet (this doc + attestation) |

## 9. Definition of "audit-ready"

All B-tier and C-tier items closed; D-tier items either closed or with a documented "accepted risk" decision; H-tier items committed to the repo. Pen-test booked. Subprocessor DPAs filed.

Estimated calendar time from this doc to "audit-ready": **~2.5 weeks** of focused work + 7-day CSP soak.

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
