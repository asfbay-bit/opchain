// Site-side catalog helpers.
// Reads the `skills` Astro content collection (defined in src/content.config.ts)
// and pairs it with the TRYIT.md prompts via a build-time glob.

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

