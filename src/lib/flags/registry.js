/**
 * Feature-flag registry — the single source of truth for every flag that
 * exists in opchain. PostHog stores the *runtime* value; this file stores the
 * *contract* (name, default, type, owner, category, description). Any new
 * flag must land here first so it has a typed name, a safe default for
 * fail-closed eval, and an owner the next person can ask about it.
 *
 * Hierarchy (dot-namespaced):
 *
 *   site.ui.<feature>            UI surface toggles
 *   site.feature.<feature>       Page / widget on-off
 *   site.experiment.<id>         A/B-style experiments
 *   site.ops.<route>.kill        Kill switches (default false → off-state means "off")
 *   site.consent.<feature>       Consent / privacy controls
 *
 *   skills.registry.<id>.enabled Show / hide an individual skill in the catalog
 *   skills.capability.<name>     Cross-cutting capability (tri-agent, checkpoint)
 *   skills.command.<cmd>.enabled Individual slash command on/off
 *   skills.coverage.<id>.enabled Show / hide a oc-stack-forge pack (language, framework, mobile)
 *   skills.experiment.<id>.<f>   Experimental skill features
 *
 *   platform.observability.<sink>
 *   platform.security.<control>
 *
 * A flag's `default` is what evalFlag returns when:
 *   - the wrangler env var override is unset, AND
 *   - PostHog is unconfigured / unreachable / times out.
 *
 * Defaults MUST preserve current behaviour. Day-one rollout is supposed to
 * be invisible.
 */

import coveragePacks from "../../generated/coverage-flags.json" with { type: "json" };


export const CATEGORIES = /** @type {const} */ (
  ["release", "ops", "experiment", "permission", "consent"]
);

const NAME_RE = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

/**
 * @typedef {"boolean" | "string" | "number"} FlagType
 * @typedef {(typeof CATEGORIES)[number]} FlagCategory
 * @typedef {object} FlagDef
 * @property {string} name
 * @property {FlagType} type
 * @property {boolean | string | number} default
 * @property {FlagCategory} category
 * @property {string} owner
 * @property {string} description
 * @property {string} [expires]   ISO date — review/remove by this date
 */

