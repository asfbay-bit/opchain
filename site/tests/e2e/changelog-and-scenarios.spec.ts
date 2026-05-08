import { expect, test } from "@playwright/test";

/**
 * v1.3 carry-over from v1.2: end-to-end coverage for the /changelog page
 * and the scenario picker on /demo.
 *
 * Two specs:
 *   1. /changelog — current entry is v1.3, v1.2 demoted to past, all
 *      anchors that the v1.3 entry links to (#runtime-pm-loop /
 *      #release-ops-dogfood / #django-render-shipped /
 *      #mcp-enterprise-f500 / #mcp-enterprise-defense) actually exist as
 *      data-scenario folders on /demo.
 *
 *   2. /demo — the three new v1.3 scenarios + the three v1.2 scenarios
 *      are pickable (folder click reveals the scenario pane).
 */

const v13_SCENARIOS = [
  "runtime-pm-loop",
  "release-ops-dogfood",
  "django-render-shipped",
];

const v12_SCENARIOS = [
  "mcp-enterprise-f500",
  "mcp-enterprise-defense",
  "pm-pipeline-linear",
];

const ALL_LINKED = [...v13_SCENARIOS, ...v12_SCENARIOS];

test.describe("/changelog", () => {
  test("v1.3 is the current release; v1.2 is demoted", async ({ page }) => {
    await page.goto("/changelog");

    // Current release section exists and tags v1.3.
    const current = page.locator("section.release.release--current");
    await expect(current).toBeVisible();
    await expect(current.locator(".rel-tag").first()).toHaveText("v1.3");

    // The v1.2 entry exists, demoted to past.
    const past = page.locator("section.release:not(.release--current)").first();
    await expect(past).toBeVisible();
    await expect(past.locator(".rel-tag").first()).toHaveText("v1.2");
  });

  test("every scenario the v1.3 entry links to has a /demo deep link", async ({ page }) => {
    await page.goto("/changelog");
    for (const id of ALL_LINKED) {
      const link = page.locator(`section.release--current a[href="/demo#${id}"]`).first();
      await expect(link, `expected /changelog v1.3 entry to deep-link to /demo#${id}`)
        .toBeVisible();
    }
  });

  test("compatibility section is non-empty (changelog-recipe.md rule)", async ({ page }) => {
    await page.goto("/changelog");
    const compat = page
      .locator("section.release--current h3", { hasText: /compatibility/i })
      .first();
    await expect(compat).toBeVisible();
    // The paragraph immediately after the h3 must have content.
    const next = compat.locator("xpath=following-sibling::p[1]");
    await expect(next).not.toBeEmpty();
  });
});

test.describe("/demo — v1.3 + v1.2 scenarios pickable", () => {
  // Mirror demo-workbench.spec.ts: pre-set the welcome popup as seen so
  // its scrim doesn't intercept clicks.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("opchain-demo-welcome-seen", "1");
      } catch {
        /* ignore */
      }
    });
  });

  for (const id of ALL_LINKED) {
    test(`${id} folder is pickable and reveals its summary pane`, async ({ page }) => {
      await page.goto("/demo");
      const folder = page.locator(`.tree-folder[data-scenario="${id}"]`);
      await expect(folder, `tree folder for ${id} not present on /demo`).toBeVisible();
      await folder.click();
      const pane = page.locator(`[data-scenario-pane="${id}"]`);
      await expect(pane).toBeVisible();
      await expect(pane.locator('[data-view="summary"]')).toBeVisible();
    });
  }
});
