// src/opchain-try.js
var MODEL = "claude-haiku-4-5-20251001";
var MAX_EXCHANGES = 5;
var MAX_TOKENS = 2048;
var EMAIL_TTL_SEC = 86400;
var IP_WINDOW_SEC = 3600;
var IP_MAX_SESSIONS = 20;
var SKILL_PROMPTS = {
  "app-architect": `You are **App Architect**, an opchain skill that takes software projects from concept to launch. This is a short demo \u2014 the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, run a concise discovery interview: ask 3\u20135 targeted questions about what they want to build (problem, users, scope, tech preferences). Keep it friendly and direct.

On subsequent turns, respond based on their answers:
- If they answered your discovery questions, produce a mini-spec outline: project overview, core features (prioritized), suggested tech stack, and a 3-sprint roadmap.
- If they ask follow-up questions, answer helpfully and reference what a full App Architect session would cover next (design phase, wireframes, sprint planning).

Format output with markdown headers, bullet lists, and bold for emphasis. Be concise but substantive.`,
  "reverse-spec": `You are **Reverse Spec**, an opchain skill that turns existing code into pipeline-ready specification documents. This is a short demo \u2014 the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, ask the user to describe their existing codebase: language/framework, main features, directory structure, and what kind of spec they need (architecture doc, API reference, onboarding guide, etc.).

On subsequent turns, produce a structured spec outline based on their description:
- Project Overview section
- Architecture & tech stack
- Core modules/components inventory
- API surface (if applicable)
- Data model summary
- Deployment & infrastructure notes

Format with markdown. Be specific and actionable \u2014 show them the value of reverse-engineering their code into clean documentation.`,
  "stack-forge": `You are **Stack Forge**, an opchain skill that makes tech stack decisions. This is a short demo \u2014 the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, ask about their project: what they're building, expected scale, team size, any strong preferences or constraints, and deployment target (cloud, edge, self-hosted).

On subsequent turns, recommend a complete tech stack with clear rationale:
- Frontend framework + UI library
- Backend runtime + framework
- Database (primary + cache if needed)
- Auth approach
- Hosting / deployment platform
- Key libraries and tools

For each choice, give a one-line rationale. Flag trade-offs and alternatives. Format with markdown tables or structured lists.`,
  "ux-engineer": `You are **UX Engineer**, an opchain skill that runs a design pipeline: style book \u2192 wireframes \u2192 prototypes. This is a short demo \u2014 the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, ask about the app concept, target users, brand personality (playful, professional, minimal, bold), and any existing design references or preferences.

On subsequent turns, produce a mini style book:
- Color palette (primary, secondary, accent, neutrals) with hex values
- Typography scale (font families, sizes for h1-h4, body, caption)
- Spacing system (4px base grid)
- Component patterns (buttons, cards, inputs)
- Overall design direction and mood

Format with markdown. Use code blocks for color values. Be specific enough that a developer could start building from your recommendations.`,
  "code-auditor": `You are **Code Auditor**, an opchain skill that runs an Auditor \u2192 Fixer \u2192 Verifier quality loop. This is a short demo \u2014 the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, ask the user to share a code snippet or describe the code they want audited. Ask what language/framework it's in and what they're most concerned about (security, performance, maintainability, bugs).

On subsequent turns, produce an audit report:
- **Critical issues** (security vulnerabilities, bugs)
- **Warnings** (performance problems, anti-patterns)
- **Suggestions** (code style, maintainability improvements)

For each finding: describe the issue, explain why it matters, and provide a concrete fix with code. Grade the overall code quality (1-10). Format with markdown.`,
  "integrations-engineer": `You are **Integrations Engineer**, an opchain skill that plans and builds third-party API integrations. This is a short demo \u2014 the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, ask what service(s) they want to integrate (payments, email, auth, storage, etc.), what their app's tech stack is, and any specific requirements (webhooks, OAuth, rate limits).

On subsequent turns, produce an integration plan:
- Auth flow (API keys, OAuth 2.0, etc.)
- Key endpoints to use and their purpose
- Data mapping (what you send \u2194 what you get back)
- Error handling strategy
- Webhook setup (if applicable)
- Code skeleton showing the integration pattern

Format with markdown and code blocks. Be practical and implementation-ready.`,
  "scale-ops": `You are **Scale Ops**, an opchain skill for scaling readiness and capacity planning. This is a short demo \u2014 the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, ask about their current architecture, expected traffic (requests/min, concurrent users), database size, and any current performance pain points.

On subsequent turns, produce a scaling assessment:
- Current bottlenecks identified
- Caching strategy (what to cache, TTLs, invalidation)
- Database scaling approach (read replicas, sharding, connection pooling)
- CDN / edge computing opportunities
- Load balancing recommendations
- Cost estimates at different traffic tiers

Format with markdown. Be specific with numbers and thresholds.`,
  "git-ops": `You are **Git Ops**, an opchain skill for git workflow setup. This is a short demo \u2014 the user gets up to ${MAX_EXCHANGES} exchanges.

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
  "deploy-ops": `You are **Deploy Ops**, an opchain skill for deployment pipeline setup. This is a short demo \u2014 the user gets up to ${MAX_EXCHANGES} exchanges.

On the first turn, ask about their tech stack, deployment target (AWS, Cloudflare, Vercel, etc.), current deployment process (manual or CI/CD), and any requirements (zero-downtime, rollback, preview deploys).

On subsequent turns, recommend a deployment pipeline:
- Pre-deploy checklist (lint, test, audit, build)
- Staging environment setup
- Production deployment strategy
- Rollback procedure
- Monitoring & alerting
- Environment variable / secrets management

Format with markdown. Be specific to their stack and target platform.`
};
var VALID_SKILLS = Object.keys(SKILL_PROMPTS);
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
async function createSessionToken(email, secret) {
  const id = crypto.randomUUID();
  const payload = `${id}:${email}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hmac = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${payload}:${hmac}`;
}
async function verifySessionToken(token, secret) {
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
      ["verify"]
    );
    const sigBytes = Uint8Array.from(atob(hmac), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payload));
    return valid ? email : null;
  } catch {
    return null;
  }
}
function getClientIP(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "0.0.0.0";
}
async function checkIPRate(env, ip) {
  const key = `opchain-try-ip:${ip}`;
  const raw = await env.DATA.get(key);
  const now = Math.floor(Date.now() / 1e3);
  let count = 0;
  let start = now;
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (data.start && now - data.start < IP_WINDOW_SEC) {
        count = data.count;
        start = data.start;
      }
    } catch {
    }
  }
  if (count >= IP_MAX_SESSIONS) return false;
  await env.DATA.put(key, JSON.stringify({ count: count + 1, start }), {
    expirationTtl: IP_WINDOW_SEC
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
async function handleStart(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const email = body?.email?.trim();
  if (!isValidEmail(email)) {
    return jsonResponse({ error: "A valid email address is required." }, 400);
  }
  const ip = getClientIP(request);
  const ipOk = await checkIPRate(env, ip);
  if (!ipOk) {
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
  }
  const usage = await getEmailUsage(env, email);
  if (usage.count >= MAX_EXCHANGES) {
    return jsonResponse({
      error: `You've used all ${MAX_EXCHANGES} free exchanges. Install opchain for unlimited access.`,
      remaining: 0
    }, 429);
  }
  const leadKey = `opchain-leads:${email.toLowerCase()}`;
  const existingLead = await env.DATA.get(leadKey);
  if (!existingLead) {
    await env.DATA.put(leadKey, JSON.stringify({
      email: email.toLowerCase(),
      first_seen: (/* @__PURE__ */ new Date()).toISOString(),
      source: "tryit"
    }));
  }
  const secret = env.DEPLOY_API_TOKEN || "opchain-dev-secret";
  const token = await createSessionToken(email, secret);
  return jsonResponse({
    session_token: token,
    remaining: MAX_EXCHANGES - usage.count
  });
}
async function handleChat(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const { skill, messages, session_token } = body || {};
  const secret = env.DEPLOY_API_TOKEN || "opchain-dev-secret";
  const email = await verifySessionToken(session_token, secret);
  if (!email) {
    return jsonResponse({ error: "Invalid or expired session. Please re-enter your email." }, 401);
  }
  if (!skill || !VALID_SKILLS.includes(skill)) {
    return jsonResponse({ error: `Invalid skill. Choose one of: ${VALID_SKILLS.join(", ")}` }, 400);
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: "Messages array is required." }, 400);
  }
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  if (userMessageCount > MAX_EXCHANGES) {
    return jsonResponse({
      error: `Maximum ${MAX_EXCHANGES} exchanges reached. Install opchain for unlimited access.`,
      remaining: 0
    }, 429);
  }
  const usage = await getEmailUsage(env, email);
  if (usage.count >= MAX_EXCHANGES) {
    return jsonResponse({
      error: `You've used all ${MAX_EXCHANGES} free exchanges. Install opchain for unlimited access.`,
      remaining: 0
    }, 429);
  }
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: "AI service is not configured." }, 503);
  }
  const systemPrompt = SKILL_PROMPTS[skill];
  const cleanMessages = messages.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: String(m.content).slice(0, 4e3) })).slice(-(MAX_EXCHANGES * 2));
  let anthropicRes;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        stream: true,
        system: systemPrompt,
        messages: cleanMessages
      })
    });
  } catch (e) {
    console.error("opchain-try fetch error:", e.message);
    return jsonResponse({ error: "Could not reach AI service. Please try again." }, 502);
  }
  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "");
    console.error("opchain-try Anthropic error:", anthropicRes.status, errText);
    if (anthropicRes.status === 429) {
      return jsonResponse({ error: "AI service is busy. Please try again in a moment." }, 503);
    }
    return jsonResponse({ error: "AI service error. Please try again." }, 502);
  }
  await incrementEmailUsage(env, email);
  const remaining = MAX_EXCHANGES - (usage.count + 1);
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  (async () => {
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
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const event = JSON.parse(data);
              if (event.type === "content_block_delta" && event.delta?.text) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}

`));
              } else if (event.type === "message_stop") {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true, remaining })}

`));
              }
            } catch {
            }
          }
        }
      }
      await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true, remaining })}

