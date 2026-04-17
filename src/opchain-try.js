/**
 * opchain Try It — email-gated AI chat demo.
 *
 * POST /api/opchain/try/start  → email submission, returns session token
 * POST /api/opchain/try/chat   → streaming chat with skill-specific system prompt
 */

// Catalog is generated from skills/<id>/SKILL.md + TRYIT.md at build time.
// See scripts/gen-skills-catalog.mjs. The Worker bundle inlines this via esbuild.
import { SKILL_PROMPTS, VALID_SKILLS } from './generated/skill-prompts.js';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_EXCHANGES = 5;
const MAX_TOKENS = 2048;
const EMAIL_TTL_SEC = 86400; // 24 h
const IP_WINDOW_SEC = 3600;  // 1 h
const IP_MAX_SESSIONS = 20;  // per hour

// ── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Create an HMAC-signed session token. */
export async function createSessionToken(email, secret) {
  const id = crypto.randomUUID();
  const payload = `${id}:${email}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const hmac = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${payload}:${hmac}`;
}

/** Verify an HMAC-signed session token. Returns the email or null. */
export async function verifySessionToken(token, secret) {
  if (typeof token !== 'string') return null;
  const parts = token.split(':');
  if (parts.length < 3) return null;
  const hmac = parts.pop();
  const payload = parts.join(':');
  const emailStart = payload.indexOf(':');
  if (emailStart < 0) return null;
  const email = payload.slice(emailStart + 1);
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sigBytes = Uint8Array.from(atob(hmac), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload));
    return valid ? email : null;
  } catch {
    return null;
  }
}

function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || '0.0.0.0';
}

// ── Rate limiting ───────────────────────────────────────────────────────────

async function checkIPRate(env, ip) {
  const key = `opchain-try-ip:${ip}`;
  const raw = await env.DATA.get(key);
  const now = Math.floor(Date.now() / 1000);
  let count = 0;
  let start = now;
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (data.start && now - data.start < IP_WINDOW_SEC) {
        count = data.count;
        start = data.start;
      }
    } catch { /* fresh window */ }
  }
  if (count >= IP_MAX_SESSIONS) return false;
  await env.DATA.put(key, JSON.stringify({ count: count + 1, start }), {
    expirationTtl: IP_WINDOW_SEC,
  });
  return true;
}

async function getEmailUsage(env, email) {
  const key = `opchain-try-email:${email.toLowerCase()}`;
  const raw = await env.DATA.get(key);
  if (!raw) return { count: 0 };
  try {
    return JSON.parse(raw);
  } catch {
    return { count: 0 };
  }
}

async function incrementEmailUsage(env, email) {
  const key = `opchain-try-email:${email.toLowerCase()}`;
  const usage = await getEmailUsage(env, email);
  usage.count += 1;
  await env.DATA.put(key, JSON.stringify(usage), { expirationTtl: EMAIL_TTL_SEC });
}

// ── Handlers ────────────────────────────────────────────────────────────────

/** POST /api/opchain/try/start */
async function handleStart(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const email = body?.email?.trim();
  if (!isValidEmail(email)) {
    return jsonResponse({ error: 'A valid email address is required.' }, 400);
  }

  // IP rate limit (prevent email spam)
  const ip = getClientIP(request);
  const ipOk = await checkIPRate(env, ip);
  if (!ipOk) {
    return jsonResponse({ error: 'Too many requests. Please try again later.' }, 429);
  }

  // Check existing email usage
  const usage = await getEmailUsage(env, email);
  if (usage.count >= MAX_EXCHANGES) {
    return jsonResponse({
      error: `You've used all ${MAX_EXCHANGES} free exchanges. Install opchain for unlimited access.`,
      remaining: 0,
    }, 429);
  }

  // Store email for lead tracking (persistent, no TTL)
  const leadKey = `opchain-leads:${email.toLowerCase()}`;
  const existingLead = await env.DATA.get(leadKey);
  if (!existingLead) {
    await env.DATA.put(leadKey, JSON.stringify({
      email: email.toLowerCase(),
      first_seen: new Date().toISOString(),
      source: 'tryit',
    }));
  }

  // Create signed session token. Fail closed if the signing secret is not configured.
  if (!env.DEPLOY_API_TOKEN) {
    console.error('opchain-try: DEPLOY_API_TOKEN is not set — refusing to sign tokens');
    return jsonResponse({ error: 'Try-It is not configured.' }, 503);
  }
  const token = await createSessionToken(email, env.DEPLOY_API_TOKEN);

  return jsonResponse({
    session_token: token,
    remaining: MAX_EXCHANGES - usage.count,
  });
}

