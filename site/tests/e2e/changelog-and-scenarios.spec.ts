import { expect, test } from "@playwright/test";

/**
 * /changelog page + /demo scenario picker — kept in lockstep with the
 * release entries as opchain version-bumps. Current release is v1.4
 * (pack registry GA, /coverage page, 5 skill bumps); v1.3 sits one
 * release back (runtime PM, real platforms, oc-release-ops); v1.2
 * remains the third entry (PM-MCP integration).
 *
 * The page also carries an "Upcoming releases" section above the release
 * history: v1.5 (next — built, awaiting deploy) then v1.6 / v1.7 (planned).
 * Those use `section.release.release--next` and deep-link from the roadmap
 * timeline cards (#v1-5 / #v1-6 / #v1-7).
 *
 * Two specs:
 *   1. /changelog — current shipped entry is v1.4, v1.3 demoted to past;
 *      the v1.4 entry deep-links to /coverage; the upcoming section lists
 *      v1.5 → v1.6 → v1.7.
 *
 *   2. /demo — the three v1.3 scenarios + the three v1.2 scenarios
 *      remain pickable on /demo. v1.4 ships no new scenarios — the
 *      release surface is /coverage, not a workbench artifact.
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

// All scenario folders that must remain pickable on /demo. v1.4 ships
// no new scenarios; v1.3 and v1.2 stay accessible.
const ALL_PICKABLE = [...v13_SCENARIOS, ...v12_SCENARIOS];

test.describe("/changelog", () => {
  test("v1.4 is the current release; v1.3 is demoted", async ({ page }) => {
    await page.goto("/changelog");

    // Current release section exists and tags v1.4.
    const current = page.locator("section.release.release--current");
    await expect(current).toBeVisible();
    await expect(current.locator(".rel-tag").first()).toHaveText("v1.4");

    // The v1.3 entry exists, demoted to past. Exclude the upcoming
    // sections (.release--next) — they share the .release base class but
    // are forward-looking (v1.5 next, v1.6/v1.7 planned), not past releases.
    const past = page
      .locator("section.release:not(.release--current):not(.release--next)")
      .first();
    await expect(past).toBeVisible();
    await expect(past.locator(".rel-tag").first()).toHaveText("v1.3");
  });

  test("the v1.4 entry deep-links to /coverage (the pack catalog)", async ({ page }) => {
    await page.goto("/changelog");
    const link = page.locator(`section.release--current a[href="/coverage"]`).first();
    await expect(link, "expected /changelog v1.4 entry to deep-link to /coverage")
      .toBeVisible();
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

  test("upcoming section lists v1.5 (next), then v1.6 / v1.7 (planned)", async ({ page }) => {
    await page.goto("/changelog");

    // The three upcoming releases render as .release--next in order.
    const upcoming = page.locator("section.release.release--next");
    await expect(upcoming).toHaveCount(3);
    await expect(upcoming.nth(0).locator(".rel-tag").first()).toHaveText("v1.5");
    await expect(upcoming.nth(1).locator(".rel-tag").first()).toHaveText("v1.6");
    await expect(upcoming.nth(2).locator(".rel-tag").first()).toHaveText("v1.7");

    // Each anchors an id the roadmap timeline cards deep-link to.
    await expect(page.locator("section#v1-5.release--next")).toBeVisible();
    await expect(page.locator("section#v1-6.release--next")).toBeVisible();
    await expect(page.locator("section#v1-7.release--next")).toBeVisible();
  });

  test("roadmap timeline items are votable and deep-link to the plan", async ({ page }) => {
    await page.goto("/changelog");

    // v1.5/v1.6/v1.7 items are all votable (no shipped placeholder) and
    // their cards deep-link into the matching upcoming detail block.
    const voteButtons = page.locator("[data-vote-target]");
    await expect(voteButtons.first()).toBeVisible();
    expect(await voteButtons.count()).toBeGreaterThanOrEqual(6);

    await expect(
      page.locator('.item-linear[href="/changelog#v1-5"]').first(),
    ).toBeVisible();
    await expect(
      page.locator('.item-linear[href="/changelog#v1-6"]').first(),
    ).toBeVisible();
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

  for (const id of ALL_PICKABLE) {
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