/** @type {FlagDef[]} */
const DEFINITIONS = [
  // ── site.ui ──────────────────────────────────────────────────────────────
  {
    name: "site.ui.header.beta-banner",
    type: "boolean",
    default: false,
    category: "release",
    owner: "site",
    description:
      "Reserved — render a beta-banner strip above the header. The partial isn't built yet; flipping this flag does nothing today.",
  },
  {
    name: "site.ui.hero.variant",
    type: "string",
    default: "default",
    category: "experiment",
    owner: "site",
    description:
      "Reserved — landing-page hero variant id. Only the 'default' variant ships today; alternate variants are not built.",
  },
  {
    name: "site.ui.footer.newsletter",
    type: "boolean",
    default: true,
    category: "release",
    owner: "site",
    description:
      "Show the newsletter sign-up panel in the footer (v1.5). The form posts an email to POST /api/notify with source=newsletter (KV lead capture); can be repointed to Buttondown later. Off → panel hidden.",
  },

  // ── site.feature ─────────────────────────────────────────────────────────
  {
    name: "site.feature.feedback-widget",
    type: "boolean",
    default: true,
    category: "release",
    owner: "site",
    description: "Mount the floating feedback widget across the site chrome.",
  },
  {
    name: "site.feature.demo-page",
    type: "boolean",
    default: true,
    category: "release",
    owner: "site",
    description: "Expose /demo. When false the route 404s and home-page links hide.",
  },
  {
    name: "site.feature.demo-search",
    type: "boolean",
    default: true,
    category: "release",
    owner: "site",
    description:
      "Enable the /demo workbench Search & Filter layer (deep full-text search + skill/role/kind/phase facets + jump-to-exchange deep links). When false, /demo renders the classic workbench with no search UI and no inlined index.",
  },
  {
    name: "site.feature.install-zip-download",
    type: "boolean",
    default: true,
    category: "release",
    owner: "site",
    description: "Allow downloading the combined opchain-skills.zip and per-skill zips.",
  },
  {
    name: "site.feature.codex-install",
    type: "boolean",
    default: true,
    category: "release",
    owner: "site",
    description:
      "Show the Codex / any-MCP-agent install flow on /install (hosted opchain.dev/mcp endpoint + .codex/skills drop-in). On as of v1.4.3.",
  },
  {
    name: "site.feature.replays-section",
    type: "boolean",
    default: true,
    category: "release",
    owner: "site",
    description:
      "Reserved — render a session-replay vignettes block on the home page. The block isn't built yet; flipping this flag does nothing today.",
  },

  // ── site.experiment ──────────────────────────────────────────────────────
  {
    name: "site.experiment.landing-cta-copy",
    type: "string",
    default: "control",
    category: "experiment",
    owner: "site",
    description:
      "Reserved — variant id for the landing-page CTA copy A/B. Only the 'control' copy is shipped today; alternate variants are not built.",
  },
  {
    name: "site.experiment.install-guided-flow",
    type: "boolean",
    default: false,
    category: "experiment",
    owner: "site",
    description:
      "Reserved — replace the static /install instructions with a guided checklist. The guided flow isn't built yet; flipping this flag does nothing today.",
  },

  // ── site.ops (kill switches; default false → behave normally) ────────────
  {
    name: "site.ops.api-feedback.kill",
    type: "boolean",
    default: false,
    category: "ops",
    owner: "platform",
    description:
      "Dry-run /api/feedback. When true, the handler accepts + logs the submission and returns a synthetic 201 without calling Linear. Migrated from FEEDBACK_DRY_RUN.",
  },
  {
    name: "site.ops.api-notify.kill",
    type: "boolean",
    default: false,
    category: "ops",
    owner: "platform",
    description: "Reject /api/notify with 503. Use to pause lead capture during incidents.",
  },
  {
    name: "site.ops.api-health.detailed",
    type: "boolean",
    default: false,
    category: "ops",
    owner: "platform",
    description: "Include the flag-overrides summary block in /api/health responses.",
  },
  {
    name: "site.ops.api-mcp.kill",
    type: "boolean",
    default: false,
    category: "ops",
    owner: "platform",
    description:
      "Reject /mcp with 503. Use to pause the opchain MCP server (skill catalog + checkpoints over MCP, for Codex and other MCP clients) during incidents.",
  },

  // ── site.consent ─────────────────────────────────────────────────────────
  {
    name: "site.consent.banner-required",
    type: "boolean",
    default: true,
    category: "consent",
    owner: "platform",
    description: "Show the consent banner. Disabling it does NOT auto-grant consent.",
  },

  // ── skills.registry.<id>.enabled — one per skill ─────────────────────────
  ...skillRegistryFlags([
    "oc-api-dev",
    "oc-app-architect",
    "oc-bug-check",
    "oc-checkpoint-protocol",
    "oc-code-auditor",
    "oc-dash-forge",
    "oc-deploy-ops",
    "oc-git-ops",
    "oc-integrations-engineer",
    "oc-migration-ops",
    "oc-monitoring-ops",
    "oc-orchestrator",
    "oc-release-ops",
    "oc-reverse-spec",
    "oc-scale-ops",
    "oc-security-auditor",
    "oc-stack-forge",
    "oc-ux-engineer",
    // v1.5 "Build the AI app" — four AI-native skills (ADEV-344).
    "oc-claude-api",
    "oc-rag-forge",
    "oc-agent-forge",
    "oc-prompt-ops",
  ]),

  // ── skills.capability ────────────────────────────────────────────────────
  {
    name: "skills.capability.tri-agent",
    type: "boolean",
    default: true,
    category: "release",
    owner: "skills",
    description:
      "Render the tri-agent badge / chrome on skills that declare triAgent: true. Disabling hides the chrome but does not unpublish skills.",
  },
  {
    name: "skills.capability.checkpoint-protocol",
    type: "boolean",
    default: true,
    category: "release",
    owner: "skills",
    description:
      "Surface the checkpoint-protocol cross-cuts on skill detail pages. Required by skills that reference checkpoint state.",
  },

  // ── skills.command.<verb>.enabled ────────────────────────────────────────
  // Source: every verb that appears in `commands:` across the SKILL.md set.
  // Subcommands (e.g. `/api design`) inherit the parent verb's flag — we
  // gate at the verb, not the variant. New verbs declared in SKILL.md must
  // register a flag here; gen-skills-catalog.mjs enforces that on build.
  ...skillCommandFlags([
    "/oc-api", "/oc-app", "/oc-attack-surface", "/oc-audit", "/oc-build", "/oc-bugcheck",
    "/oc-commit", "/oc-dash-forge", "/oc-data-forge", "/oc-deploy", "/oc-design",
    "/oc-df-archetype", "/oc-df-audit", "/oc-df-full", "/oc-df-intake", "/oc-df-layout",
    "/oc-df-prototype", "/oc-df-spec-only", "/oc-df-tokens", "/oc-df-variants",
    "/oc-discover", "/oc-feature", "/oc-git", "/oc-git-sync", "/oc-hardening", "/oc-integrate",
    "/oc-launch", "/oc-migrate", "/oc-monitor", "/oc-ops", "/oc-owasp", "/oc-posture", "/oc-pr",
    "/oc-push", "/oc-release", "/oc-rev-design", "/oc-rev-full", "/oc-rev-scan", "/oc-rev-sprint",
    "/oc-rev-stack", "/oc-reverse-spec", "/oc-roadmap", "/oc-scaffold", "/oc-scale", "/oc-sec",
    "/oc-secaudit", "/oc-security", "/oc-spec", "/oc-stack", "/oc-stack-decide",
    "/oc-threat-model", "/oc-uxe",
    // v1.5 AI-native verbs (ADEV-344). Subcommands inherit the parent verb.
    "/oc-claude-api", "/oc-rag", "/oc-agent", "/oc-prompt",
  ]),

  // ── skills.coverage.<id>.enabled — one per oc-stack-forge pack ──────────────
  // Generated from skills/oc-stack-forge/packs/<id>/pack.yml by
  // scripts/gen-stack-packs.mjs (prebuild step 1). Only language, framework,
  // and mobile packs produce flags; deploy-target packs are sub-selections.
  // Flag default mirrors pack status: stable → true, anything else → false.
  ...skillCoverageFlags(coveragePacks),

  // ── skills.experiment ────────────────────────────────────────────────────
  {
    name: "skills.experiment.oc-app-architect.parallel-evaluators",
    type: "boolean",
    default: false,
    category: "experiment",
    owner: "skills",
    description: "Run oc-app-architect design evaluators in parallel rather than sequentially.",
  },
  {
    name: "skills.experiment.oc-code-auditor.deep-scan",
    type: "boolean",
    default: false,
    category: "experiment",
    owner: "skills",
    description: "Enable an extended ruleset in oc-code-auditor.",
  },

  // ── platform.observability ───────────────────────────────────────────────
  {
    name: "platform.observability.posthog-server",
    type: "boolean",
    default: true,
    category: "release",
    owner: "platform",
    description:
      "Allow server-side PostHog capture (analytics.js). Falsifying this skips capture even when POSTHOG_PROJECT_API_KEY is set.",
  },
  {
    name: "platform.observability.posthog-client",
    type: "boolean",
    default: true,
    category: "release",
    owner: "platform",
    description:
      "Allow client-side PostHog SDK to load post-consent. Independent of consent gating.",
  },
  {
    name: "platform.observability.cloudflare-beacon",
    type: "boolean",
    default: true,
    category: "release",
    owner: "platform",
    description:
      "Inject the Cloudflare Web Analytics beacon. PUBLIC_CF_BEACON_TOKEN must also be set for it to render.",
  },

  // ── platform.security ────────────────────────────────────────────────────
  {
    name: "platform.security.csp-strict",
    type: "boolean",
    default: true,
    category: "permission",
    owner: "platform",
    description:
      "Emit Content-Security-Policy in enforce mode. Disabling falls back to Report-Only for CSP-tuning windows.",
  },
  {
    name: "platform.security.rate-limit-feedback",
    type: "boolean",
    default: false,
    category: "permission",
    owner: "platform",
    description:
      "Enforce a per-IP rate limit on /api/feedback. Off until we wire a counter; reserved.",
  },
];

