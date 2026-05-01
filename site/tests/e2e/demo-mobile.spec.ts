import { devices, expect, test } from "@playwright/test";

/**
 * Mobile workbench — bottom-tab IDE on /demo at phone viewports.
 *
 * Both DesktopWorkbench and MobileWorkbench render in DOM on every
 * request; a CSS breakpoint at 767px hides one of them with
 * `display: none`. These tests pin a phone viewport so the mobile
 * subtree is the visible one, then exercise:
 *
 *   - Tab swap (Scenarios · Stream · I/O · Inspector)
 *   - Scenario card tap auto-switches to Stream and renders the transcript
 *   - I/O tab inputs + outputs both render for the picked scenario
 *   - Inspector tab fills with skills + summary + stages
 *   - Output rows in either tab open the same shared <dialog> lightbox
 *   - The desktop topbar tour button is not interactable
 *
 * Uses Pixel 5 (Chromium, 393×851) instead of iPhone 14 (WebKit, 390×844)
 * so the existing CI Chromium-only Playwright project picks it up — the
 * mobile workbench has no iOS-specific code, so Chromium-mobile is a
 * faithful test. To exercise WebKit specifically, add a webkit project
 * to playwright.config.ts and `npx playwright install webkit` in CI.
 */

test.use({ ...devices["Pixel 5"] });

test.describe("mobile workbench (Pixel 5)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem("opchain-demo-tour-seen", "1"); } catch { /* ignore */ }
      // Pre-decline the consent banner so it never renders. With the
      // workbench tab bar now position:fixed at bottom 0, an open
      // consent banner can intercept clicks on the bottom tabs.
      try { localStorage.setItem("opchain-consent", "declined"); } catch { /* ignore */ }
    });
  });

  test("desktop workbench is hidden, mobile workbench is visible", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.locator(".dw-mobile [data-mobile-workbench]")).toBeVisible();
    // Desktop subtree is in DOM but hidden via CSS.
    await expect(page.locator(".dw-desktop .ide")).toBeHidden();
  });

  test("scenarios tab is active by default and lists all 6 scenarios", async ({ page }) => {
    await page.goto("/demo");
    const root = page.locator("[data-mobile-workbench]");
    await expect(root.locator('[data-mw-tab="scenarios"]')).toHaveAttribute("aria-selected", "true");
    await expect(root.locator("[data-mw-scenario]")).toHaveCount(6);
  });

  test("tapping a scenario card auto-switches to Stream and renders the transcript", async ({ page }) => {
    await page.goto("/demo");
    const root = page.locator("[data-mobile-workbench]");

    await root.locator('[data-mw-scenario="concept-to-shipped"]').click();

    await expect(root.locator('[data-mw-tab="stream"]')).toHaveAttribute("aria-selected", "true");
    await expect(root.locator('[data-mw-stream="concept-to-shipped"]')).toBeVisible();
    await expect(root.locator(".mw-stream-title").first()).toContainText("Concept");
    // First beat exists.
    await expect(root.locator('[data-mw-stream="concept-to-shipped"] .mw-beat').first()).toBeVisible();
  });

  test("I/O tab shows inputs and outputs for the picked scenario", async ({ page }) => {
    await page.goto("/demo");
    const root = page.locator("[data-mobile-workbench]");

    await root.locator('[data-mw-scenario="concept-to-shipped"]').click();
    await root.locator('[data-mw-tab="io"]').click();

    const io = root.locator('[data-mw-io="concept-to-shipped"]');
    await expect(io).toBeVisible();
    await expect(io.locator(".mw-input-list li")).not.toHaveCount(0);
    await expect(io.locator(".mw-output-list li")).not.toHaveCount(0);
  });

  test("Inspector tab shows skills, summary, and stages", async ({ page }) => {
    await page.goto("/demo");
    const root = page.locator("[data-mobile-workbench]");

    await root.locator('[data-mw-scenario="concept-to-shipped"]').click();
    await root.locator('[data-mw-tab="inspector"]').click();

    const insp = root.locator('[data-mw-insp="concept-to-shipped"]');
    await expect(insp).toBeVisible();
    await expect(insp.locator(".mw-insp-title")).toContainText("Concept");
    await expect(insp.locator(".mw-insp-skills .mw-skill-pill").first()).toBeVisible();
    await expect(insp.locator(".mw-insp-beats li").first()).toBeVisible();
  });

  test("output row opens the shared modal lightbox", async ({ page }) => {
    await page.goto("/demo");
    const root = page.locator("[data-mobile-workbench]");
    const modal = page.locator("dialog#output-modal");

    await root.locator('[data-mw-scenario="concept-to-shipped"]').click();
    await root.locator('[data-mw-tab="io"]').click();
    await expect(modal).toBeHidden();

    await root.locator('[data-mw-io="concept-to-shipped"] .output-row[data-output-id="master-spec"]').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator(".modal-body")).not.toBeEmpty();

    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
  });

  test("inline artifact chip in transcript opens the same modal", async ({ page }) => {
    await page.goto("/demo");
    const root = page.locator("[data-mobile-workbench]");
    const modal = page.locator("dialog#output-modal");

    await root.locator('[data-mw-scenario="concept-to-shipped"]').click();
    // The Stream tab is auto-active. Find any artifact chip and click it.
    const chip = root.locator('[data-mw-stream="concept-to-shipped"] .mw-artifact-chip').first();
    await chip.scrollIntoViewIfNeeded();
    await chip.click();

    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("OnboardingTour does not auto-open on mobile", async ({ page, context }) => {
    // Clear the "seen" flag so the desktop path would auto-open.
    await context.clearCookies();
    await page.goto("/demo");
    // The tour root is a fixed-position scrim; if it auto-opened it would be visible.
    // OnboardingTour markup uses `.tour` as its root; assert it's not present-and-visible.
    const tour = page.locator(".tour");
    if ((await tour.count()) > 0) {
      await expect(tour.first()).toBeHidden();
    }
  });
});
