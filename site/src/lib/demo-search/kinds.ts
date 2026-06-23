// Artifact-kind normalization for the /demo search facet.
//
// `Artifact.kind` in the walkthrough data is free-text (e.g. "spec.md",
// "linear.md", "pull-request", "render.yaml"). The facet needs a small
// controlled vocabulary. normalizeKind() maps any raw string to a canonical
// bucket. A unit test (tests/demo-search-kinds.test.js) enumerates every
// distinct raw kind in the corpus and asserts each maps to a non-"other"
// canonical value — so a newly-introduced artifact kind fails CI loudly
// rather than silently landing in "other".

export type ArtifactKind =
  | "spec" // specs, architecture, design-decision & planning docs
  | "design" // UX / information-architecture artifacts
  | "code" // source, diffs
  | "test" // test files / coverage (reserved; no corpus artifact yet)
  | "pull-request" // PRs
  | "ticket" // PM tickets / threads (Linear, GitHub issues)
  | "audit" // security / compliance / eval reports
  | "runbook" // operational runbooks
  | "report" // status, announcements, changelog
  | "config" // config files, headers, stamps
  | "data" // logs, ledgers, trees, raw json
  | "other"; // unmapped — should never appear for corpus data

/** Display order for the facet chip group. */
export const ARTIFACT_KIND_ORDER: ArtifactKind[] = [
  "spec",
  "design",
  "code",
  "test",
  "pull-request",
  "ticket",
  "audit",
  "runbook",
  "report",
  "config",
  "data",
  "other",
];

export const ARTIFACT_KIND_LABEL: Record<ArtifactKind, string> = {
  spec: "Spec",
  design: "Design",
  code: "Code",
  test: "Test",
  "pull-request": "Pull request",
  ticket: "Ticket",
  audit: "Audit",
  runbook: "Runbook",
  report: "Report",
  config: "Config",
  data: "Data",
  other: "Other",
};

// Explicit overrides for raw values whose canonical bucket isn't obvious from
// the keyword heuristic below (or where the heuristic would mis-bucket).
const EXPLICIT: Record<string, ArtifactKind> = {
  "linear.md": "ticket",
  tree: "data",
  ledger: "data",
  json: "data",
  "deploy.log": "data",
  "stamp.json": "config",
  csp: "config",
  "ia.md": "design",
  "status.md": "report",
  "announcement.md": "report",
  "report.md": "report",
};

// Keyword heuristics, checked in order. First hit wins. Keeps the normalizer
// resilient to new "*.md" docs without a code change for every variant.
const HEURISTICS: Array<[RegExp, ArtifactKind]> = [
  [/pull-request|(^|[.\/])pr\b|github\.pr|\bpr\.md/, "pull-request"],
  [/runbook|playbook/, "runbook"],
  [/threat|audit|compliance|stig|\bato\b|eval|trace|hardening|posture/, "audit"],
  [/changelog|announce|status|release/, "report"],
  [/\.ya?ml$|(^|[.\/])config|csp|\.toml$|\.ini$|render\./, "config"],
  [/\.diff$|\bdiff\b|code\.|\.patch$/, "code"],
  [/\.log$|ledger|\btree\b|\.csv$|\.jsonl?$|goldset/, "data"],
  [/\bia\b|wireframe|design|mock/, "design"],
  [
    /spec|architecture|decision|contract|plan|sprint|handoff|rbac|auth|rollout|backlog|allowlist|rules|broker|matrix|overview|tech-stack|routing/,
    "spec",
  ],
];

export function normalizeKind(raw: string | undefined | null): ArtifactKind {
  if (!raw) return "other";
  const k = raw.trim().toLowerCase();
  if (!k) return "other";
  if (EXPLICIT[k]) return EXPLICIT[k];
  for (const [re, kind] of HEURISTICS) {
    if (re.test(k)) return kind;
  }
  return "other";
}
