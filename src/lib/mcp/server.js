// opchain MCP server — transport-agnostic core.
//
// Implements the Model Context Protocol over plain JSON-RPC 2.0 so it runs
// anywhere: the Cloudflare Worker wraps it behind POST /mcp (streamable HTTP),
// and mcp/local-server.mjs wraps it over stdio. No SDK dependency — the repo's
// only runtime dep is zod, and MCP is small enough to implement directly.
//
// What it exposes (so Codex / any MCP client gets the full opchain pipeline the
// way Claude Code's native skill auto-discovery does):
//   • tools     — list_skills, route, get_skill, get_orchestrator,
//                 read_checkpoint, write_checkpoint
//   • prompts   — one per /oc-* command, so the slash-command UX survives on
//                 clients that surface MCP prompts as slash commands
//   • resources — opchain://orchestrator + opchain://skill/<id>
//
// The server is a pure function of its injected providers (catalog, loadBody,
// checkpoints) so it is trivially unit-testable with fixtures.

import { route } from "./routing.js";

const JSONRPC = "2.0";
const PROTOCOL_VERSION = "2025-06-18";

// JSON-RPC 2.0 error codes.
export const ERR = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
};

const SESSION_RE = /^[A-Za-z0-9_.-]{1,128}$/;

function ok(id, result) {
  return { jsonrpc: JSONRPC, id, result };
}
function err(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: JSONRPC, id: id ?? null, error };
}
function textResult(text, isError = false) {
  const res = { content: [{ type: "text", text }] };
  if (isError) res.isError = true;
  return res;
}
function jsonText(value) {
  return textResult(JSON.stringify(value, null, 2));
}

