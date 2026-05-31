import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const REPO_ROOT  = path.resolve(__dirname, "..");
const SCRIPT     = path.join(REPO_ROOT, "scripts", "gen-roadmap.mjs");
const OUT_PATH   = path.join(REPO_ROOT, "site", "src", "data", "roadmap.json");

// Run gen-roadmap.mjs as a subprocess with a controlled env + (optionally) a
// shim that intercepts `fetch` to api.linear.app. The shim is loaded via
// NODE_OPTIONS=--import=<file> and writes its planned response into the JS
// itself, so each test gets a fresh interpreter and no shared state.
function runScript({ env = {}, fetchImpl = null } = {}) {
  let importFlag = [];
  let shimPath = null;
  if (fetchImpl) {
    shimPath = path.join(REPO_ROOT, "node_modules", `.gen-roadmap-shim-${Date.now()}-${Math.random()}.mjs`);
    fs.writeFileSync(
      shimPath,
      `globalThis.fetch = ${fetchImpl};\n`,
      "utf8",
    );
    importFlag = ["--import", shimPath];
  }

  // Snapshot + restore OUT_PATH so a real prebuild on the host doesn't
  // bleed into the test outcome.
  const had = fs.existsSync(OUT_PATH);
  const snapshot = had ? fs.readFileSync(OUT_PATH, "utf8") : null;

  let result;
  try {
    result = spawnSync(
      "node",
      [...importFlag, SCRIPT],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, ...env, LINEAR_API_KEY: env.LINEAR_API_KEY ?? "" },
        encoding: "utf8",
      },
    );
  } finally {
    if (shimPath) {
      try { fs.unlinkSync(shimPath); } catch { /* best-effort */ }
    }
  }

  const written = fs.existsSync(OUT_PATH) ? JSON.parse(fs.readFileSync(OUT_PATH, "utf8")) : null;

  // Restore the pre-test state of OUT_PATH so later tests / the host
  // checkout aren't disturbed.
  if (had) {
    fs.writeFileSync(OUT_PATH, snapshot);
  } else if (fs.existsSync(OUT_PATH)) {
    fs.unlinkSync(OUT_PATH);
  }

  return { status: result.status, stdout: result.stdout, stderr: result.stderr, written };
}

describe("scripts/gen-roadmap.mjs — graceful (default) mode", () => {
  it("exits 0 with an empty roadmap when LINEAR_API_KEY is missing", () => {
    const { status, stdout, written } = runScript({ env: {} });
    expect(status).toBe(0);
    expect(stdout).toMatch(/no LINEAR_API_KEY/);
    expect(written.items.shipped).toEqual([]);
    expect(written.note).toBeNull();
  });

  it("exits 0 with an empty roadmap when the Linear fetch errors", () => {
    const { status, stderr, written } = runScript({
      env: { LINEAR_API_KEY: "stale" },
      fetchImpl: `async () => new Response("unauthorized", { status: 401 })`,
    });
    expect(status).toBe(0);
    expect(stderr).toMatch(/Linear fetch failed/);
    expect(written.note).toMatch(/Linear fetch failed/);
    expect(written.items.shipped).toEqual([]);
  });

  it("exits 0 when Linear returns zero issues", () => {
    const { status, stdout, written } = runScript({
      env: { LINEAR_API_KEY: "valid" },
      fetchImpl: `async () => new Response(JSON.stringify({ data: { issues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } }), { status: 200, headers: { "Content-Type": "application/json" } })`,
    });
    expect(status).toBe(0);
    expect(stdout).toMatch(/wrote 0 items/);
    expect(written.items.shipped).toEqual([]);
  });
});

describe("scripts/gen-roadmap.mjs — strict mode (OPCHAIN_REQUIRE_LINEAR=1)", () => {
  it("exits 1 when LINEAR_API_KEY is missing", () => {
    const { status, stderr } = runScript({
      env: { OPCHAIN_REQUIRE_LINEAR: "1" },
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/LINEAR_API_KEY is missing/);
  });

  it("exits 1 when the Linear fetch errors", () => {
    const { status, stderr } = runScript({
      env: { OPCHAIN_REQUIRE_LINEAR: "1", LINEAR_API_KEY: "stale" },
      fetchImpl: `async () => new Response("unauthorized", { status: 401 })`,
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/Linear fetch failed/);
    expect(stderr).toMatch(/LINEAR_API_KEY.*invalid|expired/i);
  });

  it("exits 1 when Linear returns zero issues (catches the May 2026 prod bug)", () => {
    const { status, stderr } = runScript({
      env: { OPCHAIN_REQUIRE_LINEAR: "1", LINEAR_API_KEY: "valid" },
      fetchImpl: `async () => new Response(JSON.stringify({ data: { issues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } }), { status: 200, headers: { "Content-Type": "application/json" } })`,
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/0 Linear issues match.*roadmap-visible/);
  });

  it("exits 0 and writes the payload when Linear returns issues", () => {
    const node = JSON.stringify({
      identifier: "ADEV-330",
      title: "Test issue",
      description: "First line\nSecond line",
      url: "https://linear.app/x/issue/ADEV-330",
      state: { name: "Done", type: "completed" },
      labels: { nodes: [{ name: "roadmap-visible" }] },
      projectMilestone: { name: "v1.4", sortOrder: 1, targetDate: "2026-05-12" },
      priority: 2,
      createdAt: "2026-05-01T00:00:00Z",
      updatedAt: "2026-05-12T00:00:00Z",
    });
    const { status, stdout, written } = runScript({
      env: { OPCHAIN_REQUIRE_LINEAR: "1", LINEAR_API_KEY: "valid" },
      fetchImpl: `async () => new Response(JSON.stringify({ data: { issues: { nodes: [${node}], pageInfo: { hasNextPage: false, endCursor: null } } } }), { status: 200, headers: { "Content-Type": "application/json" } })`,
    });
    expect(status).toBe(0);
    expect(stdout).toMatch(/wrote 1 items/);
    expect(written.items.shipped).toHaveLength(1);
    expect(written.items.shipped[0].id).toBe("ADEV-330");
    expect(written.items.shipped[0].bucket).toBe("shipped");
    expect(written.items.shipped[0].milestone).toBe("v1.4");
  });
});
