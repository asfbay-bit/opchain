import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index.js";
import { NotifyPipelineSchema } from "../src/lib/schemas.js";
import {
  buildPipelineEmailHtml,
  buildPipelineEmailText,
  escapeHtml,
} from "../src/lib/email-templates/pipeline.js";

function req(url, init) {
  return new Request(url, init);
}

function makeKv() {
  const store = new Map();
  return {
    store,
    async get(key) { return store.get(key) ?? null; },
    async put(key, value, _opts) { store.set(key, value); },
  };
}

function envWith(overrides = {}) {
  return {
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "opchain.dev <pipeline@opchain.dev>",
    ASSETS: { async fetch() { return new Response("", { status: 200 }); } },
    ...overrides,
  };
}

// Capture the `ctx.waitUntil(...)` promises so deferred work (KV writes,
// PostHog capture) can be awaited from the test. Mirrors the runtime
// contract Cloudflare Workers provide.
function makeCtx() {
  const pending = [];
  return {
    waitUntil(p) { pending.push(Promise.resolve(p)); },
    async drain() { await Promise.all(pending); },
  };
}

const validBody = {
  name: "Alice",
  email: "alice@example.com",
  answers: {
    kind: "web app",
    team: "team of 2–5",
    deploy: "Cloudflare",
    aiSurface: "Claude Code",
  },
  skills: [
    { id: "app-architect", name: "app-architect", summary: "Plans + builds" },
    { id: "code-auditor",  name: "code-auditor",  summary: "Quality gate" },
  ],
};

