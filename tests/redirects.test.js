import { describe, expect, it } from "vitest";
import worker from "../src/index.js";

function makeEnv() {
  return {
    LINEAR_API_KEY: "test",
    ASSETS: { async fetch() { return new Response("", { status: 200 }); } },
  };
}

describe("legacy .html redirects", () => {
  it("301s /index.html to /", async () => {
    const res = await worker.fetch(new Request("https://opchain.dev/index.html"), makeEnv());
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://opchain.dev/");
  });

  it("301s /install.html to /install", async () => {
    const res = await worker.fetch(new Request("https://opchain.dev/install.html"), makeEnv());
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://opchain.dev/install");
  });

  it("301s /skills.html to /skills", async () => {
    const res = await worker.fetch(new Request("https://opchain.dev/skills.html"), makeEnv());
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://opchain.dev/skills");
  });

  it("301s /architecture.html to /architecture", async () => {
    const res = await worker.fetch(new Request("https://opchain.dev/architecture.html"), makeEnv());
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://opchain.dev/architecture");
  });

  it("301s /tryit.html to /demo (Try-It chat removed)", async () => {
    const res = await worker.fetch(new Request("https://opchain.dev/tryit.html"), makeEnv());
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://opchain.dev/demo");
  });

  it("preserves query string when redirecting /tryit.html?skill= to /demo?skill=", async () => {
    const res = await worker.fetch(
      new Request("https://opchain.dev/tryit.html?skill=code-auditor"),
      makeEnv(),
    );
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(
      "https://opchain.dev/demo?skill=code-auditor",
    );
  });

  it("POST is not redirected (only GET)", async () => {
    const res = await worker.fetch(
      new Request("https://opchain.dev/tryit.html", { method: "POST" }),
      makeEnv(),
    );
    // POST falls through to ASSETS, which returns 200 from our mock.
    expect(res.status).not.toBe(301);
  });
});

describe("demo route consolidation", () => {
  it("301s /in-action to /demo", async () => {
    const res = await worker.fetch(new Request("https://opchain.dev/in-action"), makeEnv());
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://opchain.dev/demo");
  });

  it("301s /tryit to /demo (Try-It chat removed)", async () => {
    const res = await worker.fetch(new Request("https://opchain.dev/tryit"), makeEnv());
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://opchain.dev/demo");
  });

  it("preserves ?skill= when redirecting /tryit to /demo", async () => {
    const res = await worker.fetch(
      new Request("https://opchain.dev/tryit?skill=code-auditor"),
      makeEnv(),
    );
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(
      "https://opchain.dev/demo?skill=code-auditor",
    );
  });
});
