import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for opchain.dev e2e tests.
 *
 * Target: the static Astro build served by `astro preview`. The Worker
 * (and its Try-It / feedback / redirect logic) is NOT exercised by this
 * harness — those flows live in Vitest tests and a future e2e suite
 * that boots `wrangler dev`.
 *
 * Scope: static pages + client-side islands (filter, consent banner,
 * copy-to-clipboard). Consent tests rely on `PUBLIC_POSTHOG_KEY` being
 * set at BUILD time (Astro bakes `import.meta.env` into the bundle) so
 * the banner's accept path can fire the PostHog bootstrap. The CI
 * pipeline sets that env before running `astro build`; for local runs
 * `npm run test:e2e` inherits whatever is in your shell (unset →
 * consent-accept test is skipped).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4321",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4321",
    url: "http://127.0.0.1:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
