/**
 * opchain Try It — email-gated AI chat demo.
 *
 * POST /api/opchain/try/start  → email → session token
 * POST /api/opchain/try/chat   → streaming chat against a per-skill system prompt
 *
 * Sprint 4:
 *   - Zod validation on every POST body
 *   - typed KV wrappers (src/lib/kv.js) — no direct env.DATA.* in this file
 *   - single retry on Anthropic 5xx with jitter
 *   - ANTHROPIC_MODEL env override (default: claude-haiku-4-5-20251001)
 *   - request-ID on every log line + X-Opchain-Request-Id response header
 *   - PostHog capture events (fire-and-forget via ctx.waitUntil)
 *   - consistent { error, code } error shape
 */

import { SKILL_PROMPTS, VALID_SKILLS } from "./generated/skill-prompts.js";
import { TryStartSchema, TryChatSchema, parseBody } from "./lib/schemas.js";
import {
  readIpWindow, writeIpWindow,
  readEmailUsage, writeEmailUsage,
  writeLeadIfNew,
} from "./lib/kv.js";
import { fetchWithRetry } from "./lib/retry.js";
import { capture, hashDistinctId } from "./lib/analytics.js";
import { bindLogger, newRequestId, EVENTS } from "./lib/request-id.js";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const MAX_EXCHANGES = 5;
const MAX_TOKENS = 2048;
const EMAIL_TTL_SEC = 86400;     // 24h
const IP_WINDOW_SEC = 3600;      // 1h
const IP_MAX_SESSIONS = 20;
const DEFAULT_LEAD_TTL_DAYS = 365;

function leadTtlSec(env) {
  const days = Number(env?.LEAD_TTL_DAYS);
  const d = Number.isFinite(days) && days > 0 ? days : DEFAULT_LEAD_TTL_DAYS;
  return Math.floor(d * 86400);
}

// ── Response helpers ────────────────────────────────────────────────────────

function jsonResponse(body, status, requestId) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Opchain-Request-Id": requestId,
    },
  });
}

function errResponse(error, code, status, requestId, extra = {}) {
  return jsonResponse({ error, code, ...extra }, status, requestId);
}

// ── Session token (HMAC-SHA256) ─────────────────────────────────────────────

/** Create an HMAC-signed session token. Exported for tests. */
export async function createSessionToken(email, secret) {
  const id = crypto.randomUUID();
  const payload = `${id}:${email}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hmac = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${payload}:${hmac}`;
}

/** Verify an HMAC-signed session token. Returns the email or null. */
export async function verifySessionToken(token, secret) {
  if (typeof token !== "string") return null;
  const parts = token.split(":");
  if (parts.length < 3) return null;
  const hmac = parts.pop();
  const payload = parts.join(":");
  const emailStart = payload.indexOf(":");
  if (emailStart < 0) return null;
  const email = payload.slice(emailStart + 1);
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sigBytes = Uint8Array.from(atob(hmac), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payload));
    return valid ? email : null;
  } catch {
    return null;
  }
}

// Legacy export used by aidops-style callers; kept for compat.
export function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getClientIP(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}

// ── Handlers ────────────────────────────────────────────────────────────────

async function handleStart(request, env, ctx, requestId) {
  const log = bindLogger(requestId);
  const parsed = await parseBody(request, TryStartSchema);
  if (!parsed.ok) {
    return errResponse(parsed.error, parsed.code, 400, requestId, { issues: parsed.issues });
  }
  const email = parsed.data.email;

  // IP rate limit
  const ip = getClientIP(request);
  const window = await readIpWindow(env.DATA, ip, IP_WINDOW_SEC);
  if (window.count >= IP_MAX_SESSIONS) {
    log.event(EVENTS.RATE_LIMIT_HIT, { limit: "ip", route: "try/start" });
    return errResponse("Too many requests. Please try again later.", "rate_limited_ip", 429, requestId);
  }
  await writeIpWindow(env.DATA, ip, IP_WINDOW_SEC, { count: window.count + 1, start: window.start });

  // Per-email usage cap
  const usage = await readEmailUsage(env.DATA, email);
  if (usage.count >= MAX_EXCHANGES) {
    log.event(EVENTS.RATE_LIMIT_HIT, { limit: "email_exchanges", route: "try/start" });
    return errResponse(
      `You've used all ${MAX_EXCHANGES} free exchanges. Install opchain for unlimited access.`,
      "exchanges_exhausted",
      429,
      requestId,
      { remaining: 0 },
    );
  }

  const newLead = await writeLeadIfNew(env.DATA, email, "tryit", leadTtlSec(env));

  if (!env.DEPLOY_API_TOKEN) {
    log.error("opchain-try: DEPLOY_API_TOKEN is not set — refusing to sign tokens");
    return errResponse("Try-It is not configured.", "not_configured", 503, requestId);
  }
  const token = await createSessionToken(email, env.DEPLOY_API_TOKEN);

  // Analytics — fire and forget
  try {
    const distinctId = await hashDistinctId(email);
    ctx?.waitUntil?.(capture(env, {
      distinctId,
      event: "demo_email_submitted",
      properties: { new_lead: newLead, request_id: requestId },
    }));
  } catch (e) {
    log.warn("analytics error:", e.message);
  }

  return jsonResponse(
    { session_token: token, remaining: MAX_EXCHANGES - usage.count },
    200,
    requestId,
  );
}