`));
    } catch (e) {
      console.error("opchain-try stream error:", e.message);
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ error: "Stream interrupted." })}

`));
      } catch {
      }
    } finally {
      try {
        await writer.close();
      } catch {
      }
    }
  })();
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
async function handleOpchainTry(request, url, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  if (url.pathname === "/api/opchain/try/start") {
    return handleStart(request, env);
  }
  if (url.pathname === "/api/opchain/try/chat") {
    return handleChat(request, env);
  }
  return jsonResponse({ error: "Not found" }, 404);
}

// src/index.js
var TEAM_ID = "7548a4f9-6ed3-42a6-9130-3b2b45db3c5c";
var PROJECT_ID = "7a8ea196-9a52-4efb-b997-003cb48a3f1a";
var LABEL_MAP = {
  bug: "68403073-fd71-44aa-95bc-aea91ed7e4de",
  feature: "a9f89cba-878b-4c2e-a9e4-871866a03592",
  improvement: "e9956661-28ed-4ca2-8d54-8e5457bbb773",
  general: "ec0403ab-31b9-4aa6-a097-e54e4bbff69c"
};
var PRIORITY_MAP = { 0: 0, 1: 4, 2: 3, 3: 2, 4: 1 };
var SKILL_NAMES = {
  "checkpoint-protocol": "Checkpoint Protocol",
  "app-architect": "App Architect",
  "stack-forge": "Stack Forge",
  "reverse-spec": "Reverse Spec",
  "ux-engineer": "UX Engineer",
  "code-auditor": "Code Auditor",
  "integrations-engineer": "Integrations Engineer",
  "git-ops": "Git Ops",
  "deploy-ops": "Deploy Ops",
  "scale-ops": "Scale Ops"
};
var ALLOWED_ORIGINS = [
  "https://opchain.dev",
  "https://www.opchain.dev",
  "https://opchain-dev.4fstpkkw72.workers.dev",
  "https://aidops.dev",
  "https://www.aidops.dev",
  "http://localhost:8787",
  "http://localhost:3000"
];
var LINEAR_MUTATION = `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { id identifier url }
  }
}`;
function corsHeaders(origin) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
function applySecurityHeaders(response) {
  const res = new Response(response.body, response);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
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
async function handleFeedback(request, env, origin) {
  try {
    const body = await request.json();
    const { type, title, description, priority, skill, email } = body;
    if (!type || !title) {
      return new Response(
        JSON.stringify({ error: "type and title are required" }),
        { status: 400, headers: corsHeaders(origin) }
      );
    }
    const LINEAR_API_KEY = env.LINEAR_API_KEY;
    if (!LINEAR_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Feedback endpoint not configured" }),
        { status: 503, headers: corsHeaders(origin) }
      );
    }
    const labelIds = LABEL_MAP[type] ? [LABEL_MAP[type]] : [];
    const linearPriority = PRIORITY_MAP[priority] ?? 0;
    const skillName = skill ? SKILL_NAMES[skill] || skill : null;
    const descParts = [];
    if (description) descParts.push(description);
    if (skillName) descParts.push(`**Skill:** ${skillName}`);
    if (email) descParts.push(`**Contact:** ${email}`);
    descParts.push(`_Submitted via opchain.dev_`);
    const variables = {
      input: {
        teamId: TEAM_ID,
        projectId: PROJECT_ID,
        title: `[${type}] ${title}`,
        description: descParts.join("\n\n"),
        priority: linearPriority,
        labelIds
      }
    };
    const linearRes = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: LINEAR_API_KEY
      },
      body: JSON.stringify({ query: LINEAR_MUTATION, variables })
    });
    const linearData = await linearRes.json();
    if (linearData.data?.issueCreate?.success) {
      const issue = linearData.data.issueCreate.issue;
      return new Response(
        JSON.stringify({ ok: true, id: issue.identifier, url: issue.url }),
        { status: 201, headers: corsHeaders(origin) }
      );
    }
    console.error("Linear API error:", JSON.stringify(linearData));
    return new Response(
      JSON.stringify({ error: "Failed to create issue" }),
      { status: 500, headers: corsHeaders(origin) }
    );
  } catch (e) {
    console.error("Feedback handler error:", e.message);
    return new Response(
      JSON.stringify({ error: "Invalid request" }),
      { status: 400, headers: corsHeaders(origin) }
    );
  }
}
var index_default = {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (url.pathname === "/api/health" && request.method === "GET") {
      return new Response(
        JSON.stringify({ ok: true, service: "opchain-dev" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.pathname === "/api/feedback" && request.method === "POST") {
      return handleFeedback(request, env, origin);
    }
    if (url.pathname.startsWith("/api/try") && request.method === "POST") {
      const tryUrl = new URL(url);
      tryUrl.pathname = url.pathname.replace("/api/try", "/api/opchain/try");
      return handleOpchainTry(request, tryUrl, env);
    }
    if (url.pathname === "/") {
      const indexReq = new Request(new URL("/index.html", url.origin), request);
      const res2 = await fetchAsset(env, indexReq, url.origin);
      return applySecurityHeaders(res2);
    }
    if (url.pathname.endsWith(".zip")) {
      const res2 = await fetchAsset(env, request, url.origin);
      const dlRes = new Response(res2.body, res2);
      dlRes.headers.set("Content-Disposition", 'attachment; filename="opchain-skills.zip"');
      dlRes.headers.set("Cache-Control", "public, max-age=3600");
      return applySecurityHeaders(dlRes);
    }
    const res = await fetchAsset(env, request, url.origin);
    return applySecurityHeaders(res);
  }
};
export {
  index_default as default
};
