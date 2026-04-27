// LHCI config for production runs (.github/workflows/lighthouse-prod.yml).
// Differs from lighthouserc.cjs in three places:
//   - URLs target https://opchain.dev (live), not the local preview server.
//   - No startServerCommand — production is already up.
//   - Assertions are "warn" not "error" — production runs are notification-
//     only. The lighthouse-prod workflow never blocks a deploy, because by
//     the time it runs the site is already serving traffic.
// Backlog: roadmap/05-post-sprint-7-backlog.md B-07.

module.exports = {
  ci: {
    collect: {
      url: [
        "https://opchain.dev/",
        "https://opchain.dev/skills",
        "https://opchain.dev/demo",
      ],
      numberOfRuns: 3,
      settings: { preset: "desktop" },
    },
    assert: {
      // Production-grade thresholds. The PR-time gate (lighthouserc.cjs)
      // runs against a local preview server with no CDN/analytics/real
      // network — those add real-world variance, so the prod thresholds
      // are looser on Performance + Best Practices and identical on
      // Accessibility + SEO (those should not regress vs. the build).
      assertMatrix: [
        {
          matchingUrlPattern: ".*",
          assertions: {
            "categories:performance":    ["warn", { minScore: 0.85 }],
            "categories:accessibility":  ["warn", { minScore: 0.95 }],
            "categories:best-practices": ["warn", { minScore: 0.90 }],
            "categories:seo":            ["warn", { minScore: 0.95 }],
          },
        },
      ],
    },
    upload: { target: "temporary-public-storage" },
  },
};