/** POST /api/opchain/try/chat */
async function handleChat(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { skill, messages, session_token } = body || {};

  // Validate session token. Fail closed if the signing secret is not configured.
  if (!env.DEPLOY_API_TOKEN) {
    console.error('opchain-try: DEPLOY_API_TOKEN is not set — refusing to verify tokens');
    return jsonResponse({ error: 'Try-It is not configured.' }, 503);
  }
  const email = await verifySessionToken(session_token, env.DEPLOY_API_TOKEN);
  if (!email) {
    return jsonResponse({ error: 'Invalid or expired session. Please re-enter your email.' }, 401);
  }

  // Validate skill
  if (!skill || !VALID_SKILLS.includes(skill)) {
    return jsonResponse({ error: `Invalid skill. Choose one of: ${VALID_SKILLS.join(', ')}` }, 400);
  }

  // Validate messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: 'Messages array is required.' }, 400);
  }
  // Count user messages (exchanges)
  const userMessageCount = messages.filter((m) => m.role === 'user').length;
  if (userMessageCount > MAX_EXCHANGES) {
    return jsonResponse({
      error: `Maximum ${MAX_EXCHANGES} exchanges reached. Install opchain for unlimited access.`,
      remaining: 0,
    }, 429);
  }

  // Check email usage
  const usage = await getEmailUsage(env, email);
  if (usage.count >= MAX_EXCHANGES) {
    return jsonResponse({
      error: `You've used all ${MAX_EXCHANGES} free exchanges. Install opchain for unlimited access.`,
      remaining: 0,
    }, 429);
  }

  // Verify API key is configured
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'AI service is not configured.' }, 503);
  }

  // Build system prompt
  const systemPrompt = SKILL_PROMPTS[skill];

  // Clean messages — only pass role + content, limit to MAX_EXCHANGES * 2 messages
  const cleanMessages = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
    .slice(-(MAX_EXCHANGES * 2));

  // Call Anthropic with streaming
  let anthropicRes;
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        stream: true,
        system: systemPrompt,
        messages: cleanMessages,
      }),
    });
  } catch (e) {
    console.error('opchain-try fetch error:', e.message);
    return jsonResponse({ error: 'Could not reach AI service. Please try again.' }, 502);
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => '');
    console.error('opchain-try Anthropic error:', anthropicRes.status, errText);
    if (anthropicRes.status === 429) {
      return jsonResponse({ error: 'AI service is busy. Please try again in a moment.' }, 503);
    }
    return jsonResponse({ error: 'AI service error. Please try again.' }, 502);
  }

  // Increment email usage (count this exchange)
  await incrementEmailUsage(env, email);
  const remaining = MAX_EXCHANGES - (usage.count + 1);

  // Stream the response, piping Anthropic SSE to the client
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Pipe in the background
  (async () => {
    try {
      const reader = anthropicRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const event = JSON.parse(data);
              if (event.type === 'content_block_delta' && event.delta?.text) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
              } else if (event.type === 'message_stop') {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true, remaining })}\n\n`));
              }
            } catch { /* skip unparseable events */ }
          }
        }
      }

      // Final done event if not already sent
      await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true, remaining })}\n\n`));
    } catch (e) {
      console.error('opchain-try stream error:', e.message);
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted.' })}\n\n`));
      } catch { /* writer closed */ }
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ── Router ──────────────────────────────────────────────────────────────────

export async function handleOpchainTry(request, url, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (url.pathname === '/api/opchain/try/start') {
    return handleStart(request, env);
  }
  if (url.pathname === '/api/opchain/try/chat') {
    return handleChat(request, env);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}
