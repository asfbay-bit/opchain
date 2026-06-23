// Pure skill→role mapping. Extracted from skills.ts so it can be imported by
// modules that must NOT pull in `astro:content` (e.g. the /demo search index
// builder + its Vitest unit tests, which run in a plain Node environment).
// skills.ts re-exports everything here, so existing
// `import { getSkillRole, type Role } from "../lib/skills"` callsites are
// unaffected.

export type Role =
  | "workflow"
  | "tri-agent"
  | "audit-gate"
  | "specialist"
  | "advisor"
  | "orchestrator"
  | "success";

// Skill → role mapping. Source of truth for the colored role pills shown
// on the homepage, the Skill Library, and the /demo workbench.
const ROLE_BY_NAME: Record<string, Role> = {
  "oc-api-dev": "tri-agent",
  "oc-app-architect": "workflow",
  "oc-bug-check": "audit-gate",
  "oc-checkpoint-protocol": "success",
  "oc-code-auditor": "audit-gate",
  "oc-dash-forge": "specialist",
  "oc-deploy-ops": "orchestrator",
  "oc-git-ops": "specialist",
  "oc-integrations-engineer": "tri-agent",
  "oc-migration-ops": "specialist",
  "oc-monitoring-ops": "specialist",
  "oc-orchestrator": "orchestrator",
  "oc-reverse-spec": "specialist",
  "oc-scale-ops": "advisor",
  "oc-security-auditor": "audit-gate",
  "oc-stack-forge": "advisor",
  "oc-ux-engineer": "tri-agent",
};

const ROLE_LABEL: Record<Role, string> = {
  workflow: "Workflow",
  "tri-agent": "Tri-agent",
  "audit-gate": "Audit gate",
  specialist: "Standalone specialist",
  advisor: "Advisor",
  orchestrator: "Orchestrator",
  success: "Protocol",
};

export function getSkillRole(name: string): Role {
  return ROLE_BY_NAME[name] ?? "specialist";
}

export function getRoleLabel(role: Role): string {
  return ROLE_LABEL[role];
}
