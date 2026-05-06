// Site-side catalog helpers.
// Reads the `skills` Astro content collection (defined in src/content.config.ts)
// and pairs it with the TRYIT.md prompts via a build-time glob.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCollection, type CollectionEntry } from "astro:content";
import { defaultFor } from "./flags/build-defaults";
import type { FlagName } from "./flags/registry";
import { isKnown as isKnownFlag } from "./flags/registry";

export type SkillEntry = CollectionEntry<"skills">;

export type Role =
  | "workflow"
  | "tri-agent"
  | "audit-gate"
  | "specialist"
  | "advisor"
  | "orchestrator"
  | "success";

// Skill → role mapping. Source of truth for the colored role pills shown
// on the homepage and in the Skill Library. Adjust here, both UIs follow.
const ROLE_BY_NAME: Record<string, Role> = {
  "api-dev":              "tri-agent",
  "app-architect":        "workflow",
  "bug-check":            "audit-gate",
  "checkpoint-protocol":  "success",
  "code-auditor":         "audit-gate",
  "dash-forge":           "specialist",
  "deploy-ops":           "orchestrator",
  "git-ops":              "specialist",
  "integrations-engineer":"tri-agent",
  "migration-ops":        "specialist",
  "monitoring-ops":       "specialist",
  "orchestrator":         "orchestrator",
  "reverse-spec":         "specialist",
  "scale-ops":            "advisor",
  "security-auditor":     "audit-gate",
  "stack-forge":          "advisor",
  "ux-engineer":          "tri-agent",
};

const ROLE_LABEL: Record<Role, string> = {
  "workflow":     "Workflow",
  "tri-agent":    "Tri-agent",
  "audit-gate":   "Audit gate",
  "specialist":   "Standalone specialist",
  "advisor":      "Advisor",
  "orchestrator": "Orchestrator",
  "success":      "Protocol",
};

export function getSkillRole(name: string): Role {
  return ROLE_BY_NAME[name] ?? "specialist";
}

export function getRoleLabel(role: Role): string {
  return ROLE_LABEL[role];
}

// "plan" + "build" → "plan + build". Keeps the original ordering otherwise.
export function phaseLabel(phases: readonly string[]): string {
  return phases.join(" + ");
}

function sortByDisplayName(a: SkillEntry, b: SkillEntry) {
  return a.data.displayName.localeCompare(b.data.displayName);
}

/**
 * Build-time skill visibility check. Reads `skills.registry.<id>.enabled`
 * (default true) and the SKILL.md `flags.required` block (every required
 * flag must default-true for the skill to render). PostHog runtime
 * overrides are ignored here — SSG happens long before the user lands.
 */
export function isSkillVisible(entry: SkillEntry): boolean {
  const id = entry.data.name;
  const registryFlag = `skills.registry.${id}.enabled` as FlagName;
  if (isKnownFlag(registryFlag) && !defaultFor(registryFlag)) return false;
  const required = entry.data.flags?.required ?? [];
  for (const name of required) {
    if (!isKnownFlag(name)) return false;
    if (!defaultFor(name as FlagName)) return false;
  }
  return true;
}

/** All skills, alphabetised by displayName. Build-time flag gates applied. */
export async function getAllSkills(): Promise<SkillEntry[]> {
  const entries = await getCollection("skills");
  return entries.filter(isSkillVisible).sort(sortByDisplayName);
}

/** Single skill by id (the directory name / frontmatter `name`). */
export async function getSkill(id: string): Promise<SkillEntry | undefined> {
  const entries = await getCollection("skills");
  const found = entries.find((entry: SkillEntry) => entry.data.name === id);
  if (!found || !isSkillVisible(found)) return undefined;
  return found;
}

// Resolve the repo root by walking up from this file's location until
// we find the `skills/` directory (the canonical marker for the
// monorepo root). Walking is robust to Astro/Vite bundling, which
// resolves `import.meta.url` to a path that may be one or more levels
// deeper than the source — a fixed `../../..` offset breaks under
// SSG. The walk caps at 8 levels to avoid runaway loops.
function resolveRepoRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, "skills")) && existsSync(path.join(dir, ".git"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fall back to cwd-relative resolution; tolerated as last resort.
  return process.cwd();
}
const REPO_ROOT = resolveRepoRoot();
const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;
const updatedCache = new Map<string, string | null>();

/**
 * Author-date (ISO 8601) of the most recent commit that touched
 * `skills/<id>/`. Used by /skills/<id> to render an "Updated …" badge so
 * visitors can see when a skill was last refreshed without scraping the
 * SKILL.md frontmatter (which ships a coarse semver, not a date).
 *
 * Returns null when git is unavailable, the skill dir has no history
 * yet, or the id contains anything but lowercase alphanumerics + dashes.
 * The page falls back to hiding the badge in those cases.
 */
export function getSkillUpdatedAt(id: string): string | null {
  if (updatedCache.has(id)) return updatedCache.get(id) ?? null;
  let iso: string | null = null;
  if (SAFE_ID.test(id)) {
    try {
      const out = execSync(`git log -1 --format=%cI -- skills/${id}`, {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      iso = out || null;
    } catch {
      iso = null;
    }
  }
  updatedCache.set(id, iso);
  return iso;
}

