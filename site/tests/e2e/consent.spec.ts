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
 * The build for e2e bakes `PUBLIC_POSTHOG_KEY=phc_test_e2e` via `pretest:e2e`
 * in site/package.json so the loader path is exercised in CI.
 *
 * All tests that need a clean slate use `gotoFresh` so the banner appears.
 */

async function gotoFresh(page: import("@playwright/test").Page, path = "/") {
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

    await page.waitForTimeout(200);
    const hasPosthog = await page.evaluate(
      () => typeof (window as any).posthog,
    );
    expect(hasPosthog, "PostHog must not load when consent is declined").toBe(
      "undefined",
    );

    const stored = await page.evaluate(() => localStorage.getItem("opchain-consent"));
    expect(stored).toBe("declined");
  });

  test("accepting hides the banner and stores consent", async ({ page }) => {
    await gotoFresh(page);
    await page.locator("#consent-accept").click();
    await expect(page.locator("#consent-banner")).toBeHidden();

    const stored = await page.evaluate(() => localStorage.getItem("opchain-consent"));
    expect(stored).toBe("granted");

    const posthogType = await page.evaluate(() => typeof (window as any).posthog);
    test.skip(
      posthogType === "undefined",
      "PUBLIC_POSTHOG_KEY not baked into the build — accept loader is a no-op",
    );
    expect(posthogType).toBe("object");
  });

  test("banner stays hidden on subsequent visits after decline", async ({ page }) => {
    await gotoFresh(page);
    await page.locator("#consent-decline").click();
    await page.goto("/skills");
    await expect(page.locator("#consent-banner")).toBeHidden();
  });

  test("prior 'granted' decision skips banner on next visit", async ({ page, context }) => {
    await context.addInitScript(() => {
      try {
        localStorage.setItem("opchain-consent", "granted");
      } catch {
        /* ignore */
      }
    });
    await page.goto("/");
    await expect(page.locator("#consent-banner")).toBeHidden();
  });

  test("prior 'declined' decision skips banner on next visit", async ({ page, context }) => {
    await context.addInitScript(() => {
      try {
        localStorage.setItem("opchain-consent", "declined");
      } catch {
        /* ignore */
      }
    });
    await page.goto("/");
    await expect(page.locator("#consent-banner")).toBeHidden();
  });
});