async function handleChat(request, env, ctx, requestId) {
  const log = bindLogger(requestId);
  const parsed = await parseBody(request, TryChatSchema);
  if (!parsed.ok) {
    return errResponse(parsed.error, parsed.code, 400, requestId, { issues: parsed.issues });
  }
  const { skill, messages, session_token: sessionToken } = parsed.data;

  if (!env.DEPLOY_API_TOKEN) {
    log.error("opchain-try: DEPLOY_API_TOKEN is not set — refusing to verify tokens");
    return errResponse("Try-It is not configured.", "not_configured", 503, requestId);
  }
  const email = await verifySessionToken(sessionToken, env.DEPLOY_API_TOKEN);
  if (!email) {
    return errResponse(
      "Invalid or expired session. Please re-enter your email.",
      "invalid_session",
      401,
      requestId,
    );
  }

  if (!VALID_SKILLS.includes(skill)) {
    return errResponse(
      `Invalid skill. Choose one of: ${VALID_SKILLS.join(", ")}`,
      "invalid_skill",
      400,
      requestId,
    );
  }

  const userMessageCount = messages.filter((m) => m.role === "user").length;
  if (userMessageCount > MAX_EXCHANGES) {
    log.event(EVENTS.RATE_LIMIT_HIT, { limit: "exchanges_in_transcript", route: "try/chat" });
    return errResponse(
      `Maximum ${MAX_EXCHANGES} exchanges reached. Install opchain for unlimited access.`,
      "exchanges_exhausted",
      429,
      requestId,
      { remaining: 0 },
    );
  }

  const usage = await readEmailUsage(env.DATA, email);
  if (usage.count >= MAX_EXCHANGES) {
    log.event(EVENTS.RATE_LIMIT_HIT, { limit: "email_exchanges", route: "try/chat" });
    return errResponse(
      `You've used all ${MAX_EXCHANGES} free exchanges. Install opchain for unlimited access.`,
      "exchanges_exhausted",
      429,
      requestId,
      { remaining: 0 },
    );
  }

  if (!env.ANTHROPIC_API_KEY) {
    return errResponse("AI service is not configured.", "not_configured", 503, requestId);
  }

  const systemPrompt = SKILL_PROMPTS[skill];
  const cleanMessages = messages
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
    .slice(-(MAX_EXCHANGES * 2));

  const distinctId = await hashDistinctId(email);
  if (userMessageCount === 1) {
    log.event(EVENTS.CHAT_STARTED, { skill });
    ctx?.waitUntil?.(capture(env, {
      distinctId,
      event: "demo_chat_started",
      properties: { skill, request_id: requestId },
    }));
  }

  const model = env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  let anthropicRes;
  try {
    anthropicRes = await fetchWithRetry(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          stream: true,
          system: systemPrompt,
          messages: cleanMessages,
        }),
      },
    );
  } catch (e) {
    log.eventError(EVENTS.UPSTREAM_FAILED, { upstream: "anthropic", reason: "fetch_error", message: e.message });
    return errResponse("Could not reach AI service. Please try again.", "upstream_unreachable", 502, requestId);
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "");
    log.eventError(EVENTS.UPSTREAM_FAILED, { upstream: "anthropic", status: anthropicRes.status, message: errText.slice(0, 200) });
    if (anthropicRes.status === 429) {
      return errResponse("AI service is busy. Please try again in a moment.", "upstream_busy", 503, requestId);
    }
    return errResponse("AI service error. Please try again.", "upstream_error", 502, requestId);
  }

  await writeEmailUsage(env.DATA, email, EMAIL_TTL_SEC, { count: usage.count + 1 });
  const remaining = MAX_EXCHANGES - (usage.count + 1);

  // Pipe Anthropic SSE → our SSE, emit one final `done` event.
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const pipe = (async () => {
    let completed = false;
    try {
      const reader = anthropicRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const event = JSON.parse(data);
            if (event.type === "content_block_delta" && event.delta?.text) {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
            } else if (event.type === "message_stop") {
              completed = true;
              await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true, remaining })}\n\n`));
            }
          } catch { /* skip */ }
        }
      }
      if (!completed) {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true, remaining })}\n\n`));
      }
      log.event(EVENTS.CHAT_COMPLETED, { skill, remaining });
      ctx?.waitUntil?.(capture(env, {
        distinctId,
        event: "demo_chat_completed",
        properties: { skill, remaining, request_id: requestId },
      }));
    } catch (e) {
      log.eventError(EVENTS.UPSTREAM_FAILED, { upstream: "anthropic", reason: "stream_error", message: e.message });
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ error: "Stream interrupted.", code: "stream_interrupted" })}\n\n`));
      } catch { /* writer closed */ }
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
    }
  })();

  // Keep the Worker alive until the stream finishes.
  ctx?.waitUntil?.(pipe);

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Opchain-Request-Id": requestId,
    },
  });
}

// ── Router ──────────────────────────────────────────────────────────────────

export async function handleOpchainTry(request, url, env, ctx) {
  const requestId = request.headers.get("X-Opchain-Request-Id") || newRequestId();

  if (request.method !== "POST") {
    return errResponse("Method not allowed", "method_not_allowed", 405, requestId);
  }

  if (url.pathname === "/api/opchain/try/start") {
    return handleStart(request, env, ctx, requestId);
  }
  if (url.pathname === "/api/opchain/try/chat") {
    return handleChat(request, env, ctx, requestId);
  }
  return errResponse("Not found", "not_found", 404, requestId);
}
