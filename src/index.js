/**
 * opchain-dev — Cloudflare Worker for opchain.dev
 *
 * Routes:
 *   GET  /api/health    → health check
 *   POST /api/feedback  → Linear issue creation
 *   POST /api/notify    → install/download soft-gate capture (KV-backed)
 *   GET  /*             → static assets (public/)
 *
 * The `/api/try/*` chat surface and the email-gated session flow were
 * removed in `claude/remove-try-it`. Old links (/tryit) now 301 to /demo.
 */

import { FeedbackSchema, NotifySchema, parseBody } from "./lib/schemas.js";
import { capture, hashDistinctId } from "./lib/analytics.js";
import { bindLogger, newRequestId, EVENTS } from "./lib/request-id.js";

// Injected at build time by esbuild `define` (see build.mjs).
// eslint-disable-next-line no-undef
const VERSION = typeof __OPCHAIN_VERSION__ !== "undefined" ? __OPCHAIN_VERSION__ : "dev";

// ── Linear Feedback Config ──────────────────────────────────────────────────
// Defaults preserved so existing production deploys keep working if the env
// vars aren't set — but env.LINEAR_TEAM_ID / LINEAR_PROJECT_ID override them.
const DEFAULT_TEAM_ID = "7548a4f9-6ed3-42a6-9130-3b2b45db3c5c";
const DEFAULT_PROJECT_ID = "7a8ea196-9a52-4efb-b997-003cb48a3f1a";

export const LABEL_MAP = {
  bug: "68403073-fd71-44aa-95bc-aea91ed7e4de",
  feature: "a9f89cba-878b-4c2e-a9e4-871866a03592",
  improvement: "e9956661-28ed-4ca2-8d54-8e5457bbb773",
  general: "ec0403ab-31b9-4aa6-a097-e54e4bbff69c",
};

export const PRIORITY_MAP = { 0: 0, 1: 4, 2: 3, 3: 2, 4: 1 };

const ALLOWED_ORIGINS = [
  "https://opchain.dev",
  "https://www.opchain.dev",
  "https://staging.opchain.dev",
  "https://opchain-dev.4fstpkkw72.workers.dev",
  "https://aidops.dev",
  "https://www.aidops.dev",
  "http://localhost:8787",
  "http://localhost:3000",
  "http://localhost:4321",
];

const LINEAR_MUTATION = `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { id identifier url }
  }
}`;

// ── Helpers ─────────────────────────────────────────────────────────────────

export function corsHeaders(origin, requestId) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Opchain-Request-Id",
    "Access-Control-Expose-Headers": "X-Opchain-Request-Id, X-Opchain-Version",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  if (requestId) headers["X-Opchain-Request-Id"] = requestId;
  return headers;
}

// Baseline headers — safe for every response (HTML, JSON, binary).
const BASELINE_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()",
};

// Sprint 7c — CSP nonce. The placeholder `__OPCHAIN_NONCE__` is stamped onto
// every <script> tag at build time by scripts/inject-nonce-placeholder.mjs.
// On every HTML response we generate a fresh nonce, substitute the placeholder
// in the body, and emit it in the CSP header. `'strict-dynamic'` lets a
// nonce-blessed script load further scripts; the explicit hosts remain for
// older browsers. `style-src` keeps `'unsafe-inline'` because Tailwind 4
// emits inline `style=` attributes; converting that is backlog item B-08.
export const NONCE_PLACEHOLDER = "__OPCHAIN_NONCE__";

