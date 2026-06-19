/**
 * opchain-dev — Cloudflare Worker for opchain.dev
 *
 * Routes:
 *   GET  /api/health           → health check
 *   POST /api/feedback         → Linear issue creation
 *   POST /api/notify           → install/download soft-gate capture (KV-backed)
 *   GET  /*                    → static assets (public/)
 *
 * The `/api/try/*` chat surface and the email-gated session flow were
 * removed in `claude/remove-try-it`. Old links (/tryit) now 301 to /demo.
 * The Resend-powered `/api/email-pipeline` was removed too — Step 5 of
 * /pipeline-builder now offers a client-side Markdown download instead.
 */

import { FeedbackSchema, NotifySchema, parseBody } from "./lib/schemas.js";
import { capture, hashDistinctId } from "./lib/analytics.js";
import { bindLogger, newRequestId, EVENTS } from "./lib/request-id.js";
import { evalFlag, evalFlags } from "./lib/flags/eval.js";
import { ensureOcId } from "./lib/flags/identity.js";
import { FLAG_NAMES, FLAGS, PUBLIC_FLAG_NAMES } from "./lib/flags/registry.js";
import { createMcpServer } from "./lib/mcp/server.js";
import mcpCatalog from "./generated/mcp-catalog.json" with { type: "json" };
import {
  corsHeaders,
  applyBaselineHeaders,
  generateNonce,
  buildCspHtml,
  NONCE_PLACEHOLDER,
} from "./lib/http.js";
import {
  DEFAULT_TEAM_ID,
  DEFAULT_PROJECT_ID,
  LABEL_MAP,
  PRIORITY_MAP,
  SECURITY_PRIORITY,
  LINEAR_MUTATION,
} from "./lib/feedback-config.js";

// Injected at build time by esbuild `define` (see build.mjs).
// eslint-disable-next-line no-undef
const VERSION = typeof __OPCHAIN_VERSION__ !== "undefined" ? __OPCHAIN_VERSION__ : "dev";

