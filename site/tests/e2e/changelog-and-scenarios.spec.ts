import { expect, test } from "@playwright/test";

/**
 * /changelog page + /demo scenario picker — kept in lockstep with the
 * release entries as opchain version-bumps.
 *
 * /changelog uses the Option C v3 layout: two ARIA tabs — "Just Released"
 * (the release history, newest first) and "Coming Next" (v1.5, then the
 * v1.6 / v1.7 roadmap). The newest release (v1.4.2) and v1.5 / v1.6 are
 * expanded on load; each card is a button[aria-expanded] disclosure.
 * Deep links (#v1-5 / #v1-6 / #v1-7) activate the Coming Next tab and open
 * the target card; #v1-4 still carries the /coverage link.
 *
 * Two specs:
 *   1. /changelog — two tabs; v1.4.2 is the open hero in Just Released;
 *      the v1.4 card still deep-links to /coverage; Coming Next lists
 *      v1.5 / v1.6 / v1.7 with >= 6 votable roadmap items.
 *
 *   2. /demo — the three v1.3 scenarios + the three v1.2 scenarios
 *      remain pickable on /demo. Neither v1.4 nor v1.4.2 ships new
 *      scenarios — the release surfaces are /coverage and the bundle /
 *      checkpoint tooling, not workbench artifacts.
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
  test("two tabs; Just Released is active with the v1.4.2 hero open", async ({ page }) => {
    await page.goto("/changelog");

    // Two ARIA tabs; Just Released is selected by default and its panel is
    // shown while Coming Next is hidden.
    await expect(page.locator('[role="tab"]')).toHaveCount(2);
    await expect(page.locator("#tab-released")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#panel-released")).toBeVisible();
    await expect(page.locator("#panel-coming")).toBeHidden();

    // The newest release (v1.4.2) is the accent hero, open on load, tagged
    // with its version + a non-empty compatibility note (changelog-recipe rule).
    const hero = page.locator("#v1-4-2.hero-card--released");
    await expect(hero).toBeVisible();
    await expect(hero.locator(".hero-ver")).toContainText("v1.4.2");
    await expect(hero.locator(".hero-head")).toHaveAttribute("aria-expanded", "true");
    await expect(hero.locator(".compat-box")).toBeVisible();
    await expect(hero.locator(".compat-box")).not.toBeEmpty();
  });

  test("the v1.4 entry deep-links to /coverage (the pack catalog)", async ({ page }) => {
    await page.goto("/changelog");
    // v1.4 is a collapsed past release; expand its disclosure, then the
    // /coverage link becomes visible.
    await page.locator("#v1-4 [data-disclosure-toggle]").click();
    const link = page.locator(`#v1-4 a[href="/coverage"]`).first();
    await expect(link, "expected /changelog v1.4 entry to deep-link to /coverage")
      .toBeVisible();
  });

  test("Coming Next lists v1.5 (next), then v1.6 / v1.7, all votable", async ({ page }) => {
    await page.goto("/changelog");
    await page.locator("#tab-coming").click();

    await expect(page.locator("#panel-coming")).toBeVisible();
    await expect(page.locator("#v1-5.hero-card--next .hero-title")).toHaveText(
      /build the ai app/i,
    );
    await expect(page.locator("#v1-6 .pc-title")).toBeVisible();
    await expect(page.locator("#v1-7 .pc-title")).toBeVisible();

    // Six votable roadmap items: OPC-150 (v1.5) + OPC-160/161/162 (v1.6) +
    // OPC-170/171 (v1.7). The v1.5 vote lives in an open card, so it shows
    // once the Coming Next tab is active.
    const voteButtons = page.locator("[data-vote-target]");
    expect(await voteButtons.count()).toBeGreaterThanOrEqual(6);
    await expect(page.locator('[data-vote-target="OPC-150"]')).toBeVisible();
  });

  test("deep-link #v1-6 opens the Coming Next tab and the v1.6 card", async ({ page }) => {
    await page.goto("/changelog#v1-6");
    await expect(page.locator("#tab-coming")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#panel-coming")).toBeVisible();
    await expect(
      page.locator("#v1-6 [data-disclosure-toggle]"),
    ).toHaveAttribute("aria-expanded", "true");
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
