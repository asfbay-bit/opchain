/**
 * opchain-dev — Cloudflare Worker for opchain.dev
 *
 * Routes:
 *   GET  /api/health           → health check
 *   POST /api/feedback          → Linear issue creation
 *   POST /api/try/start         → email-gated demo session
 *   POST /api/try/chat          → streaming AI chat
 *   GET  /*                     → static assets (public/)
 */

import { handleOpchainTry } from "./opchain-try.js";
import { SKILL_NAMES } from "./generated/skill-prompts.js";

// Injected at build time by esbuild `define` (see build.mjs). In tests the
// identifier is replaced before import by the Vitest define plumbing.
// eslint-disable-next-line no-undef
const VERSION = typeof __OPCHAIN_VERSION__ !== "undefined" ? __OPCHAIN_VERSION__ : "dev";

// ── Linear Feedback Config ──────────────────────────────────────────────────

const TEAM_ID = "7548a4f9-6ed3-42a6-9130-3b2b45db3c5c";
const PROJECT_ID = "7a8ea196-9a52-4efb-b997-003cb48a3f1a";

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
  "https://opchain-dev.4fstpkkw72.workers.dev",
  "https://aidops.dev",
  "https://www.aidops.dev",
  "http://localhost:8787",
  "http://localhost:3000",
];

const LINEAR_MUTATION = `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { id identifier url }
  }
}`;

// ── Helpers ─────────────────────────────────────────────────────────────────

export function corsHeaders(origin) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
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
  // Follow 308 redirects from Workers assets (trailing slash normalization)
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

async function handleFeedback(request, env, origin) {
  try {
    const body = await request.json();
    const { type, title, description, priority, skill, email } = body;

    if (!type || !title) {
      return new Response(
        JSON.stringify({ error: "type and title are required" }),
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const LINEAR_API_KEY = env.LINEAR_API_KEY;
    if (!LINEAR_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Feedback endpoint not configured" }),
        { status: 503, headers: corsHeaders(origin) },
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
        labelIds,
      },
    };

    const linearRes = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: LINEAR_API_KEY,
      },
      body: JSON.stringify({ query: LINEAR_MUTATION, variables }),
    });

    const linearData = await linearRes.json();

    if (linearData.data?.issueCreate?.success) {
      const issue = linearData.data.issueCreate.issue;
      return new Response(
        JSON.stringify({ ok: true, id: issue.identifier, url: issue.url }),
        { status: 201, headers: corsHeaders(origin) },
      );
    }

    console.error("Linear API error:", JSON.stringify(linearData));
    return new Response(
      JSON.stringify({ error: "Failed to create issue" }),
      { status: 500, headers: corsHeaders(origin) },
    );
  } catch (e) {
    console.error("Feedback handler error:", e.message);
    return new Response(
      JSON.stringify({ error: "Invalid request" }),
      { status: 400, headers: corsHeaders(origin) },
    );
  }
}

// ── Main Router ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);

    // CORS preflight for API routes
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Health check
    if (url.pathname === "/api/health" && request.method === "GET") {
      return new Response(
        JSON.stringify({ ok: true, service: "opchain-dev", version: VERSION }),
        {
          headers: {
            "Content-Type": "application/json",
            "X-Opchain-Version": VERSION,
          },
        },
      );
    }

    // Feedback → Linear
    if (url.pathname === "/api/feedback" && request.method === "POST") {
      return handleFeedback(request, env, origin);
    }

    // Try It — email-gated AI chat demo
    if (url.pathname.startsWith("/api/try") && request.method === "POST") {
      // Remap /api/try/* → /api/opchain/try/* for the shared handler
      const tryUrl = new URL(url);
      tryUrl.pathname = url.pathname.replace("/api/try", "/api/opchain/try");
      return handleOpchainTry(request, tryUrl, env);
    }

    // Static assets — serve from public/
    // Normalize root → index.html
    if (url.pathname === "/") {
      const indexReq = new Request(new URL("/index.html", url.origin), request);
      const res = await fetchAsset(env, indexReq, url.origin);
      return applySecurityHeaders(res);
    }

    // Serve .zip with download header
    if (url.pathname.endsWith(".zip")) {
      const res = await fetchAsset(env, request, url.origin);
      const dlRes = new Response(res.body, res);
      dlRes.headers.set("Content-Disposition", 'attachment; filename="opchain-skills.zip"');
      dlRes.headers.set("Cache-Control", "public, max-age=3600");
      return applySecurityHeaders(dlRes);
    }

    // All other static files
    const res = await fetchAsset(env, request, url.origin);
    return applySecurityHeaders(res);
  },
};