async function applySecurityHeaders(response, { env, ctx } = {}) {
  const ct = response.headers.get("Content-Type") || "";
  if (!ct.includes("text/html")) {
    const res = new Response(response.body, response);
    applyBaselineHeaders(res);
    return res;
  }
  const nonce = generateNonce();
  const text = await response.text();
  const swapped = text.split(NONCE_PLACEHOLDER).join(nonce);
  const res = new Response(swapped, response);
  applyBaselineHeaders(res);
  // Strict mode emits enforce; non-strict emits Report-Only so we can tune
  // a new policy in production without breaking the page. The default is
  // strict, so in test paths that don't pass env we keep enforce mode.
  const strict = env
    ? await evalFlag("platform.security.csp-strict", { env, ctx })
    : true;
  const cspHeader = strict ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
  res.headers.set(cspHeader, buildCspHtml(nonce));
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

// ── Roadmap vote handlers ───────────────────────────────────────────────────
// One vote per IP per day per Linear issue. Vote counts are stored in the
// NOTIFY KV namespace under keys:
//   vote-count:<TEAM-NNN>                          → integer
//   vote-lock:<TEAM-NNN>:<YYYY-MM-DD>:<ip-hash>    → "1" (TTL 25h)
// We hash the IP (first 16 hex chars of SHA-256) so the lock keys carry
// no PII at rest. KV is eventually consistent — that's fine for a vote
// counter; the worst case is a few seconds of stale display.
//
// The regex accepts any Linear team prefix (2-8 uppercase letters), not just
// the original `OPCHN-` — the workspace renamed its team to "Aidopsdev"
// (`ADEV-`) at some point and the old hardcoded pattern silently rejected
// every real identifier. The strict character class (uppercase letters +
// digits only) keeps the value safe to interpolate into KV keys.
const VOTE_ID_RE = /^[A-Z]{2,8}-\d{1,6}$/;
const VOTE_BATCH_MAX = 50;
const VOTE_TTL_SECONDS = 25 * 60 * 60; // 25h, so lock spans the next-day boundary

async function ipHashHex(ip) {
  const bytes = new TextEncoder().encode(String(ip || "0.0.0.0"));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

async function handleVotePost(request, env, ctx, origin, requestId, rawId) {
  const log = bindLogger(requestId);
  const id = String(rawId || "").toUpperCase();
  if (!VOTE_ID_RE.test(id)) {
    return new Response(
      JSON.stringify({ error: "Invalid issue id.", code: "invalid_id" }),
      { status: 400, headers: corsHeaders(origin, requestId) },
    );
  }
  if (!env.NOTIFY) {
    log.event(EVENTS.NOTIFY_NO_KV, { source: "vote" });
    return new Response(
      JSON.stringify({ error: "Vote storage unavailable.", code: "kv_not_configured" }),
      { status: 503, headers: corsHeaders(origin, requestId) },
    );
  }
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const today = new Date().toISOString().slice(0, 10);
  const ipHash = await ipHashHex(ip);
  const lockKey = `vote-lock:${id}:${today}:${ipHash}`;
  const countKey = `vote-count:${id}`;

  const [existingLock, currentRaw] = await Promise.all([
    env.NOTIFY.get(lockKey),
    env.NOTIFY.get(countKey),
  ]);
  const current = Math.max(0, parseInt(currentRaw || "0", 10) || 0);

  if (existingLock) {
    return new Response(
      JSON.stringify({ ok: true, count: current, alreadyVoted: true }),
      { status: 200, headers: corsHeaders(origin, requestId) },
    );
  }

  const next = current + 1;
  await Promise.all([
    env.NOTIFY.put(lockKey, "1", { expirationTtl: VOTE_TTL_SECONDS }),
    env.NOTIFY.put(countKey, String(next)),
  ]);
  log.event(EVENTS.FEEDBACK_SUBMITTED, { type: "roadmap-vote", issue: id, count: next });
  return new Response(
    JSON.stringify({ ok: true, count: next, alreadyVoted: false }),
    { status: 200, headers: corsHeaders(origin, requestId) },
  );
}

async function handleVoteGet(request, env, origin, requestId) {
  const url = new URL(request.url);
  if (!env.NOTIFY) {
    return new Response(
      JSON.stringify({ counts: {} }),
      { status: 200, headers: corsHeaders(origin, requestId) },
    );
  }
  const ids = (url.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => VOTE_ID_RE.test(s))
    .slice(0, VOTE_BATCH_MAX);
  const counts = {};
  await Promise.all(
    ids.map(async (id) => {
      const v = await env.NOTIFY.get(`vote-count:${id}`);
      counts[id] = Math.max(0, parseInt(v || "0", 10) || 0);
    }),
  );
  return new Response(
    JSON.stringify({ counts }),
    {
      status: 200,
      headers: {
        ...corsHeaders(origin, requestId),
        "Cache-Control": "no-store",
      },
    },
  );
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
  const {
    type, title, description, priority, skill, email,
    // Security-only fields — only read when type === "security".
    component, reproduction, impact, severity,
    // Roadmap community-submission field. Presence → community mode.
    category,
  } = parsed.data;
  const isSecurity = type === "security";
  const isCommunity = !!category && !isSecurity;

  // Staging (and any env with the api-feedback kill flag on) accepts the
  // submission, logs it, and returns a synthetic 201 without calling
  // Linear. Keeps test entries out of the prod backlog and means
  // staging doesn't need LINEAR_API_KEY at all. See wrangler.jsonc
  // env.staging.
  //
  // The legacy FEEDBACK_DRY_RUN env var is honoured as a back-compat
  // alias so an in-flight rollout doesn't break staging.
  const dryRun = env.FEEDBACK_DRY_RUN === "true"
    || (await evalFlag("site.ops.api-feedback.kill", { env, ctx }));
  if (dryRun) {
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
  // Label resolution. Security disclosures prefer a dedicated label
  // (configurable via env.LINEAR_SECURITY_LABEL_ID); regular feedback
  // uses the static LABEL_MAP entry. Community roadmap submissions
  // additionally get LINEAR_COMMUNITY_LABEL_ID (optional env var) so
  // triagers can see the new ask without flipping it onto the public
  // roadmap. Empty → no label, never blocks.
  let labelIds = LABEL_MAP[type] ? [LABEL_MAP[type]] : [];
  if (isSecurity && env.LINEAR_SECURITY_LABEL_ID) {
    labelIds = [env.LINEAR_SECURITY_LABEL_ID];
  }
  if (isCommunity && env.LINEAR_COMMUNITY_LABEL_ID) {
    labelIds = [...labelIds, env.LINEAR_COMMUNITY_LABEL_ID];
  }
  // Priority resolution. Security disclosures bypass the
  // user-submitted priority and ride the SECURITY_PRIORITY table —
  // reporters shouldn't be able to mark their own bug as "low."
  const linearPriority = isSecurity
    ? (SECURITY_PRIORITY[severity || "medium"])
    : (PRIORITY_MAP[priority] ?? 0);
  // SKILL_NAMES used to map ids → display names from skill-prompts.js;
  // that file went away with the Try-It removal. The raw slug (e.g.
  // `code-auditor`) still carries enough signal to triage feedback in
  // Linear, so we surface the id directly.
  const skillName = skill || null;

  const descParts = [];
  if (isSecurity) {
    // Structured Markdown body for security disclosures — gives the
    // triager a consistent layout regardless of how thorough the
    // reporter was. Missing sections render as "_Not provided._" so
    // gaps are obvious at a glance.
    descParts.push(`## Severity\n\n${severity ? severity.toUpperCase() : "_Not specified — defaulting to medium triage._"}`);
    descParts.push(`## Affected component\n\n${component || "_Not provided._"}`);
    descParts.push(`## Reproduction\n\n${reproduction || "_Not provided._"}`);
    descParts.push(`## Impact\n\n${impact || "_Not provided._"}`);
    if (description) descParts.push(`## Additional notes\n\n${description}`);
  } else if (description) {
    descParts.push(description);
  }
  if (skillName) descParts.push(`**Skill:** ${skillName}`);
  if (isCommunity) descParts.push(`**Category:** ${category}`);
  if (email) descParts.push(`**Contact:** ${email}`);
  descParts.push(`**Request ID:** ${requestId}`);
  descParts.push(
    isSecurity
      ? "_Submitted via opchain.dev /security disclosure form_"
      : isCommunity
      ? "_Submitted via opchain.dev /changelog roadmap form — community-submitted; needs `roadmap-visible` label to appear publicly._"
      : "_Submitted via opchain.dev_",
  );

  const titlePrefix = isSecurity
    ? "[SECURITY]"
    : isCommunity
    ? `[community/${type}]`
    : `[${type}]`;

  const variables = {
    input: {
      teamId, projectId,
      title: `${titlePrefix} ${title}`,
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

// ── Flags API ───────────────────────────────────────────────────────────────
//
// /api/flags/public returns the subset of flags safe to ship to the browser
// (UI / feature / experiment / consent / skill visibility — see
// PUBLIC_FLAG_NAMES). Sets the `oc_id` cookie if missing so the same visitor
// keeps landing in the same percentage-rollout bucket.
//
// Response is cached briefly per-visitor:
//   Cache-Control: private, max-age=30
// — long enough to absorb a burst of fetches on a single page load, short
// enough that flipping a flag in PostHog propagates within ~30s.

async function handlePublicFlags(request, env, ctx, origin, requestId) {
  const { id, setCookie } = ensureOcId(request);
  const flags = await evalFlags(PUBLIC_FLAG_NAMES, { env, ctx, distinctId: id });
  const headers = {
    ...corsHeaders(origin, requestId),
    "Cache-Control": "private, max-age=30",
  };
  if (setCookie) headers["Set-Cookie"] = setCookie;
  return new Response(
    JSON.stringify({ flags }),
    { status: 200, headers },
  );
}

/**
 * Build a server-only summary of flags whose evaluated value differs from
 * the registry default. Used by /api/health when site.ops.api-health.detailed
 * is on. Distinct id is intentionally omitted — this is the env-level
 * picture, not a per-visitor snapshot.
 */
async function flagOverridesSummary(env, ctx) {
  const evaluated = await evalFlags(FLAG_NAMES, { env, ctx });
  const overrides = {};
  for (const name of FLAG_NAMES) {
    const def = FLAGS[name];
    if (evaluated[name] !== def.default) overrides[name] = evaluated[name];
  }
  return { count: Object.keys(overrides).length, overrides };
}

// Skill ids gained an `oc-` prefix (skills/oc-*). Map the old /skills/<id>
// page URLs and /skills/<id>.zip bundle URLs to the prefixed path with a 301
// so inbound + bookmarked links survive the rename.
const RENAMED_SKILL_IDS = new Set([
  "api-dev", "app-architect", "bug-check", "checkpoint-protocol", "code-auditor",
  "dash-forge", "deploy-ops", "git-ops", "integrations-engineer", "migration-ops",
  "monitoring-ops", "orchestrator", "release-ops", "reverse-spec", "scale-ops",
  "security-auditor", "stack-forge", "ux-engineer",
]);

// ── MCP server (POST /mcp) ──────────────────────────────────────────────────
//
// Exposes the opchain skill catalog, intent routing, the shared orchestrator
// protocol, and session checkpoints to Codex and any other MCP client over
// streamable HTTP (JSON-RPC 2.0 on a single POST endpoint). Skill bodies stream
// from the ASSETS binding (public/docs/<id>/SKILL.md, synced by sync-docs.sh);
// checkpoints persist in the NOTIFY KV namespace, scoped per session. The
// transport-agnostic core is src/lib/mcp/server.js (also wrapped over stdio by
// mcp/local-server.mjs). Gated by the site.ops.api-mcp.kill switch in route().

function mcpCheckpointStore(env) {
  if (!env.NOTIFY) return null;
  const key = (skill, session) => `mcp-checkpoint:${session}:${skill}`;
  return {
    async read(skill, session) {
      const raw = await env.NOTIFY.get(key(skill, session));
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    },
    async write(skill, session, data) {
      await env.NOTIFY.put(key(skill, session), JSON.stringify(data));
    },
  };
}

async function handleMcp(request, env, ctx, origin, requestId) {
  const headers = { ...corsHeaders(origin, requestId), "Cache-Control": "no-store" };

  // Streamable HTTP: clients POST JSON-RPC. No standalone GET SSE stream is
  // offered (the server is stateless request/response), so GET → 405.
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Use POST with a JSON-RPC body." } }),
      { status: 405, headers: { ...headers, Allow: "POST, OPTIONS" } },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }),
      { status: 400, headers },
    );
  }

  const reqOrigin = new URL(request.url).origin;
  const server = createMcpServer({
    catalog: mcpCatalog,
    serverVersion: VERSION,
    checkpoints: mcpCheckpointStore(env),
    // The server validates `id` against the catalog before calling this, so the
    // path is always a known skill id — no traversal risk.
    loadBody: async (id) => {
      const res = await env.ASSETS.fetch(new Request(new URL(`/docs/${id}/SKILL.md`, reqOrigin)));
      if (!res.ok) return null;
      const text = await res.text();
      return text && text.trim() ? text : null;
    },
  });

  // Single message or JSON-RPC batch. Notifications (no id) get a 202 with no body.
  if (Array.isArray(body)) {
    if (body.length === 0) {
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } }),
        { status: 400, headers },
      );
    }
    const responses = (await Promise.all(body.map((m) => server.handle(m)))).filter((r) => r !== null);
    if (responses.length === 0) return new Response(null, { status: 202, headers });
    return new Response(JSON.stringify(responses), { status: 200, headers });
  }

  const response = await server.handle(body);
  if (response === null) return new Response(null, { status: 202, headers });
  return new Response(JSON.stringify(response), { status: 200, headers });
}

