import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Guardrail tests for scripts/smoke.sh. The smoke script gates every deploy
// (staging post-push, prod post-promote). A regression where it silently
// accepts a broken response wedges the whole release pipeline, so the shape
// of its checks needs explicit coverage.
//
// Each case boots a throwaway HTTP server that fakes the endpoints smoke
// hits (/, /api/health, /opchain-skills.zip) and asserts the script's exit
// code against the expected pass/fail.

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SMOKE = join(ROOT, "scripts", "smoke.sh");

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "strict-transport-security": "max-age=63072000",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=()",
  "content-security-policy": "default-src 'self'",
};

function makeServer(handlers) {
  return new Promise((resolve) => {
    const hits = [];
    const server = createServer((req, res) => {
      hits.push(`${req.method} ${req.url}`);
      const handler = handlers[req.url];
      if (!handler) {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("no handler");
        return;
      }
      handler(req, res);
    });
    server.on("error", (err) => console.error("server error:", err));
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}`, hits });
    });
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function runSmoke(url) {
  // Must be async spawn — a sync spawn blocks the Node event loop, which
  // starves the in-process HTTP server we're pointing the script at, and
  // every curl inside bash times out.
  return new Promise((resolve) => {
    const child = spawn("bash", [SMOKE], {
      env: {
        ...process.env,
        DEPLOY_URL: url,
        // Collapse the retry schedule so failing cases don't pay 15s per check.
        // 2 immediate retries (no sleep) absorb transient in-process-server
        // timing blips without slowing the suite. Production CI retains the
        // 5×3s default (smoke.sh:22-23).
        SMOKE_RETRIES: "2",
        SMOKE_RETRY_SLEEP: "0",
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
}

function goodHomepage(_req, res) {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    ...SECURITY_HEADERS,
  });
  res.end("<!DOCTYPE html><html><body>ok</body></html>");
}

function goodHealth(_req, res) {
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ ok: true, version: "test" }));
}

function goodZip(_req, res) {
  res.writeHead(200, { "content-type": "application/zip" });
  res.end("PK\x03\x04");
}

function goodSkillRedirect(_req, res) {
  // Old (pre-oc-) skill URL 301s to the prefixed path; relative Location is
  // resolved by curl's %{redirect_url} against the request origin.
  res.writeHead(301, { location: "/skills/oc-code-auditor" });
  res.end();
}

let active;

afterEach(async () => {
  if (active) {
    await stopServer(active.server);
    active = null;
  }
});

describe("scripts/smoke.sh", () => {
  it("passes when homepage is 200 text/html, health is JSON{ok:true}, zip is reachable, and security headers are present", async () => {
    active = await makeServer({
      "/": goodHomepage,
      "/api/health": goodHealth,
      "/opchain-skills.zip": goodZip,
      "/skills/code-auditor": goodSkillRedirect,
    });
    const result = await runSmoke(active.url);
    expect(
      result.status,
      `expected smoke to pass.\nhits: ${JSON.stringify(active.hits)}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    ).toBe(0);
    expect(result.stdout).toMatch(/all checks passed/);
  });

  it("fails when the homepage returns 200 but content-type is application/octet-stream (the 'browser downloads a file' bug)", async () => {
    active = await makeServer({
      "/": (_req, res) => {
        res.writeHead(200, {
          "content-type": "application/octet-stream",
          ...SECURITY_HEADERS,
        });
        res.end("<!DOCTYPE html><html><body>ok</body></html>");
      },
      "/api/health": goodHealth,
      "/opchain-skills.zip": goodZip,
      "/skills/code-auditor": goodSkillRedirect,
    });
    const result = await runSmoke(active.url);
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/homepage failed/);
  });

  it("fails when /api/health returns 200+{ok:true} but with the wrong content-type", async () => {
    active = await makeServer({
      "/": goodHomepage,
      "/api/health": (_req, res) => {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end('{"ok":true}');
      },
      "/opchain-skills.zip": goodZip,
      "/skills/code-auditor": goodSkillRedirect,
    });
    const result = await runSmoke(active.url);
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/health check failed/);
  });

  it("fails when the homepage is missing security headers", async () => {
    active = await makeServer({
      "/": (_req, res) => {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end("<!DOCTYPE html><html><body>ok</body></html>");
      },
      "/api/health": goodHealth,
      "/opchain-skills.zip": goodZip,
      "/skills/code-auditor": goodSkillRedirect,
    });
    const result = await runSmoke(active.url);
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/security headers missing/);
  });
});