function skillRegistryFlags(ids) {
  return ids.map((id) => ({
    name: `skills.registry.${id}.enabled`,
    type: /** @type {FlagType} */ ("boolean"),
    default: true,
    category: /** @type {FlagCategory} */ ("release"),
    owner: "skills",
    description: `Show the ${id} skill in the catalog and detail page. Off → skill hidden + /skills/${id} 404s.`,
  }));
}

function skillCommandFlags(commands) {
  return commands.map((cmd) => ({
    name: `skills.command.${cmd.replace(/^\//, "")}.enabled`,
    type: /** @type {FlagType} */ ("boolean"),
    default: true,
    category: /** @type {FlagCategory} */ ("release"),
    owner: "skills",
    description: `Allow the ${cmd} slash command to be advertised on skill pages.`,
  }));
}

function skillCoverageFlags(packs) {
  return packs.map((p) => ({
    name: `skills.coverage.${p.id}.enabled`,
    type: /** @type {FlagType} */ ("boolean"),
    default: p.status === "stable",
    category: /** @type {FlagCategory} */ ("release"),
    owner: "oc-stack-forge",
    description: `Show ${p.displayName ?? p.id} (${p.kind}) as a oc-stack-forge coverage option. Off → hidden from recommendations and scaffolds.`,
  }));
}

