import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { LABEL_MAP, PRIORITY_MAP, corsHeaders } from "../src/index.js";

function req(url, init) {
  return new Request(url, init);
}

function envWith(overrides = {}) {
  return {
    LINEAR_API_KEY: "lin_test_key",
    ASSETS: { async fetch() { return new Response("", { status: 200 }); } },
    ...overrides,
  };
}

function linearOk(identifier = "OPC-42", url = "https://linear.app/opchain/issue/OPC-42") {
  return new Response(
    JSON.stringify({
      data: { issueCreate: { success: true, issue: { id: "abc", identifier, url } } },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("LABEL_MAP", () => {
  it("covers every feedback type the UI can submit", () => {
    expect(Object.keys(LABEL_MAP).sort()).toEqual([
      "bug",
      "feature",
      "general",
      "improvement",
      "security",
    ]);
  });

  it("maps every type to a non-empty Linear label id", () => {
    for (const id of Object.values(LABEL_MAP)) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });
});

describe("PRIORITY_MAP", () => {
  it("maps opchain priority 0-4 to Linear priority", () => {
    expect(PRIORITY_MAP[0]).toBe(0);
    expect(PRIORITY_MAP[1]).toBe(4);
    expect(PRIORITY_MAP[2]).toBe(3);
    expect(PRIORITY_MAP[3]).toBe(2);
    expect(PRIORITY_MAP[4]).toBe(1);
  });
});

describe("corsHeaders", () => {
  it("sets the origin when it matches the allow list", () => {
    const headers = corsHeaders("https://opchain.dev");
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://opchain.dev");
    expect(headers["Access-Control-Allow-Methods"]).toBe("POST, GET, OPTIONS");
    expect(headers["Access-Control-Allow-Headers"]).toBe("Content-Type, X-Opchain-Request-Id");
  });

  it("omits the origin header when the request origin is not allowed", () => {
    const headers = corsHeaders("https://evil.example.com");
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    // Still sets the rest so preflight replies are well-formed.
    expect(headers["Access-Control-Allow-Methods"]).toBe("POST, GET, OPTIONS");
  });

  it("handles a missing origin header gracefully", () => {
    const headers = corsHeaders(null);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("allows localhost for development", () => {
    expect(corsHeaders("http://localhost:8787")["Access-Control-Allow-Origin"]).toBe(
      "http://localhost:8787",
    );
    expect(corsHeaders("http://localhost:3000")["Access-Control-Allow-Origin"]).toBe(
      "http://localhost:3000",
    );
  });
});

describe("POST /api/feedback", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(linearOk());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("400s on missing required fields", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bug" }),
      }),
      envWith(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_body");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400s on unknown type enum", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "wishful-thinking", title: "hello world" }),
      }),
      envWith(),
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("503s with not_configured when LINEAR_API_KEY is unset", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bug", title: "kettle won't boil" }),
      }),
      envWith({ LINEAR_API_KEY: undefined }),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("201s and returns the Linear issue id on success", async () => {
    fetchMock.mockResolvedValueOnce(linearOk("OPC-101", "https://linear.app/x/issue/OPC-101"));
    const res = await worker.fetch(
      req("https://opchain.dev/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bug",
          title: "demo modal flashes empty",
          description: "Repro: open /demo, click any scenario card.",
          email: "alice@example.com",
        }),
      }),
      envWith(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBe("OPC-101");
    expect(body.url).toBe("https://linear.app/x/issue/OPC-101");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("posts to Linear's GraphQL endpoint with the expected mutation + headers", async () => {
    await worker.fetch(
      req("https://opchain.dev/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "feature",
          title: "add dark mode",
          description: "kettle but darker",
          priority: 2,
          skill: "ux-engineer",
        }),
      }),
      envWith(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.linear.app/graphql");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("lin_test_key");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const sent = JSON.parse(init.body);
    expect(sent.query).toMatch(/issueCreate/);
    expect(sent.variables.input.title).toBe("[feature] add dark mode");
    expect(sent.variables.input.priority).toBe(PRIORITY_MAP[2]);
    expect(sent.variables.input.labelIds).toEqual([LABEL_MAP.feature]);
    // Description carries through, and skill / request id are appended.
    expect(sent.variables.input.description).toContain("kettle but darker");
    expect(sent.variables.input.description).toContain("**Skill:** ux-engineer");
    expect(sent.variables.input.description).toMatch(/\*\*Request ID:\*\*/);
  });

  it("respects LINEAR_TEAM_ID / LINEAR_PROJECT_ID overrides", async () => {
    await worker.fetch(
      req("https://opchain.dev/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "general", title: "love it" }),
      }),
      envWith({ LINEAR_TEAM_ID: "team-override", LINEAR_PROJECT_ID: "proj-override" }),
    );
    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse(init.body);
    expect(sent.variables.input.teamId).toBe("team-override");
    expect(sent.variables.input.projectId).toBe("proj-override");
  });

  it("502s upstream_unreachable when the fetch to Linear throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const res = await worker.fetch(
      req("https://opchain.dev/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bug", title: "page broken" }),
      }),
      envWith(),
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe("upstream_unreachable");
  });

  it("500s upstream_error when Linear returns success:false", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ errors: [{ message: "validation failed" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const res = await worker.fetch(
      req("https://opchain.dev/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bug", title: "still broken" }),
      }),
      envWith(),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("upstream_error");
  });

  it("dry-run mode 201s with synthetic id and skips Linear", async () => {
    const res = await worker.fetch(
      req("https://staging.opchain.dev/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bug", title: "test from staging" }),
      }),
      // Dry-run wins even when LINEAR_API_KEY happens to be set.
      envWith({ FEEDBACK_DRY_RUN: "true" }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBe("STAGING-DRY-RUN");
    expect(body.dryRun).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dry-run mode does not require LINEAR_API_KEY", async () => {
    const res = await worker.fetch(
      req("https://staging.opchain.dev/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "general", title: "no key needed" }),
      }),
      envWith({ FEEDBACK_DRY_RUN: "true", LINEAR_API_KEY: undefined }),
    );
    expect(res.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dry-run mode still validates the body", async () => {
    const res = await worker.fetch(
      req("https://staging.opchain.dev/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bug" }),
      }),
      envWith({ FEEDBACK_DRY_RUN: "true" }),
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("OPTIONS preflight returns 204 with CORS headers", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/feedback", {
        method: "OPTIONS",
        headers: { Origin: "https://opchain.dev" },
      }),
      envWith(),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://opchain.dev");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("type=security", () => {
    it("prefixes the Linear title with [SECURITY] and structures the body", async () => {
      await worker.fetch(
        req("https://opchain.dev/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "security",
            title: "csrf on /api/feedback",
            severity: "high",
            component: "/api/feedback",
            reproduction: "1. open evil.example.com\n2. click button\n3. issue posts",
            impact: "any logged-in user can be tricked into posting feedback",
            email: "researcher@example.com",
          }),
        }),
        envWith(),
      );
      const [, init] = fetchMock.mock.calls[0];
      const sent = JSON.parse(init.body);
      expect(sent.variables.input.title).toBe("[SECURITY] csrf on /api/feedback");
      // Severity, component, reproduction, impact all surface as sections.
      expect(sent.variables.input.description).toContain("## Severity");
      expect(sent.variables.input.description).toContain("HIGH");
      expect(sent.variables.input.description).toContain("## Affected component");
      expect(sent.variables.input.description).toContain("/api/feedback");
      expect(sent.variables.input.description).toContain("## Reproduction");
      expect(sent.variables.input.description).toContain("## Impact");
      expect(sent.variables.input.description).toContain("opchain.dev /security disclosure form");
    });

    it("forces urgent priority for critical and high severity", async () => {
      for (const severity of ["critical", "high"]) {
        fetchMock.mockResolvedValueOnce(linearOk());
        await worker.fetch(
          req("https://opchain.dev/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "security",
              title: `severity ${severity} test`,
              severity,
              email: "r@example.com",
              // Reporter tries to mark this as no-priority — gets ignored.
              priority: 0,
            }),
          }),
          envWith(),
        );
      }
      // 2 calls; both ride severity → priority 1 (Linear urgent).
      const calls = fetchMock.mock.calls.slice(-2);
      for (const [, init] of calls) {
        const sent = JSON.parse(init.body);
        expect(sent.variables.input.priority).toBe(1);
      }
    });

    it("defaults to medium-triage priority when severity is unset", async () => {
      await worker.fetch(
        req("https://opchain.dev/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "security",
            title: "no severity submitted",
            email: "r@example.com",
          }),
        }),
        envWith(),
      );
      const [, init] = fetchMock.mock.calls[0];
      const sent = JSON.parse(init.body);
      // medium → Linear priority 2 (High).
      expect(sent.variables.input.priority).toBe(2);
    });

    it("uses LINEAR_SECURITY_LABEL_ID when set, falls back to bug label otherwise", async () => {
      // With override
      await worker.fetch(
        req("https://opchain.dev/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "security",
            title: "labelled disclosure",
            severity: "high",
            email: "r@example.com",
          }),
        }),
        envWith({ LINEAR_SECURITY_LABEL_ID: "sec-label-uuid" }),
      );
      let [, init] = fetchMock.mock.calls.at(-1);
      let sent = JSON.parse(init.body);
      expect(sent.variables.input.labelIds).toEqual(["sec-label-uuid"]);

      // Without override → falls back to LABEL_MAP.security (== bug id)
      fetchMock.mockResolvedValueOnce(linearOk());
      await worker.fetch(
        req("https://opchain.dev/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "security",
            title: "unlabelled disclosure",
            severity: "low",
            email: "r@example.com",
          }),
        }),
        envWith(),
      );
      [, init] = fetchMock.mock.calls.at(-1);
      sent = JSON.parse(init.body);
      expect(sent.variables.input.labelIds).toEqual([LABEL_MAP.security]);
    });

    it("rejects an unknown severity at the schema layer", async () => {
      const res = await worker.fetch(
        req("https://opchain.dev/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "security",
            title: "bogus severity",
            severity: "catastrophic",
            email: "r@example.com",
          }),
        }),
        envWith(),
      );
      expect(res.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