export function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // base64url, no padding — safe inside CSP and HTML attributes.
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function buildCspHtml(nonce) {
  return (
    "default-src 'self'; " +
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://*.i.posthog.com https://static.cloudflareinsights.com; ` +
    "connect-src 'self' https://*.i.posthog.com https://cloudflareinsights.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data:; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );
}

export function applyBaselineHeaders(res) {
  for (const [k, v] of Object.entries(BASELINE_SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

async function applySecurityHeaders(response) {
  const ct = response.headers.get("Content-Type") || "";
  if (!ct.includes("text/html")) {
    const res = new Response(response.body, response);
    applyBaselineHeaders(res);
    return res;
  }
  // HTML path: read the body, swap placeholder for a per-request nonce, then
  // re-emit. Per-page cost is sub-millisecond on Workers; HTML is tiny.
  const nonce = generateNonce();
  const text = await response.text();
  const swapped = text.split(NONCE_PLACEHOLDER).join(nonce);
  const res = new Response(swapped, response);
  applyBaselineHeaders(res);
  res.headers.set("Content-Security-Policy", buildCspHtml(nonce));
  // Content-Length will be wrong if substitution changed length; let the
  // platform recompute by deleting it (Cloudflare adds Transfer-Encoding).
  res.headers.delete("Content-Length");
  return res;
}

async function fetchAsset(env, request, origin) {
  let res = await env.ASSETS.fetch(request);
  if (res.status === 308) {
    const loc = res.headers.get("Location");
    if (loc) {
      const redir = new URL(loc, origin);
      res = await env.ASSETS.fetch(new Request(redir, request));
    }
  }
  return res;
}

// ── Feedback Handler ────────────────────────────────────────────────────────

async function handleFeedback(request, env, ctx, origin, requestId) {
  const log = bindLogger(requestId);
  const parsed = await parseBody(request, FeedbackSchema);
  if (!parsed.ok) {
    return new Response(
      JSON.stringify({ error: parsed.error, code: parsed.code, issues: parsed.issues }),
      { status: 400, headers: corsHeaders(origin, requestId) },
    );
  }
  const { type, title, description, priority, skill, email } = parsed.data;

  // Staging (and any env with FEEDBACK_DRY_RUN="true") accepts the
  // submission, logs it, and returns a synthetic 201 without calling
  // Linear. Keeps test entries out of the prod backlog and means
  // staging doesn't need LINEAR_API_KEY at all. See wrangler.jsonc
  // env.staging.
  if (env.FEEDBACK_DRY_RUN === "true") {
    log.event(EVENTS.FEEDBACK_SUBMITTED, {
      type, priority: PRIORITY_MAP[priority] ?? 0,
      skill: skill || null, issue: "STAGING-DRY-RUN", dry_run: true,
    });
    return new Response(
      JSON.stringify({ ok: true, id: "STAGING-DRY-RUN", url: null, dryRun: true }),
      { status: 201, headers: corsHeaders(origin, requestId) },
    );
  }

  if (!env.LINEAR_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Feedback endpoint not configured", code: "not_configured" }),
      { status: 503, headers: corsHeaders(origin, requestId) },
    );
  }

  const teamId = env.LINEAR_TEAM_ID || DEFAULT_TEAM_ID;
  const projectId = env.LINEAR_PROJECT_ID || DEFAULT_PROJECT_ID;
  const labelIds = LABEL_MAP[type] ? [LABEL_MAP[type]] : [];
  const linearPriority = PRIORITY_MAP[priority] ?? 0;
  // SKILL_NAMES used to map ids → display names from skill-prompts.js;
  // that file went away with the Try-It removal. The raw slug (e.g.
  // `code-auditor`) still carries enough signal to triage feedback in
  // Linear, so we surface the id directly.
  const skillName = skill || null;

  const descParts = [];
  if (description) descParts.push(description);
  if (skillName) descParts.push(`**Skill:** ${skillName}`);
  if (email) descParts.push(`**Contact:** ${email}`);
  descParts.push(`**Request ID:** ${requestId}`);
  descParts.push("_Submitted via opchain.dev_");

  const variables = {
    input: {
      teamId, projectId,
      title: `[${type}] ${title}`,
      description: descParts.join("\n\n"),
      priority: linearPriority,
      labelIds,
    },
  };

  let linearData;
  try {
    const linearRes = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: env.LINEAR_API_KEY,
      },
      body: JSON.stringify({ query: LINEAR_MUTATION, variables }),
    });
    linearData = await linearRes.json();
  } catch (e) {
    log.eventError(EVENTS.UPSTREAM_FAILED, { upstream: "linear", reason: "fetch_error", message: e.message });
    return new Response(
      JSON.stringify({ error: "Could not reach issue tracker.", code: "upstream_unreachable" }),
      { status: 502, headers: corsHeaders(origin, requestId) },
    );
  }

  if (linearData.data?.issueCreate?.success) {
    const issue = linearData.data.issueCreate.issue;
    log.event(EVENTS.FEEDBACK_SUBMITTED, { type, priority: linearPriority, skill: skill || null, issue: issue.identifier });
    if (email) {
      try {
        const distinctId = await hashDistinctId(email);
        ctx?.waitUntil?.(capture(env, {
          distinctId,
          event: "feedback_submitted",
          properties: { type, priority: linearPriority, skill: skill || null, request_id: requestId },
        }));
      } catch (e) {
        log.warn("analytics error:", e.message);
      }
    }
    return new Response(
      JSON.stringify({ ok: true, id: issue.identifier, url: issue.url }),
      { status: 201, headers: corsHeaders(origin, requestId) },
    );
  }

  log.eventError(EVENTS.FEEDBACK_FAILED, { errors: linearData?.errors?.map((e) => e.message) ?? null });
  return new Response(
    JSON.stringify({ error: "Failed to create issue.", code: "upstream_error" }),
    { status: 500, headers: corsHeaders(origin, requestId) },
  );
}

