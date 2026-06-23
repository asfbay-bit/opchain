import { expect, test } from "@playwright/test";

/**
 * Demo workbench — Search & Filter layer (site.feature.demo-search).
 *
 * Covers:
 *   - rail Search tab → query → ranked results with <mark> highlight
 *   - rail Filter tab → facet chips narrow + toggle aria-pressed
 *   - multi-select within a facet group (OR)
 *   - clicking a result jumps into the transcript at the exact step
 *   - cold deep-link (#scenario:step) lands in transcript mode on that step
 *   - invalid deep-link degrades gracefully (no crash)
 *   - URL reflects query + facet state
 *   - mobile Find overlay parity
 */

test.describe("demo search & filter", () => {
  test.beforeEach(async ({ page }) => {
    // Suppress the WelcomePopup scrim so it can't intercept clicks.
    await page.addInitScript(() => {
      try {
        localStorage.setItem("opchain-demo-welcome-seen", "1");
      } catch {
        /* ignore */
      }
    });
  });

  test("rail Search tab finds steps and highlights the match", async ({ page }) => {
    await page.goto("/demo");
    await page.locator('.dw-desktop [data-ocs-mode="search"]').click();

    const input = page.locator(".dw-desktop [data-ocs-input]");
    await expect(input).toBeVisible();
    await input.fill("deploy");

    const results = page.locator(".dw-desktop [data-ocs-results] .ocs-res");
    await expect(results.first()).toBeVisible();
    await expect(page.locator(".dw-desktop [data-ocs-results] mark").first()).toBeVisible();
    await expect(page.locator(".dw-desktop [data-ocs-count]")).toContainText("results");
  });

  test("Filter tab facet chips narrow the set and toggle pressed state", async ({ page }) => {
    await page.goto("/demo");
    await page.locator('.dw-desktop [data-ocs-mode="facets"]').click();

    const facets = page.locator(".dw-desktop [data-ocs-facets]");
    await expect(facets).toBeVisible();

    const chip = facets.locator(".ocs-chip").first();
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");

    // scenario count reflects a narrowed set (≤ 12)
    await expect(page.locator(".dw-desktop [data-ocs-scn-count]")).toContainText("/ 12");

    // the active filter surfaces as a removable pill — in the SEARCH panel,
    // which the rail swaps in (pills don't live on the Facets panel).
    await page.locator('.dw-desktop [data-ocs-mode="search"]').click();
    await expect(page.locator(".dw-desktop [data-ocs-pills] .ocs-pill").first()).toBeVisible();
  });

  test("multi-select within a facet group is OR", async ({ page }) => {
    await page.goto("/demo");
    await page.locator('.dw-desktop [data-ocs-mode="facets"]').click();
    const chips = page.locator('.dw-desktop [data-ocs-facets] .ocs-chip[data-ocs-facet^="skill:"]');
    await chips.nth(0).click();
    await chips.nth(1).click();
    await expect(chips.nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
    // URL writes are debounced (~250ms); poll rather than read synchronously.
    await expect.poll(() => page.url()).toContain("skill=");
  });

  test("clicking a result jumps into the transcript at that step", async ({ page }) => {
    await page.goto("/demo");
    await page.locator('.dw-desktop [data-ocs-mode="search"]').click();
    await page.locator(".dw-desktop [data-ocs-input]").fill("deploy");

    const first = page.locator(".dw-desktop [data-ocs-results] .ocs-res").first();
    const go = await first.getAttribute("data-ocs-go");
    expect(go).toBeTruthy();
    const [scenario, step] = (go as string).split(/:(.+)/);

    await first.click();

    const pane = page.locator(`.dw-desktop [data-scenario-pane="${scenario}"]`);
    await expect(pane.locator('[data-view="transcript"]')).toBeVisible();
    await expect(pane.locator(`[data-step-id="${step}"]`)).toBeVisible();
    await expect.poll(() => page.url()).toContain(`#${scenario}:${step}`);
  });

  test("cold deep-link lands in transcript mode on the target step", async ({ page }) => {
    await page.goto("/demo?skill=oc-deploy-ops#concept-to-shipped:s0");
    const pane = page.locator('.dw-desktop [data-scenario-pane="concept-to-shipped"]');
    await expect(pane.locator('[data-view="transcript"]')).toBeVisible();
    await expect(pane.locator('[data-step-id="s0"]')).toBeVisible();
    // filter state from the query string is applied (a pill is shown)
    await expect(page.locator(".dw-desktop [data-ocs-pills] .ocs-pill").first()).toBeVisible();
  });

  test("invalid deep-link target degrades gracefully", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/demo#concept-to-shipped:s9999");
    // scenario still opens; no exception thrown
    await expect(
      page.locator('.dw-desktop [data-scenario-pane="concept-to-shipped"] [data-view="transcript"]')
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("URL reflects the query for sharing", async ({ page }) => {
    await page.goto("/demo");
    await page.locator('.dw-desktop [data-ocs-mode="search"]').click();
    await page.locator(".dw-desktop [data-ocs-input]").fill("rollback");
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("rollback");
  });

  test("mobile Find overlay: search + jump to step", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/demo");

    await page.locator(".dw-mobile [data-ocs-open]").click();
    const overlay = page.locator(".dw-mobile [data-ocs-overlay]");
    await expect(overlay).toBeVisible();

    await overlay.locator("[data-ocs-input]").fill("deploy");
    const first = overlay.locator(".ocs-res").first();
    await expect(first).toBeVisible();
    const go = await first.getAttribute("data-ocs-go");
    const [scenario] = (go as string).split(/:(.+)/);

    await first.click();
    // overlay closes, Stream tab shows the chosen scenario
    await expect(overlay).toBeHidden();
    await expect(page.locator(`.dw-mobile [data-mw-stream="${scenario}"]`)).toBeVisible();
  });
});
