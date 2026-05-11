/**
 * Shared data for the /compare RFC previews. Both variation A and B
 * import this file so the comparison content is identical and only
 * the chrome (column-picker UX) differs between the two previews.
 *
 * Edit cells here, refresh either preview, both pick up the change.
 */

const FEATURES = [
  { id: "prompts",     label: "Where the prompts live" },
  { id: "session",     label: "Session persistence" },
  { id: "pipeline",    label: "Pipeline awareness" },
  { id: "tri-agent",   label: "Tri-agent quality loops" },
  { id: "gates",       label: "Audit gates before deploy" },
  { id: "cost",        label: "Cost" },
  { id: "lockin",      label: "Vendor lock-in" },
  { id: "runs-on",     label: "Where it runs" },
  { id: "extend",      label: "Adding your own" },
  { id: "multi-proj",  label: "Multi-project status" },
];

const PLATFORMS = {
  opchain: {
    name: "opchain",
    accent: true, // styled with ember accent column header
    fixed: true,
    cells: {
      "prompts":    { v: "Markdown files in .claude/skills/", note: "MIT, in your repo, plain text — diffable, reviewable" },
      "session":    { v: "JSON checkpoints in .checkpoints/", note: "Survive across chats; auto-resume next session" },
      "pipeline":   { v: "Yes — orchestrator routes between 18 skills", note: "Knows what phase you're in and what's next" },
      "tri-agent":  { v: "5 skills (app-architect, code-auditor, integrations-engineer, api-dev, ux-engineer)", note: "Planner → Generator → Evaluator built in" },
      "gates":      { v: "Three (bug-check, code-auditor, security-auditor)", note: "deploy-ops blocks prod if any gate fails" },
      "cost":       { v: "Free, MIT", note: "Pay only your Claude usage" },
      "lockin":     { v: "None — every skill is one Markdown file", note: "Fork, edit, fork again" },
      "runs-on":    { v: "Claude Code · Claude.ai · Claude Desktop", note: null },
      "extend":     { v: "Write a SKILL.md, drop it in .claude/skills/", note: "reverse-spec backfills one from existing code" },
      "multi-proj": { v: "/ops command shows every project's last checkpoint", note: "Cross-repo dashboard built in" },
    },
  },

  claude: {
    name: "Claude defaults",
    fixed: true,
    cells: {
      "prompts":    { v: "CLAUDE.md (single file)", note: "All-or-nothing" },
      "session":    { v: "Single CLAUDE.md context", note: "Re-read on every session" },
      "pipeline":   { v: "No", note: null },
      "tri-agent":  { v: "No", note: null },
      "gates":      { v: "No", note: null },
      "cost":       { v: "Free", note: null },
      "lockin":     { v: "Claude-coupled", note: "But trivial to migrate" },
      "runs-on":    { v: "Anywhere Claude runs", note: null },
      "extend":     { v: "Edit CLAUDE.md", note: null },
      "multi-proj": { v: "No", note: null },
    },
  },

  cursor: {
    name: "Cursor",
    cells: {
      "prompts":    { v: ".cursorrules / .mdc rules", note: "Per-project, editor-coupled" },
      "session":    { v: "Per-chat memory; no formal protocol", note: null },
      "pipeline":   { v: "No — rules apply globally", note: null },
      "tri-agent":  { v: "No", note: null },
      "gates":      { v: "No", note: null },
      "cost":       { v: "$20–40 / user / mo", note: null },
      "lockin":     { v: "IDE-coupled", note: "Rules only run inside Cursor" },
      "runs-on":    { v: "Cursor IDE", note: null },
      "extend":     { v: "Write a .cursorrules file", note: null },
      "multi-proj": { v: "No", note: null },
    },
  },

  copilot: {
    name: "GH Copilot",
    cells: {
      "prompts":    { v: ".github/copilot-instructions.md + hosted instructions", note: "Vendor-managed" },
      "session":    { v: "Per-IDE-session", note: null },
      "pipeline":   { v: "No — chat is single-turn-ish", note: null },
      "tri-agent":  { v: "No", note: null },
      "gates":      { v: "No", note: null },
      "cost":       { v: "$10–39 / user / mo", note: null },
      "lockin":     { v: "GitHub-coupled", note: "Runs against the Copilot service" },
      "runs-on":    { v: "VS Code · JetBrains · GitHub.com", note: null },
      "extend":     { v: "Edit copilot-instructions.md", note: null },
      "multi-proj": { v: "No", note: null },
    },
  },

  devin: {
    name: "Devin",
    cells: {
      "prompts":    { v: "Hosted, internal", note: "Black box" },
      "session":    { v: "Hosted task state", note: "Tied to a Devin task, not your repo" },
      "pipeline":   { v: "Yes, but as one monolithic agent", note: null },
      "tri-agent":  { v: "Implicit", note: "Not surfaced as a contract" },
      "gates":      { v: "Internal checks", note: "No external contract" },
      "cost":       { v: "$500 / mo seat (last published)", note: null },
      "lockin":     { v: "Service-coupled", note: "All work runs on Devin infra" },
      "runs-on":    { v: "Devin web UI", note: null },
      "extend":     { v: "Limited", note: "Custom playbooks in Beta" },
      "multi-proj": { v: "Per-task dashboard", note: "Devin-hosted" },
    },
  },

  zed: {
    name: "Zed",
    cells: {
      "prompts":    { v: ".zed/settings.json + Agent Profiles", note: "Project + per-profile system prompts" },
      "session":    { v: "Persistent assistant panel per workspace; no cross-session protocol", note: null },
      "pipeline":   { v: "No — single agent, no pipeline concept", note: null },
      "tri-agent":  { v: "Agent profiles can chain", note: "Manual setup; not a contract" },
      "gates":      { v: "No", note: null },
      "cost":       { v: "Editor free · Zed Pro $20/mo or BYOK", note: "AI usage gated; editor is fully free" },
      "lockin":     { v: "Editor-coupled", note: "Profiles only run inside Zed" },
      "runs-on":    { v: "Zed editor (Mac · Linux · Windows beta)", note: null },
      "extend":     { v: "Add an Agent Profile or edit .zed/settings.json", note: null },
      "multi-proj": { v: "No", note: null },
    },
  },

  vscode: {
    name: "VS Code",
    cells: {
      "prompts":    { v: "Per-extension (Copilot / Continue / Cline)", note: "Whatever your AI extension wants" },
      "session":    { v: "Per extension; usually per-IDE-session", note: null },
      "pipeline":   { v: "No — depends entirely on extension", note: null },
      "tri-agent":  { v: "No", note: null },
      "gates":      { v: "No", note: null },
      "cost":       { v: "Editor free · extension pricing varies", note: "Copilot, Continue, Cline each priced separately" },
      "lockin":     { v: "Extension-coupled", note: "Tied to whichever AI extension you use" },
      "runs-on":    { v: "VS Code (Mac · Linux · Windows · Web)", note: null },
      "extend":     { v: "Configure your extension's prompt or rules file", note: null },
      "multi-proj": { v: "No", note: null },
    },
  },

  codex: {
    name: "OpenAI Codex",
    cells: {
      "prompts":    { v: "AGENTS.md in repo + ChatGPT custom instructions", note: "Per-repo; vendor model controls behaviour" },
      "session":    { v: "Per-task cloud session + ChatGPT memory", note: "No formal cross-task protocol" },
      "pipeline":   { v: "No — single autonomous reasoning loop", note: null },
      "tri-agent":  { v: "No (single-agent)", note: null },
      "gates":      { v: "No", note: null },
      "cost":       { v: "Bundled with ChatGPT Plus/Pro ($20–200/mo)", note: "CLI free with API usage" },
      "lockin":     { v: "OpenAI-coupled", note: "GPT-5/4 only; no model swap" },
      "runs-on":    { v: "chatgpt.com/codex · codex CLI · IDE extension", note: null },
      "extend":     { v: "Edit AGENTS.md or ChatGPT instructions", note: null },
      "multi-proj": { v: "Per-project; no cross-repo dashboard", note: null },
    },
  },

  antigravity: {
    name: "Google Antigravity",
    needsReview: true, // surfaces a review-needed badge in the column header
    cells: {
      "prompts":    { v: "Workspace instructions + Knowledge files", note: "Cross-session memory via Knowledge" },
      "session":    { v: "Knowledge persists; agent state per workspace", note: null },
      "pipeline":   { v: "Multi-agent — Editor + Manager dispatch parallel agents", note: "Coordinated, but not a phase pipeline" },
      "tri-agent":  { v: "Yes — Manager dispatches and verifies via screenshot/recording", note: null },
      "gates":      { v: "Built-in verification (browser proof / screenshot)", note: null },
      "cost":       { v: "Free tier · paid tiers announced", note: null },
      "lockin":     { v: "Google-coupled", note: "Gemini-first; Claude / GPT-OSS optional" },
      "runs-on":    { v: "Antigravity desktop app (Mac · Linux · Windows)", note: null },
      "extend":     { v: "Add Knowledge files or workspace settings", note: null },
      "multi-proj": { v: "Manager view shows every running workspace", note: null },
    },
  },
};

// Fixed columns always render in this order on the left.
const FIXED_ORDER = ["opchain", "claude"];

// Selectable platforms, in dropdown / chip-tray display order.
const SELECTABLE = ["cursor", "copilot", "devin", "zed", "vscode", "codex", "antigravity"];

// Maximum number of user-added comparison columns. With 2 fixed columns,
// 4 added = 6 total — fits side-by-side on a 1280px viewport without
// horizontal scroll.
const MAX_ADDED = 4;

// Export to global scope (no module bundler in this static preview).
window.COMPARE_DATA = { FEATURES, PLATFORMS, FIXED_ORDER, SELECTABLE, MAX_ADDED };
