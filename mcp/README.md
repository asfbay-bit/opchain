# opchain MCP server

Run the whole opchain pipeline from **Codex** — or any MCP-aware agent (Claude
Desktop, Cursor, Windsurf, …) — over the [Model Context Protocol][mcp].

Claude Code auto-discovers opchain's `SKILL.md` files and triggers them on their
`description`. Other agents don't, so this server hands them the same thing
Claude Code gets natively: the skill catalog, intent routing, the shared
orchestrator protocol, and cross-session checkpoints.

> Already on **Claude Code**? You don't need this — drop `skills/` into
> `.claude/skills/`. The MCP server is for everything else.

## Two ways to run it

### 1. Hosted (recommended) — `https://opchain.dev/mcp`

Nothing to install. Point your client at the URL. For Codex
(`~/.codex/config.toml`):

```toml
[mcp_servers.opchain]
url = "https://opchain.dev/mcp"
```

Streamable HTTP, JSON-RPC over a single `POST`. Skill bodies stream from the
site's published docs; checkpoints persist server-side, scoped per `sessionId`.

### 2. Local (offline / air-gapped) — stdio

Reads the skill tree from disk; no network. Checkpoints are in memory for the
life of the process.

```toml
[mcp_servers.opchain]
command = "node"
args = ["/abs/path/to/opchain/mcp/local-server.mjs"]
# env = { OPCHAIN_SKILLS_DIR = "/abs/path/to/skills" }   # optional
```

## What it exposes

**Tools**

| Tool | Purpose |
|---|---|
| `list_skills` | The full concept→ship catalog (id, description, phases, commands). |
| `route` | Map an `/oc-*` command or a plain request to the skill + entry phase. |
| `get_skill` | The full `SKILL.md` for one skill — load it, then follow it. |
| `get_orchestrator` | The shared welcome / pipeline-map / chaining protocol. Read once per session. |
| `read_checkpoint` / `write_checkpoint` | Resume and persist progress across sessions. |

**Prompts** — one per `/oc-*` command (`/oc-discover`, `/oc-audit`, `/oc-release`,
…). Clients that surface MCP prompts as slash commands get the `/oc-*` experience
back; selecting one loads the owning skill and runs its flow.

**Resources** — `opchain://orchestrator` and `opchain://skill/<id>` for clients
that prefer reading resources over calling tools.

## How an agent uses it

1. Call `get_orchestrator` once to learn the pipeline and chaining rules.
2. Call `route("build me an app")` (or `list_skills`) to pick a skill.
3. Call `get_skill("oc-app-architect")` and follow the instructions.
4. `write_checkpoint` / `read_checkpoint` to carry state across sessions.

## Notes

- The catalog is generated from `skills/` by `scripts/gen-mcp-catalog.mjs`
  (`src/generated/mcp-catalog.json`) — the same `skills/` source of truth the
  Claude Code skills ship from. One catalog, every transport.
- The hosted endpoint is gated by the `site.ops.api-mcp.kill` flag for incident
  pauses; a paused server answers `503`.

[mcp]: https://modelcontextprotocol.io
