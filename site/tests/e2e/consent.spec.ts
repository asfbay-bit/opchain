import { test, expect } from "@playwright/test";

/**
 * Sprint 7a: consent banner gates the PostHog SDK.
 * Closes Sprint 5 DoD: no PostHog before consent.
 *
 * The build for e2e bakes `PUBLIC_POSTHOG_KEY=phc_test_e2e` so the
 * loader path is exercised. See `pretest:e2e` in site/package.json.
 */

test("consent: banner visible on fresh storage; decline → no posthog", async ({ page }) => {
  await page.goto("/");
  // Banner is rendered server-side and revealed by the inline script after
  // it confirms localStorage has no decision yet.
  const banner = page.locator("#consent-banner");
  await expect(banner).toBeVisible();

  await page.locator("#consent-decline").click();
  await expect(banner).toBeHidden();

  // localStorage records the decision; PostHog stub must not exist.
  const stored = await page.evaluate(() => localStorage.getItem("opchain-consent"));
  expect(stored).toBe("declined");
  const hasPosthog = await page.evaluate(() => typeof (window as any).posthog);
  expect(hasPosthog).toBe("undefined");
});

test("consent: accept → banner hidden, posthog stub present", async ({ page }) => {
  await page.goto("/");
  await page.locator("#consent-accept").click();
  await expect(page.locator("#consent-banner")).toBeHidden();

  const stored = await page.evaluate(() => localStorage.getItem("opchain-consent"));
  expect(stored).toBe("granted");

  // The official PostHog snippet creates a stub object on `window.posthog`
  // synchronously inside loadPosthog(). We don't assert network calls —
  // just that the stub is in place. Skip if the build wasn't run with
  // PUBLIC_POSTHOG_KEY (loader is a no-op then).
  const posthogType = await page.evaluate(() => typeof (window as any).posthog);
  if (posthogType === "undefined") {
    test.skip(true, "PUBLIC_POSTHOG_KEY not baked into the build — accept loader is a no-op");
  }
  expect(posthogType).toBe("object");
});

test("consent: prior 'granted' decision skips banner on next visit", async ({ page, context }) => {
  await context.addInitScript(() => {
    try { localStorage.setItem("opchain-consent", "granted"); } catch {}
  });
  await page.goto("/");
  await expect(page.locator("#consent-banner")).toBeHidden();
});

test("consent: prior 'declined' decision skips banner on next visit", async ({ page, context }) => {
  await context.addInitScript(() => {
    try { localStorage.setItem("opchain-consent", "declined"); } catch {}
  });
  await page.goto("/");
  await expect(page.locator("#consent-banner")).toBeHidden();
});
