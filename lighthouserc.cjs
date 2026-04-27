// LHCI config — uses .cjs so per-route thresholds can carry inline reasons.
// Calibration data — most-recent LHCI run (median of 3 runs, PR #94):
//   /        Perf 1.00  A11y 0.96  Best 1.00  SEO 1.00
//   /skills  Perf 0.99  A11y 0.96  Best 1.00  SEO 1.00
//   /demo    Perf 0.99  A11y 0.96  Best 1.00  SEO 1.00
// Backlog: roadmap/05-post-sprint-7-backlog.md B-01 (initial calibration),
// B-08 (raised /demo a11y back from 0.91 once aria-allowed-role and
// aria-allowed-attr were fixed in the scenario picker).

module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run preview -- --port 4321 --host 127.0.0.1",
      startServerReadyPattern: "Local",
      url: [
        "http://127.0.0.1:4321/",
        "http://127.0.0.1:4321/skills",
        "http://127.0.0.1:4321/demo",
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
          matchingUrlPattern: "/demo$",
          assertions: {
            "categories:performance":    ["error", { minScore: 0.95 }],
            "categories:accessibility":  ["error", { minScore: 0.95 }],
            "categories:best-practices": ["error", { minScore: 0.95 }],
            "categories:seo":            ["error", { minScore: 0.95 }],
          },
        },
      ],
    },
    upload: { target: "temporary-public-storage" },
  },
};
