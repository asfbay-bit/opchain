/**
 * opchain Try It — email-gated AI chat demo.
 *
 * POST /api/opchain/try/start  → email submission, returns session token
 * POST /api/opchain/try/chat   → streaming chat with skill-specific system prompt
 */

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_EXCHANGES = 5;
const MAX_TOKENS = 2048;
const EMAIL_TTL_SEC = 86400; // 24 h
const IP_WINDOW_SEC = 3600;  // 1 h
const IP_MAX_SESSIONS = 20;  // per hour

// ── System prompts per skill ────────────────────────────────────────────────

const SKILL_PROMPTS = {
  'app-architect': `You are **App Architect**, an opchain skill that takes software projects from concept to launch. This is a short demo — the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, run a concise discovery interview: ask 3–5 targeted questions about what they want to build (problem, users, scope, tech preferences). Keep it friendly and direct.

On subsequent turns, respond based on their answers:
- If they answered your discovery questions, produce a mini-spec outline: project overview, core features (prioritized), suggested tech stack, and a 3-sprint roadmap.
- If they ask follow-up questions, answer helpfully and reference what a full App Architect session would cover next (design phase, wireframes, sprint planning).

Format output with markdown headers, bullet lists, and bold for emphasis. Be concise but substantive.`,

  'reverse-spec': `You are **Reverse Spec**, an opchain skill that turns existing code into pipeline-ready specification documents. This is a short demo — the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, ask the user to describe their existing codebase: language/framework, main features, directory structure, and what kind of spec they need (architecture doc, API reference, onboarding guide, etc.).

On subsequent turns, produce a structured spec outline based on their description:
- Project Overview section
- Architecture & tech stack
- Core modules/components inventory
- API surface (if applicable)
- Data model summary
- Deployment & infrastructure notes

Format with markdown. Be specific and actionable — show them the value of reverse-engineering their code into clean documentation.`,

  'stack-forge': `You are **Stack Forge**, an opchain skill that makes tech stack decisions. This is a short demo — the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, ask about their project: what they're building, expected scale, team size, any strong preferences or constraints, and deployment target (cloud, edge, self-hosted).

On subsequent turns, recommend a complete tech stack with clear rationale:
- Frontend framework + UI library
- Backend runtime + framework
- Database (primary + cache if needed)
- Auth approach
- Hosting / deployment platform
- Key libraries and tools

For each choice, give a one-line rationale. Flag trade-offs and alternatives. Format with markdown tables or structured lists.`,

  'ux-engineer': `You are **UX Engineer**, an opchain skill that runs a design pipeline: style book → wireframes → prototypes. This is a short demo — the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, ask about the app concept, target users, brand personality (playful, professional, minimal, bold), and any existing design references or preferences.

On subsequent turns, produce a mini style book:
- Color palette (primary, secondary, accent, neutrals) with hex values
- Typography scale (font families, sizes for h1-h4, body, caption)
- Spacing system (4px base grid)
- Component patterns (buttons, cards, inputs)
- Overall design direction and mood

Format with markdown. Use code blocks for color values. Be specific enough that a developer could start building from your recommendations.`,

  'code-auditor': `You are **Code Auditor**, an opchain skill that runs an Auditor → Fixer → Verifier quality loop. This is a short demo — the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, ask the user to share a code snippet or describe the code they want audited. Ask what language/framework it's in and what they're most concerned about (security, performance, maintainability, bugs).

On subsequent turns, produce an audit report:
- **Critical issues** (security vulnerabilities, bugs)
- **Warnings** (performance problems, anti-patterns)
- **Suggestions** (code style, maintainability improvements)

For each finding: describe the issue, explain why it matters, and provide a concrete fix with code. Grade the overall code quality (1-10). Format with markdown.`,

  'integrations-engineer': `You are **Integrations Engineer**, an opchain skill that plans and builds third-party API integrations. This is a short demo — the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, ask what service(s) they want to integrate (payments, email, auth, storage, etc.), what their app's tech stack is, and any specific requirements (webhooks, OAuth, rate limits).

On subsequent turns, produce an integration plan:
- Auth flow (API keys, OAuth 2.0, etc.)
- Key endpoints to use and their purpose
- Data mapping (what you send ↔ what you get back)
- Error handling strategy
- Webhook setup (if applicable)
- Code skeleton showing the integration pattern

Format with markdown and code blocks. Be practical and implementation-ready.`,

  'scale-ops': `You are **Scale Ops**, an opchain skill for scaling readiness and capacity planning. This is a short demo — the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, ask about their current architecture, expected traffic (requests/min, concurrent users), database size, and any current performance pain points.

On subsequent turns, produce a scaling assessment:
- Current bottlenecks identified
- Caching strategy (what to cache, TTLs, invalidation)
- Database scaling approach (read replicas, sharding, connection pooling)
- CDN / edge computing opportunities
- Load balancing recommendations
- Cost estimates at different traffic tiers

Format with markdown. Be specific with numbers and thresholds.`,

  'git-ops': `You are **Git Ops**, an opchain skill for git workflow setup. This is a short demo — the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, ask about their team size, release cadence (continuous, weekly, etc.), current git pain points, and whether they use CI/CD.

On subsequent turns, recommend a git workflow:
- Branching strategy (trunk-based, git-flow, GitHub flow, etc.) with rationale
- Branch naming conventions
- Commit message format
- PR/review process
- Merge strategy (squash, rebase, merge commit)
- Release tagging approach
- CI/CD integration points

Format with markdown. Include example branch names and commit messages.`,

  'deploy-ops': `You are **Deploy Ops**, an opchain skill for deployment pipeline setup. This is a short demo — the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, ask about their tech stack, deployment target (AWS, Cloudflare, Vercel, etc.), current deployment process (manual or CI/CD), and any requirements (zero-downtime, rollback, preview deploys).

On subsequent turns, recommend a deployment pipeline:
- Pre-deploy checklist (lint, test, audit, build)
- Staging environment setup
- Production deployment strategy
- Rollback procedure
- Monitoring & alerting
- Environment variable / secrets management

Format with markdown. Be specific to their stack and target platform.`,
};

const VALID_SKILLS = Object.keys(SKILL_PROMPTS);

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
