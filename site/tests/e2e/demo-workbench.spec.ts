import { expect, test } from "@playwright/test";

/**
 * Demo workbench — IDE-style scenario explorer on /demo.
 *
 * Covers the interactive surfaces:
 *   - Sidebar folder click reveals the scenario summary card
 *   - "▶ play transcript" swaps the editor pane to the chat stream
 *     and surfaces a side-summary in the inspector
 *   - "← back to summary" reverts both panes
 *   - Output rows open the shared <dialog> lightbox
 *   - Fullscreen toggle promotes the workbench to the viewport
 */

const FIRST_FOLDER = '.tree-folder[data-scenario="concept-to-shipped"]';
const FIRST_PANE   = '[data-scenario-pane="concept-to-shipped"]';
const FIRST_INSP   = '[data-inspector-pane="concept-to-shipped"]';

test.describe("demo workbench", () => {
  // Pre-set the OnboardingTour "already-seen" flag so the auto-open scrim
  // doesn't intercept pointer events. Runs before any page script.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem("opchain-demo-tour-seen", "1"); } catch { /* ignore */ }
    });
  });

  test("sidebar folder click shows the scenario summary", async ({ page }) => {
    await page.goto("/demo");

    // Welcome prompt visible by default.
    await expect(page.locator("[data-editor-prompt]")).toBeVisible();

    await page.locator(FIRST_FOLDER).click();

    // Pane visible; summary view inside the pane visible.
    await expect(page.locator(FIRST_PANE)).toBeVisible();
    await expect(page.locator(`${FIRST_PANE} [data-view="summary"]`)).toBeVisible();
    await expect(page.locator(`${FIRST_PANE} [data-view="transcript"]`)).toBeHidden();
    await expect(page.locator("[data-editor-prompt]")).toBeHidden();
  });

  test("play transcript swaps editor pane and fills inspector", async ({ page }) => {
    await page.goto("/demo");
    await page.locator(FIRST_FOLDER).click();

    // Inspector starts as the placeholder.
    await expect(page.locator("[data-inspector-placeholder]")).toBeVisible();
    await expect(page.locator(FIRST_INSP)).toBeHidden();

    await page.locator('[data-play-transcript="concept-to-shipped"]').click();

    // Editor flips to transcript; inspector flips to side-summary.
    await expect(page.locator(`${FIRST_PANE} [data-view="transcript"]`)).toBeVisible();
    await expect(page.locator(`${FIRST_PANE} [data-view="summary"]`)).toBeHidden();
    await expect(page.locator(FIRST_INSP)).toBeVisible();
    await expect(page.locator("[data-inspector-placeholder]")).toBeHidden();

    // Steps start hidden in step-by-step playback mode.
    await expect(page.locator(`${FIRST_PANE} .cc-beat`).first()).toBeHidden();

    // ↵ reveals the first step.
    await page.keyboard.press("Enter");
    await expect(page.locator(`${FIRST_PANE} [data-step-index="0"]`).first()).toBeVisible();

    // ␣ reveals all remaining steps — at least one .cc-assistant should be visible.
    await page.keyboard.press(" ");
    await expect(page.locator(`${FIRST_PANE} .cc-assistant`).first()).toBeVisible();

    // Back button reverts.
    await page.locator('[data-back-to-summary="concept-to-shipped"]').click();
    await expect(page.locator(`${FIRST_PANE} [data-view="summary"]`)).toBeVisible();
    await expect(page.locator(FIRST_INSP)).toBeHidden();
    await expect(page.locator("[data-inspector-placeholder]")).toBeVisible();
  });

  test("output row opens the shared modal lightbox", async ({ page }) => {
    await page.goto("/demo");
    await page.locator(FIRST_FOLDER).click();

    const modal = page.locator("dialog#output-modal");
    await expect(modal).toBeHidden();

    await page
      .locator(`${FIRST_PANE} .output-row[data-output-id="master-spec"]`)
      .first()
      .click();

    await expect(modal).toBeVisible();
    await expect(modal.locator("#modal-title")).not.toHaveText(/^output preview$/i);
    await expect(modal.locator(".modal-body")).not.toBeEmpty();

    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
  });

  test("fullscreen toggle expands the workbench and Escape exits", async ({ page }) => {
    await page.goto("/demo");

    const workbench = page.locator(".workbench");
    const toggle    = page.locator("[data-fullscreen-toggle]");

    await expect(workbench).not.toHaveClass(/is-fullscreen/);
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await toggle.click();
    await expect(workbench).toHaveClass(/is-fullscreen/);
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("Escape");
    await expect(workbench).not.toHaveClass(/is-fullscreen/);
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
  });
});