// ── Main Router ─────────────────────────────────────────────────────────────

async function route(request, env, ctx, url, origin, requestId) {
    if (request.method === "OPTIONS" && (url.pathname.startsWith("/api/") || url.pathname === "/mcp")) {
      return new Response(null, { status: 204, headers: corsHeaders(origin, requestId) });
    }

    // opchain MCP server (Codex + any MCP client). JSON-RPC over a single POST.
    if (url.pathname === "/mcp") {
      if (await evalFlag("site.ops.api-mcp.kill", { env, ctx })) {
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "opchain MCP server is paused." } }),
          { status: 503, headers: corsHeaders(origin, requestId) },
        );
      }
      return handleMcp(request, env, ctx, origin, requestId);
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      const body = { ok: true, service: "opchain-dev", version: VERSION };
      if (await evalFlag("site.ops.api-health.detailed", { env, ctx })) {
        body.flags = await flagOverridesSummary(env, ctx);
      }
      return new Response(
        JSON.stringify(body),
        {
          headers: {
            "Content-Type": "application/json",
            "X-Opchain-Version": VERSION,
            "X-Opchain-Request-Id": requestId,
          },
        },
      );
    }

    if (url.pathname === "/api/flags/public" && request.method === "GET") {
      return handlePublicFlags(request, env, ctx, origin, requestId);
    }

    if (url.pathname === "/api/feedback" && request.method === "POST") {
      return handleFeedback(request, env, ctx, origin, requestId);
    }

    // POST /api/votes/:id — per-IP/day server-side dedup, returns new count.
    // GET  /api/votes?ids=A,B,C — batched count read for the roadmap UI.
    const voteMatch = url.pathname.match(/^\/api\/votes\/([^/]+)$/);
    if (voteMatch && request.method === "POST") {
      if (await evalFlag("site.ops.api-feedback.kill", { env, ctx })) {
        return new Response(
          JSON.stringify({ error: "Voting is paused.", code: "paused" }),
          { status: 503, headers: corsHeaders(origin, requestId) },
        );
      }
      return handleVotePost(request, env, ctx, origin, requestId, voteMatch[1]);
    }
    if (url.pathname === "/api/votes" && request.method === "GET") {
      return handleVoteGet(request, env, origin, requestId);
    }

    if (url.pathname === "/api/notify" && request.method === "POST") {
      // Ops kill switch — when on, return 503 without touching KV. Used to
      // pause lead capture during incidents. Default off, so existing
      // traffic flows untouched.
      if (await evalFlag("site.ops.api-notify.kill", { env, ctx })) {
        return new Response(
          JSON.stringify({ error: "Lead capture is paused.", code: "paused" }),
          { status: 503, headers: corsHeaders(origin, requestId) },
        );
      }
      return handleNotify(request, env, ctx, origin, requestId);
    }

    // /api/email-pipeline (Resend-backed Step 5 email send) and /api/try/*
    // (the email-gated chat) are both gone. Reject with 410 Gone so any
    // cached client gets a clean "the resource is gone" rather than a 404.
    if (
      url.pathname === "/api/email-pipeline" ||
      url.pathname.startsWith("/api/try")
    ) {
      return new Response(
        JSON.stringify({ error: "This endpoint has been removed." }),
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

    // Old (pre-oc-) skill URLs 301 to the prefixed path. Matches both the
    // page (`/skills/<id>` and `/skills/<id>/`) and the per-skill bundle
    // (`/skills/<id>.zip`). Already-prefixed `/skills/oc-*` never matches the
    // id set, so there's no redirect loop.
    if (request.method === "GET") {
      const skillPath = url.pathname.match(/^\/skills\/([a-z0-9][a-z0-9-]*?)(\.zip)?\/?$/);
      if (skillPath && RENAMED_SKILL_IDS.has(skillPath[1])) {
        const dest = `/skills/oc-${skillPath[1]}${skillPath[2] || ""}`;
        return new Response(null, { status: 301, headers: { Location: buildRedirect(dest) } });
      }
    }

    if (url.pathname.endsWith(".zip")) {
      if (!(await evalFlag("site.feature.install-zip-download", { env, ctx }))) {
        return new Response("Not Found", {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
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
      return applySecurityHeaders(dlRes, { env, ctx });
    }

    const res = await fetchAsset(env, request, url.origin);
    return applySecurityHeaders(res, { env, ctx });
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