// Validate the whole table once at import time. Catches duplicate names,
// malformed names, and default-type mismatches without waiting for a test.
const _seen = new Set();
for (const def of DEFINITIONS) {
  if (!NAME_RE.test(def.name)) {
    throw new Error(`flag registry: name "${def.name}" violates the namespace regex`);
  }
  if (_seen.has(def.name)) {
    throw new Error(`flag registry: duplicate flag "${def.name}"`);
  }
  _seen.add(def.name);
  if (typeof def.default !== def.type) {
    throw new Error(
      `flag registry: "${def.name}" default is ${typeof def.default}, expected ${def.type}`,
    );
  }
  if (!CATEGORIES.includes(def.category)) {
    throw new Error(`flag registry: "${def.name}" has unknown category "${def.category}"`);
  }
}

/** Map of flag name → definition. */
export const FLAGS = Object.freeze(
  Object.fromEntries(DEFINITIONS.map((d) => [d.name, Object.freeze(d)])),
);

export const FLAG_NAMES = Object.freeze(Object.keys(FLAGS));

export function getDefault(name) {
  const def = FLAGS[name];
  if (!def) throw new Error(`unknown flag: ${name}`);
  return def.default;
}

export function isKnown(name) {
  return Object.prototype.hasOwnProperty.call(FLAGS, name);
}

/**
 * Flags safe to expose to the client over /api/flags/public. Anything
 * gating an internal/ops control stays server-only.
 */
export const PUBLIC_FLAG_NAMES = Object.freeze(
  FLAG_NAMES.filter((name) =>
    name.startsWith("site.ui.") ||
    name.startsWith("site.feature.") ||
    name.startsWith("site.experiment.") ||
    name.startsWith("site.consent.") ||
    name.startsWith("skills.registry.") ||
    name.startsWith("skills.capability.") ||
    name.startsWith("skills.command.") ||
    name.startsWith("skills.coverage.") ||
    name === "platform.observability.posthog-client" ||
    name === "platform.observability.cloudflare-beacon"
  ),
);
