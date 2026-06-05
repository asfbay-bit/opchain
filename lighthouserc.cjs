// LHCI config — uses .cjs so per-route thresholds can carry inline reasons.
// Calibration data — most-recent LHCI run (median of 3 runs, PR #94):
//   /        Perf 1.00  A11y 0.96  Best 1.00  SEO 1.00
//   /skills  Perf 0.99  A11y 0.96  Best 1.00  SEO 1.00
//   /demo    Perf 0.99  A11y 0.96  Best 1.00  SEO 1.00
// Backlog: roadmap/05-post-sprint-7-backlog.md B-01 (initial calibration),
// B-08 (raised /demo a11y back from 0.91 once aria-allowed-role and
// aria-allowed-attr were fixed in the scenario picker).
//
// /architecture and /skills/oc-app-architect are awaiting calibration —
// measured at `warn` for the first few runs, then promoted to `error`
// once a stable median is known (same calibration cycle as B-01).
// app-architect is the representative skill detail page; the [id]
// route uses the same Astro template for every skill, so one page is
// sufficient to catch template-level regressions.

module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run preview -- --port 4321 --host 127.0.0.1",
      startServerReadyPattern: "Local",
      url: [
        "http://127.0.0.1:4321/",
        "http://127.0.0.1:4321/skills",
        "http://127.0.0.1:4321/skills/oc-app-architect",
        "http://127.0.0.1:4321/skills/oc-release-ops",
        "http://127.0.0.1:4321/architecture",
        "http://127.0.0.1:4321/demo",
        "http://127.0.0.1:4321/changelog",
      ],
      numberOfRuns: 3,
      settings: { preset: "desktop" },
    },
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: ":4321/$",
          assertions: {
            "categories:performance":    ["error", { minScore: 0.95 }],
            "categories:accessibility":  ["error", { minScore: 0.95 }],
            "categories:best-practices": ["error", { minScore: 0.95 }],
            "categories:seo":            ["error", { minScore: 0.95 }],
          },
        },
        {
          matchingUrlPattern: "/skills$",
          assertions: {
            "categories:performance":    ["error", { minScore: 0.95 }],
            "categories:accessibility":  ["error", { minScore: 0.95 }],
            "categories:best-practices": ["error", { minScore: 0.95 }],
            "categories:seo":            ["error", { minScore: 0.95 }],
          },
        },
        {
          matchingUrlPattern: "/skills/oc-app-architect$",
          assertions: {
            "categories:performance":    ["warn", { minScore: 0.95 }],
            "categories:accessibility":  ["warn", { minScore: 0.95 }],
            "categories:best-practices": ["warn", { minScore: 0.95 }],
            "categories:seo":            ["warn", { minScore: 0.95 }],
          },
        },
        {
          matchingUrlPattern: "/architecture$",
          assertions: {
            "categories:performance":    ["warn", { minScore: 0.95 }],
            "categories:accessibility":  ["warn", { minScore: 0.95 }],
            "categories:best-practices": ["warn", { minScore: 0.95 }],
            "categories:seo":            ["warn", { minScore: 0.95 }],
          },
        },
        {
          matchingUrlPattern: "/demo$",
          assertions: {
            "categories:performance":    ["error", { minScore: 0.95 }],
            "categories:accessibility":  ["error", { minScore: 0.95 }],
            "categories:best-practices": ["error", { minScore: 0.95 }],
            "categories:seo":            ["error", { minScore: 0.95 }],
          },
        },
        {
          // v1.3 carry-over from v1.2: /changelog joined LHCI; warn-level
          // until a stable median is known (matches the calibration
          // pattern used for /architecture and /skills/oc-app-architect).
          matchingUrlPattern: "/changelog$",
          assertions: {
            "categories:performance":    ["warn", { minScore: 0.95 }],
            "categories:accessibility":  ["warn", { minScore: 0.95 }],
            "categories:best-practices": ["warn", { minScore: 0.95 }],
            "categories:seo":            ["warn", { minScore: 0.95 }],
          },
        },
        {
          // v1.3 — release-ops is the 18th skill; same template as the
          // other /skills/[id] pages, so one warn-level entry is enough
          // to catch template regressions while we calibrate.
          matchingUrlPattern: "/skills/oc-release-ops$",
          assertions: {
            "categories:performance":    ["warn", { minScore: 0.95 }],
            "categories:accessibility":  ["warn", { minScore: 0.95 }],
            "categories:best-practices": ["warn", { minScore: 0.95 }],
            "categories:seo":            ["warn", { minScore: 0.95 }],
          },
        },
      ],
    },
    upload: { target: "temporary-public-storage" },
  },
};