/** Convert a skill's /oc-* commands into MCP prompt names (deduped, sorted). */
function promptCatalog(catalog) {
  const prompts = new Map(); // name → { skill, command }
  for (const skill of catalog.skills ?? []) {
    for (const cmd of skill.commands ?? []) {
      const command = String(cmd).trim();
      const name = command.replace(/^\//, "").split(/\s+/)[0];
      if (name && !prompts.has(name)) prompts.set(name, { skill: skill.id, command: `/${name}` });
    }
  }
  return prompts;
}

/**
 * @param {object} opts
 * @param {{skills: Array, orchestrator: string}} opts.catalog
 * @param {(id: string) => Promise<string|null>} [opts.loadBody] - returns a skill's SKILL.md
 * @param {{ read(skill,session): Promise<any>, write(skill,session,data): Promise<void> }} [opts.checkpoints]
 * @param {string} [opts.serverVersion]
 */
export function createMcpServer({ catalog, loadBody, checkpoints, serverVersion = "dev" } = {}) {
  if (!catalog || !Array.isArray(catalog.skills)) {
    throw new Error("createMcpServer: catalog.skills is required");
  }
  const skillIds = new Set(catalog.skills.map((s) => s.id));
  const prompts = promptCatalog(catalog);

  const tools = [
    {
      name: "list_skills",
      description:
        "List every opchain skill (id, displayName, description, phases, commands). Call this first to see the concept→ship pipeline.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "route",
      description:
        "Map a request or an /oc-* command to the skill that should handle it, with the entry phase. Use when you're unsure which skill fits.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "An /oc-* command (e.g. /oc-discover) or a natural-language request (e.g. 'build me an app').",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "get_skill",
      description:
        "Return the full SKILL.md (the instructions) for one skill id. Load it, then follow it. Read get_orchestrator once before your first get_skill in a session.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Skill id, e.g. oc-app-architect." } },
        required: ["id"],
        additionalProperties: false,
      },
    },
    {
      name: "get_orchestrator",
      description:
        "Return the shared orchestrator protocol (welcome flow, pipeline map, active-chaining rules). Read once at the start of a session.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "read_checkpoint",
      description:
        "Read a skill's saved session checkpoint (where you left off). sessionId scopes state to one project/conversation.",
      inputSchema: {
        type: "object",
        properties: {
          skill: { type: "string" },
          sessionId: { type: "string", description: "Stable id for the project/conversation. Defaults to 'default'." },
        },
        required: ["skill"],
        additionalProperties: false,
      },
    },
    {
      name: "write_checkpoint",
      description:
        "Persist a skill's session checkpoint so progress survives across sessions, per the opchain checkpoint protocol.",
      inputSchema: {
        type: "object",
        properties: {
          skill: { type: "string" },
          sessionId: { type: "string", description: "Stable id for the project/conversation. Defaults to 'default'." },
          checkpoint: { type: "object", description: "The checkpoint JSON to store (skill_state, next_actions, etc.)." },
        },
        required: ["skill", "checkpoint"],
        additionalProperties: false,
      },
    },
  ];

  function listResources() {
    const out = [
      {
        uri: "opchain://orchestrator",
        name: "opchain orchestrator protocol",
        mimeType: "text/markdown",
        description: "Shared welcome flow, pipeline map, and active-chaining rules read by every skill.",
      },
    ];
    for (const s of catalog.skills) {
      out.push({
        uri: `opchain://skill/${s.id}`,
        name: s.displayName || s.id,
        mimeType: "text/markdown",
        description: s.shortDesc || s.description?.slice(0, 140) || s.id,
      });
    }
    return out;
  }

  async function callTool(name, args) {
    const a = args && typeof args === "object" ? args : {};
    switch (name) {
      case "list_skills":
        return jsonText({
          skills: catalog.skills.map((s) => ({
            id: s.id,
            displayName: s.displayName,
            shortDesc: s.shortDesc,
            description: s.description,
            phases: s.phases,
            triAgent: s.triAgent,
            commands: s.commands,
          })),
        });

      case "route": {
        if (typeof a.query !== "string" || !a.query.trim()) {
          return textResult("route requires a non-empty `query` string.", true);
        }
        return jsonText(route(a.query, catalog));
      }

      case "get_skill": {
        const id = String(a.id ?? "");
        if (!skillIds.has(id)) {
          return textResult(`Unknown skill '${id}'. Call list_skills to see valid ids.`, true);
        }
        if (typeof loadBody !== "function") {
          return textResult("Skill bodies are not available on this transport.", true);
        }
        const body = await loadBody(id);
        if (!body) return textResult(`Could not load SKILL.md for '${id}'.`, true);
        return textResult(body);
      }

      case "get_orchestrator":
        return textResult(catalog.orchestrator || "(orchestrator protocol unavailable)");

      case "read_checkpoint": {
        if (!checkpoints) return textResult("Checkpoint storage is not configured on this transport.", true);
        const skill = String(a.skill ?? "");
        if (!skill) return textResult("read_checkpoint requires `skill`.", true);
        const session = sanitizeSession(a.sessionId);
        const data = await checkpoints.read(skill, session);
        return jsonText({ skill, sessionId: session, checkpoint: data ?? null });
      }

      case "write_checkpoint": {
        if (!checkpoints) return textResult("Checkpoint storage is not configured on this transport.", true);
        const skill = String(a.skill ?? "");
        if (!skill) return textResult("write_checkpoint requires `skill`.", true);
        if (!a.checkpoint || typeof a.checkpoint !== "object") {
          return textResult("write_checkpoint requires a `checkpoint` object.", true);
        }
        const session = sanitizeSession(a.sessionId);
        await checkpoints.write(skill, session, a.checkpoint);
        return jsonText({ ok: true, skill, sessionId: session });
      }

      default:
        return null; // signals method-not-found at the dispatch layer
    }
  }

  function getPrompt(name, args) {
    const entry = prompts.get(name);
    if (!entry) return null;
    const extra = args && typeof args.args === "string" && args.args.trim() ? `\n\nUser context: ${args.args.trim()}` : "";
    const text =
      `You are operating the opchain pipeline over MCP. To handle ${entry.command}:\n` +
      `1. If you haven't yet this session, call the get_orchestrator tool and follow its welcome + chaining rules.\n` +
      `2. Call get_skill with id "${entry.skill}" and follow its SKILL.md for the ${entry.command} flow.\n` +
      `3. Use read_checkpoint/write_checkpoint("${entry.skill}") to resume and persist progress.${extra}`;
    return {
      description: `Run the opchain ${entry.command} flow (${entry.skill}).`,
      messages: [{ role: "user", content: { type: "text", text } }],
    };
  }

  async function dispatch(method, params, id) {
    switch (method) {
      case "initialize":
        return ok(id, {
          protocolVersion:
            typeof params?.protocolVersion === "string" ? params.protocolVersion : PROTOCOL_VERSION,
          capabilities: { tools: {}, prompts: {}, resources: {} },
          serverInfo: { name: "opchain", version: serverVersion },
          instructions:
            "opchain is a concept→spec→design→build→ship pipeline of skills. " +
            "On any /oc-* command, or any request to build, spec, design, audit, deploy, or ship " +
            "software, FIRST call route (or get_skill) to pick the skill, read get_orchestrator once " +
            "per session, then load the skill's SKILL.md with get_skill and follow it verbatim. " +
            "Use read_checkpoint/write_checkpoint to resume and persist progress across sessions. " +
            "Note: /oc-* commands are also exposed as MCP prompts for clients that support them; " +
            "clients that don't (e.g. Codex) should drive everything through these tools.",
        });

      case "ping":
        return ok(id, {});

      case "tools/list":
        return ok(id, { tools });

      case "tools/call": {
        const name = params?.name;
        if (typeof name !== "string") return err(id, ERR.INVALID_PARAMS, "tools/call requires a tool name");
        const result = await callTool(name, params?.arguments);
        if (result === null) return err(id, ERR.INVALID_PARAMS, `Unknown tool '${name}'`);
        return ok(id, result);
      }

      case "prompts/list":
        return ok(id, {
          prompts: [...prompts.keys()].sort().map((name) => ({
            name,
            description: `Run the opchain /${name} flow (${prompts.get(name).skill}).`,
            arguments: [
              { name: "args", description: "Optional extra context to pass into the flow.", required: false },
            ],
          })),
        });

      case "prompts/get": {
        const name = params?.name;
        if (typeof name !== "string") return err(id, ERR.INVALID_PARAMS, "prompts/get requires a name");
        const prompt = getPrompt(name, params?.arguments);
        if (!prompt) return err(id, ERR.INVALID_PARAMS, `Unknown prompt '${name}'`);
        return ok(id, prompt);
      }

      case "resources/list":
        return ok(id, { resources: listResources() });

      case "resources/read": {
        const uri = params?.uri;
        if (typeof uri !== "string") return err(id, ERR.INVALID_PARAMS, "resources/read requires a uri");
        if (uri === "opchain://orchestrator") {
          return ok(id, { contents: [{ uri, mimeType: "text/markdown", text: catalog.orchestrator || "" }] });
        }
        const m = uri.match(/^opchain:\/\/skill\/([a-z0-9-]+)$/);
        if (m && skillIds.has(m[1]) && typeof loadBody === "function") {
          const body = await loadBody(m[1]);
          if (body) return ok(id, { contents: [{ uri, mimeType: "text/markdown", text: body }] });
        }
        return err(id, ERR.INVALID_PARAMS, `Unknown or unavailable resource '${uri}'`);
      }

      default:
        return err(id, ERR.METHOD_NOT_FOUND, `Unknown method '${method}'`);
    }
  }

  /**
   * Handle one parsed JSON-RPC message. Returns a response object, or null for
   * notifications (requests without an id) which get no reply per JSON-RPC.
   */
  async function handle(message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return err(null, ERR.INVALID_REQUEST, "Invalid Request");
    }
    if (message.jsonrpc !== JSONRPC || typeof message.method !== "string") {
      return err(message.id ?? null, ERR.INVALID_REQUEST, "Invalid Request");
    }
    const isNotification = !("id" in message);
    try {
      const response = await dispatch(message.method, message.params, message.id);
      return isNotification ? null : response;
    } catch (e) {
      return isNotification ? null : err(message.id ?? null, ERR.INTERNAL, e?.message || "Internal error");
    }
  }

  return { handle, tools, listResources };
}

function sanitizeSession(value) {
  const s = String(value ?? "default");
  return SESSION_RE.test(s) ? s : "default";
}