// ── Notify (install/download soft-gate capture) ─────────────────────────────
//
// The user lands at the install page or clicks "download skill" / "download
// bundle". A modal opens asking for email + role + team size + free-text
// "what are you building". Submit (or skip) — submit posts here.
//
// Stored in env.NOTIFY (KV) under `lead:<sha256(email)>`. Hashing the email
// keeps the key opaque if KV is ever exfiltrated *and* gives us idempotent
// upserts (re-submitting the same email overwrites instead of accumulating).
//
// Rate-limited per IP at 3 submissions / 60s. Bots that try to spam are
// silently 429'd; legitimate users will never hit it.
//
// If env.NOTIFY isn't bound (local dev without `wrangler kv:namespace
// create`), the handler accepts the submission and returns 200 — the lead
// is just not persisted. Logs an event so missing-binding misconfigurations
// are visible in Cloudflare's dashboard.

const NOTIFY_RATELIMIT_MAX = 3;
const NOTIFY_RATELIMIT_TTL_S = 60;

async function handleNotify(request, env, ctx, origin, requestId) {
  const log = bindLogger({ requestId, route: "/api/notify" });

  const parsed = await parseBody(request, NotifySchema);
  if (!parsed.ok) {
    return new Response(
      JSON.stringify({ error: parsed.error, code: parsed.code, issues: parsed.issues }),
      { status: 400, headers: corsHeaders(origin, requestId) },
    );
  }
  const { email, role, teamSize, building, source } = parsed.data;

  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";

  // Rate-limit per IP. KV is best-effort — if NOTIFY isn't bound we
  // skip the limit and let the submission through.
  if (env.NOTIFY) {
    const rlKey = `ratelimit:notify:${ip}`;
    const current = Number(await env.NOTIFY.get(rlKey)) || 0;
    if (current >= NOTIFY_RATELIMIT_MAX) {
      log.event(EVENTS.NOTIFY_RATELIMITED, { ip });
      return new Response(
        JSON.stringify({ error: "Too many submissions, slow down.", code: "rate_limited" }),
        { status: 429, headers: corsHeaders(origin, requestId) },
      );
    }
    await env.NOTIFY.put(rlKey, String(current + 1), {
      expirationTtl: NOTIFY_RATELIMIT_TTL_S,
    });
  }

  const emailHash = await sha256Hex(email.toLowerCase());
  const record = {
    email,
    role: role ?? null,
    teamSize: teamSize ?? null,
    building: building ?? null,
    source,
    ip,
    userAgent: request.headers.get("User-Agent") || null,
    submittedAt: new Date().toISOString(),
    requestId,
  };

  if (env.NOTIFY) {
    await env.NOTIFY.put(`lead:${emailHash}`, JSON.stringify(record));
    log.event(EVENTS.NOTIFY_CAPTURED, { source, hasRole: !!role, hasTeamSize: !!teamSize, hasBuilding: !!building });
  } else {
    log.event(EVENTS.NOTIFY_NO_KV, { source });
  }

  // Fire-and-forget PostHog event so funnel-analytics still works even
  // when KV is unbound.
  try {
    const distinctId = await hashDistinctId(email);
    ctx?.waitUntil?.(capture(env, {
      distinctId,
      event: "notify_submitted",
      properties: {
        source,
        role: role ?? null,
        team_size: teamSize ?? null,
        has_building: !!building,
        request_id: requestId,
      },
    }));
  } catch { /* analytics never breaks a submission */ }

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: corsHeaders(origin, requestId) },
  );
}