function resendOk(id = "re_abc123") {
  return new Response(JSON.stringify({ id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Schema ─────────────────────────────────────────────────────

describe("NotifyPipelineSchema", () => {
  it("accepts a valid payload", () => {
    const result = NotifyPipelineSchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const { name: _name, ...rest } = validBody;
    const result = NotifyPipelineSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = NotifyPipelineSchema.safeParse({ ...validBody, name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects name > 80 chars", () => {
    const result = NotifyPipelineSchema.safeParse({ ...validBody, name: "a".repeat(81) });
    expect(result.success).toBe(false);
  });

  it("rejects malformed email", () => {
    const result = NotifyPipelineSchema.safeParse({ ...validBody, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects empty skills array", () => {
    const result = NotifyPipelineSchema.safeParse({ ...validBody, skills: [] });
    expect(result.success).toBe(false);
  });

  it("rejects skills array > 12 items", () => {
    const skills = Array.from({ length: 13 }, (_, i) => ({
      id: `s${i}`, name: `s${i}`, summary: "x",
    }));
    const result = NotifyPipelineSchema.safeParse({ ...validBody, skills });
    expect(result.success).toBe(false);
  });

  it("rejects oversize skill summary", () => {
    const skills = [{ id: "x", name: "x", summary: "a".repeat(201) }];
    const result = NotifyPipelineSchema.safeParse({ ...validBody, skills });
    expect(result.success).toBe(false);
  });

  it("rejects oversize answers value", () => {
    const answers = { ...validBody.answers, kind: "a".repeat(41) };
    const result = NotifyPipelineSchema.safeParse({ ...validBody, answers });
    expect(result.success).toBe(false);
  });

  it("rejects missing answers.aiSurface", () => {
    const { aiSurface: _x, ...rest } = validBody.answers;
    const result = NotifyPipelineSchema.safeParse({ ...validBody, answers: rest });
    expect(result.success).toBe(false);
  });
});

// ── HTML renderer ──────────────────────────────────────────────

describe("buildPipelineEmailHtml", () => {
  it("escapes HTML metacharacters", () => {
    expect(escapeHtml('<script>"&\'')).toBe("&lt;script&gt;&quot;&amp;&#39;");
  });

  it("includes the user's name", () => {
    const html = buildPipelineEmailHtml(validBody);
    expect(html).toContain("Hi Alice");
  });

  it("includes every wizard answer", () => {
    const html = buildPipelineEmailHtml(validBody);
    expect(html).toContain("web app");
    expect(html).toContain("team of 2");
    expect(html).toContain("Cloudflare");
    expect(html).toContain("Claude Code");
  });

  it("includes every skill name", () => {
    const html = buildPipelineEmailHtml(validBody);
    expect(html).toContain("app-architect");
    expect(html).toContain("code-auditor");
    expect(html).toContain("Plans + builds");
    expect(html).toContain("Quality gate");
  });

  it("links skills back to opchain.dev/skills/<id>", () => {
    const html = buildPipelineEmailHtml(validBody);
    expect(html).toContain("https://opchain.dev/skills/app-architect");
    expect(html).toContain("https://opchain.dev/skills/code-auditor");
  });

  it("renders a numbered next-steps list", () => {
    const html = buildPipelineEmailHtml(validBody);
    expect(html).toContain("01");
    expect(html).toContain("02");
    expect(html).toContain("03");
    expect(html).toContain("04");
  });

  it("escapes a <script> payload in the name", () => {
    const html = buildPipelineEmailHtml({
      ...validBody,
      name: '<script>alert("xss")</script>',
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes a <script> payload in a skill name", () => {
    const html = buildPipelineEmailHtml({
      ...validBody,
      skills: [
        { id: "evil", name: '<img src=x onerror=alert(1)>', summary: "boom" },
      ],
    });
    expect(html).not.toContain("<img src=x onerror=");
    expect(html).toContain("&lt;img");
  });

  it("does not embed external assets or tracking pixels", () => {
    const html = buildPipelineEmailHtml(validBody);
    expect(html).not.toMatch(/<img[^>]+src=["']https?:\/\//);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<link rel=\"stylesheet\"");
  });
});

describe("buildPipelineEmailText", () => {
  it("returns non-empty text with the user's name and skills", () => {
    const text = buildPipelineEmailText(validBody);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("Alice");
    expect(text).toContain("app-architect");
    expect(text).toContain("code-auditor");
  });

  it("includes every wizard answer", () => {
    const text = buildPipelineEmailText(validBody);
    expect(text).toContain("web app");
    expect(text).toContain("Cloudflare");
    expect(text).toContain("Claude Code");
  });
});

// ── Handler ────────────────────────────────────────────────────

describe("POST /api/email-pipeline", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(resendOk());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("400s on missing required fields", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/email-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@example.com" }),
      }),
      envWith({ NOTIFY: makeKv() }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_body");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("503s when RESEND_API_KEY is unset", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/email-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      envWith({ NOTIFY: makeKv(), RESEND_API_KEY: undefined }),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends via Resend and persists a lead record on success", async () => {
    const kv = makeKv();
    const ctx = makeCtx();
    const res = await worker.fetch(
      req("https://opchain.dev/api/email-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      envWith({ NOTIFY: kv }),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBe("re_abc123");

    // Resend was called with a Bearer + the expected JSON shape.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0];
    expect(endpoint).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
    const sent = JSON.parse(init.body);
    expect(sent.to).toEqual(["alice@example.com"]);
    expect(sent.from).toBe("opchain.dev <pipeline@opchain.dev>");
    expect(sent.subject).toBe("Your opchain pipeline");
    expect(sent.html).toContain("Alice");
    expect(sent.html).toContain("app-architect");
    expect(sent.text.length).toBeGreaterThan(0);

    // Drain ctx.waitUntil to flush the deferred KV write + PostHog capture.
    await ctx.drain();
    const leadKeys = [...kv.store.keys()].filter((k) => k.startsWith("lead:"));
    expect(leadKeys).toHaveLength(1);
    const persisted = JSON.parse(kv.store.get(leadKeys[0]));
    expect(persisted.name).toBe("Alice");
    expect(persisted.email).toBe("alice@example.com");
    expect(persisted.source).toBe("pipeline-builder-email");
    expect(persisted.building).toContain("web app");
  });

  it("returns 502 when Resend responds non-2xx and skips the lead write", async () => {
    fetchMock.mockResolvedValueOnce(new Response("rate limit", { status: 429 }));
    const kv = makeKv();
    const res = await worker.fetch(
      req("https://opchain.dev/api/email-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      envWith({ NOTIFY: kv }),
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe("email_send_failed");
    const leadKeys = [...kv.store.keys()].filter((k) => k.startsWith("lead:"));
    expect(leadKeys).toHaveLength(0);
  });

  it("returns 502 when Resend fetch throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    const res = await worker.fetch(
      req("https://opchain.dev/api/email-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      envWith({ NOTIFY: makeKv() }),
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe("email_send_failed");
  });

  it("returns 503 when the kill-switch flag is on", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/email-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      envWith({
        NOTIFY: makeKv(),
        FLAG_SITE_OPS_API_EMAIL_PIPELINE_KILL: "true",
      }),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("kill_switch");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rate-limits per IP after 3 sends in 60s", async () => {
    const kv = makeKv();
    const env = envWith({ NOTIFY: kv });
    const headers = {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.42",
    };
    const body = JSON.stringify(validBody);

    for (let i = 0; i < 3; i++) {
      const res = await worker.fetch(
        req("https://opchain.dev/api/email-pipeline", { method: "POST", headers, body }),
        env,
      );
      expect(res.status).toBe(200);
    }
    const fourth = await worker.fetch(
      req("https://opchain.dev/api/email-pipeline", { method: "POST", headers, body }),
      env,
    );
    expect(fourth.status).toBe(429);
    const j = await fourth.json();
    expect(j.code).toBe("rate_limited");
    // 3 successes, no 4th call to Resend.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("accepts the submission when NOTIFY KV isn't bound (skips persistence + rate-limit)", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/email-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      envWith(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
