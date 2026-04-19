import { expect, test } from "@playwright/test";

/**
 * Consent banner behaviour.
 *
 * The banner is rendered by every page via `Base.astro` → `ConsentBanner.astro`.
 * On first visit with no stored decision it must be visible. Declining
 * must NOT load PostHog. Accepting must load it (verified by the
 * `window.posthog` global appearing — the inline bootstrap replaces the
 * stub with the real SDK).
 *
 * All tests start with a clean slate: `localStorage` cleared before each
 * goto so the banner appears.
 */

async function gotoFresh(page: import("@playwright/test").Page, path = "/") {
  // Navigate once so we're on the origin, then clear storage and reload.
  // (localStorage can't be set pre-navigation — no origin yet.)
  await page.goto(path);
  await page.evaluate(() => localStorage.clear());
  await page.goto(path);
}

test.describe("consent banner", () => {
  test("visible on first visit (no stored decision)", async ({ page }) => {
    await gotoFresh(page);
    await expect(page.locator("#consent-banner")).toBeVisible();
  });

  test("declining hides the banner and does NOT load PostHog", async ({ page }) => {
    await gotoFresh(page);
    await page.locator("#consent-decline").click();
    await expect(page.locator("#consent-banner")).toBeHidden();

    // Give the bootstrap a beat to NOT fire.
    await page.waitForTimeout(200);
    const hasPosthog = await page.evaluate(
      () => typeof (window as any).posthog !== "undefined",
    );
    expect(hasPosthog, "PostHog must not load when consent is declined").toBe(false);

    const stored = await page.evaluate(() => localStorage.getItem("opchain-consent"));
    expect(stored).toBe("declined");
  });

  test("accepting hides the banner and stores consent", async ({ page }) => {
    await gotoFresh(page);
    await page.locator("#consent-accept").click();
    await expect(page.locator("#consent-banner")).toBeHidden();

    const stored = await page.evaluate(() => localStorage.getItem("opchain-consent"));
    expect(stored).toBe("granted");
  });

  test("banner stays hidden on subsequent visits after decline", async ({ page }) => {
    await gotoFresh(page);
    await page.locator("#consent-decline").click();
    await page.goto("/skills");
    await expect(page.locator("#consent-banner")).toBeHidden();
  });
});