async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Main Router ─────────────────────────────────────────────────────────────

async function route(request, env, ctx, url, origin, requestId) {
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: corsHeaders(origin, requestId) });
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return new Response(
        JSON.stringify({ ok: true, service: "opchain-dev", version: VERSION }),
        {
          headers: {
            "Content-Type": "application/json",
            "X-Opchain-Version": VERSION,
            "X-Opchain-Request-Id": requestId,
          },
        },
      );
    }

    if (url.pathname === "/api/feedback" && request.method === "POST") {
      return handleFeedback(request, env, ctx, origin, requestId);
    }

    if (url.pathname === "/api/notify" && request.method === "POST") {
      return handleNotify(request, env, ctx, origin, requestId);
    }

    // /api/try/* is gone. Reject with a clean 410 so any cached client
    // gets the right semantic ("the resource is gone") instead of a 404
    // that suggests a typo.
    if (url.pathname.startsWith("/api/try")) {
      return new Response(
        JSON.stringify({ error: "The Try-It chat has been removed." }),
        { status: 410, headers: { "Content-Type": "application/json" } },
      );
    }

    // /tryit + /in-action both 301 to the combined /demo page.
    const demoRedirects = {
      "/in-action": "/demo",
      "/tryit":     "/demo",
    };

    // Builds an absolute redirect target: starts from `target` (which may
    // include a hash), preserves the original request's query string.
    // Example: ("/demo#live", url with ?skill=foo) → "https://.../demo?skill=foo#live"
    const buildRedirect = (target) => {
      const dest = new URL(target, url.origin);
      dest.search = url.search;
      return dest.toString();
    };

    // Sprint 6 — legacy `.html` paths (live until today) now 301 to clean URLs.
    // `/index.html` → `/`; `/foo.html` → `/foo`. If the cleaned path is one
    // of the demo-folded routes, jump straight to the final destination so
    // we don't make users follow a two-hop redirect chain.
    // We build the Response by hand (rather than `Response.redirect`) so the
    // outer baseline-header stamp can mutate the Headers.
    if (request.method === "GET" && url.pathname.endsWith(".html")) {
      const clean = url.pathname === "/index.html" ? "/" : url.pathname.replace(/\.html$/, "");
      const target = demoRedirects[clean] ?? clean;
      return new Response(null, { status: 301, headers: { Location: buildRedirect(target) } });
    }

    if (request.method === "GET") {
      const target = demoRedirects[url.pathname];
      if (target) {
        return new Response(null, { status: 301, headers: { Location: buildRedirect(target) } });
      }
    }

    if (url.pathname.endsWith(".zip")) {
      const res = await fetchAsset(env, request, url.origin);
      const dlRes = new Response(res.body, res);
      // Use the actual filename from the URL so per-skill bundles
      // (`/skills/<id>.zip`) download as `<id>.zip` and the combined
      // bundle still downloads as `opchain-skills.zip`.
      const filename = url.pathname.split("/").pop() || "opchain-skills.zip";
      dlRes.headers.set("Content-Disposition", `attachment; filename="${filename}"`);
      dlRes.headers.set("Cache-Control", "public, max-age=3600");
      if (res.ok) {
        try {
          const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
          const distinctId = await hashDistinctId(`ip:${ip}`);
          ctx?.waitUntil?.(capture(env, {
            distinctId,
            event: "zip_downloaded",
            properties: { path: url.pathname, request_id: requestId },
          }));
        } catch { /* analytics never breaks a download */ }
      }
      return applySecurityHeaders(dlRes);
    }

    const res = await fetchAsset(env, request, url.origin);
    return applySecurityHeaders(res);
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);
    const requestId = request.headers.get("X-Opchain-Request-Id") || newRequestId();
    const res = await route(request, env, ctx, url, origin, requestId);
    // Stamp baseline headers on every response. Idempotent — asset responses
    // already set them inside applySecurityHeaders, re-setting is a no-op.
    // Doing this unconditionally prevents latent bugs where a future handler
    // sets one baseline header and accidentally suppresses the rest.
    applyBaselineHeaders(res);
    return res;
  },
};
