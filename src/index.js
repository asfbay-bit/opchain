/**
 * opchain-dev — Cloudflare Worker for opchain.dev
 *
 * Routes:
 *   GET  /api/health    → health check
 *   POST /api/feedback  → Linear issue creation
 *   POST /api/try/start → email-gated demo session
 *   POST /api/try/chat  → streaming AI chat
 *   GET  /*             → static assets (public/)
 */

import { handleOpchainTry } from "./opchain-try.js";
import { SKILL_NAMES } from "./generated/skill-prompts.js";
import { FeedbackSchema, parseBody } from "./lib/schemas.js";
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
  const skillName = skill ? SKILL_NAMES[skill] || skill : null;

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

    if (url.pathname.startsWith("/api/try") && request.method === "POST") {
      const tryUrl = new URL(url);
      tryUrl.pathname = url.pathname.replace("/api/try", "/api/opchain/try");
      return handleOpchainTry(request, tryUrl, env, ctx);
    }

    // Sprint 6 — legacy `.html` paths (live until today) now 301 to clean URLs.
    // `/index.html` → `/`; `/foo.html` → `/foo`. We build the Response by hand
    // (rather than `Response.redirect`) so the outer baseline-header stamp
    // can mutate the Headers.
    if (request.method === "GET" && url.pathname.endsWith(".html")) {
      const clean = url.pathname === "/index.html" ? "/" : url.pathname.replace(/\.html$/, "");
      const location = new URL(clean + url.search, url.origin).toString();
      return new Response(null, { status: 301, headers: { Location: location } });
    }

    if (url.pathname === "/") {
      const indexReq = new Request(new URL("/index.html", url.origin), request);
      const res = await fetchAsset(env, indexReq, url.origin);
      return applySecurityHeaders(res);
    }

    if (url.pathname.endsWith(".zip")) {
      const res = await fetchAsset(env, request, url.origin);
      const dlRes = new Response(res.body, res);
      dlRes.headers.set("Content-Disposition", 'attachment; filename="opchain-skills.zip"');
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
