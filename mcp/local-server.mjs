#!/usr/bin/env node
// opchain MCP server — local stdio transport.
//
// Wraps the same transport-agnostic core (src/lib/mcp/server.js) the Cloudflare
// Worker serves at https://opchain.dev/mcp, but speaks newline-delimited
// JSON-RPC over stdio and reads the skill catalog + bodies straight from disk.
// This is the offline / air-gapped alternative to the hosted endpoint.
//
// Register with Codex (~/.codex/config.toml):
//
//   [mcp_servers.opchain]
//   command = "node"
//   args = ["/abs/path/to/opchain/mcp/local-server.mjs"]
//   # env = { OPCHAIN_SKILLS_DIR = "/abs/path/to/skills" }   # optional override
//
// Checkpoints are held in memory for the life of the process (the hosted
// endpoint persists them in KV), so a restart starts fresh. Set
// OPCHAIN_SKILLS_DIR to point at any skills/ tree; defaults to this repo's.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { buildCatalog } from "../scripts/gen-mcp-catalog.mjs";
import { createMcpServer } from "../src/lib/mcp/server.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = process.env.OPCHAIN_SKILLS_DIR || join(ROOT, "skills");

function serverVersion() {
  // Mirror build.mjs: git short SHA, falling back to "dev" outside a repo.
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8" }).trim() || "dev";
  } catch {
    return "dev";
  }
}

const checkpoints = new Map();
const server = createMcpServer({
  catalog: buildCatalog(SKILLS_DIR),
  serverVersion: serverVersion(),
  loadBody: async (id) => {
    const p = join(SKILLS_DIR, id, "SKILL.md");
    return existsSync(p) ? readFileSync(p, "utf8") : null;
  },
  checkpoints: {
    async read(skill, session) { return checkpoints.get(`${session}:${skill}`) ?? null; },
    async write(skill, session, data) { checkpoints.set(`${session}:${skill}`, data); },
  },
});

function write(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

const rl = createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }
  // Single message or JSON-RPC batch — mirror the Worker transport.
  if (Array.isArray(message)) {
    const responses = (await Promise.all(message.map((m) => server.handle(m)))).filter((r) => r !== null);
    if (responses.length) write(responses);
    return;
  }
  const response = await server.handle(message);
  if (response !== null) write(response);
});
