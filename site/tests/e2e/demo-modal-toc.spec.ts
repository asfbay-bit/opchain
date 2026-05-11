import { expect, test } from "@playwright/test";

/**
 * Demo modal TOC — scroll-to-heading + ember flash.
 *
 * Covers the two behaviors added on the claude/demo-toc-scroll-flash
 * branch:
 *   1. TOC link click scrolls the modal body so the target heading
 *      lands ~16px below the modal body's top edge (regression of the
 *      previous offsetTop-based formula that overshot).
 *   2. Clicking a TOC link applies the `.is-flash-heading` class to the
 *      target heading; the class is removed at the 4s mark.
 *
 * The TOC sidebar only renders for artifacts with ≥ 6 headings
 * (TOC_MIN_HEADINGS in demo.astro). The scenario-1 "master-spec"
 * artifact is the canonical multi-heading target — 22 numbered sections
 * means the TOC is always visible.
 */

const FIRST_FOLDER = '.tree-folder[data-scenario="concept-to-shipped"]';
const FIRST_PANE   = '[data-scenario-pane="concept-to-shipped"]';

/** Open /demo, open the first scenario, click the master-spec output. */
async function openMasterSpecModal(page: import("@playwright/test").Page) {
  await page.goto("/demo");
  await page.locator(FIRST_FOLDER).click();
  await page
    .locator(`${FIRST_PANE} .output-row[data-output-id="master-spec"]`)
    .first()
    .click();

  const modal = page.locator("dialog#output-modal");
  await expect(modal).toBeVisible();
  await expect(modal.locator(".modal-toc")).toBeVisible(); // ≥ 6 headings
  return modal;
}

test.describe("demo modal — TOC scroll + flash", () => {
  test.beforeEach(async ({ page }) => {
    // Welcome popup scrim would block clicks; pre-set the seen flag.
    await page.addInitScript(() => {
      try {
        localStorage.setItem("opchain-demo-welcome-seen", "1");
      } catch {
        /* ignore */
      }
    });
  });

  test("TOC click scrolls heading to ~16px below modal body top", async ({ page }) => {
    const modal = await openMasterSpecModal(page);
    const body = modal.locator(".modal-body");

    // Pick the 3rd TOC link — far enough that scrolling actually moves
    // the body. The 1st link is the document title which sits at the
    // top by default and would produce a trivial 0-delta scroll.
    const link = modal.locator(".modal-toc-nav a").nth(2);
    const headingId = await link.evaluate((el) => {
      const href = el.getAttribute("href") ?? "";
      return href.startsWith("#") ? href.slice(1) : "";
    });
    expect(headingId).not.toBe("");

    await link.click();

    // Smooth scroll: wait until body.scrollTop stops changing for 2
    // consecutive frames before measuring.
    await body.evaluate(async (el) => {
      await new Promise<void>((resolve) => {
        let prev = -1;
        let stable = 0;
        const tick = () => {
          const top = (el as HTMLElement).scrollTop;
          if (top === prev) {
            stable++;
            if (stable >= 3) return resolve();
          } else {
            stable = 0;
            prev = top;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    });

    // Measure: heading rect top should be 16 ± 8 px below the body rect top.
    const offset = await page.evaluate((id) => {
      const heading = document.getElementById(id);
      const bodyEl  = document.querySelector(".modal-body");
      if (!heading || !bodyEl) return null;
      const h = heading.getBoundingClientRect();
      const b = bodyEl.getBoundingClientRect();
      return h.top - b.top;
    }, headingId);

    expect(offset).not.toBeNull();
    expect(offset!).toBeGreaterThanOrEqual(8);
    expect(offset!).toBeLessThanOrEqual(32);
  });

  test("ember flash class is applied on click and removed at ~4s", async ({ page }) => {
    const modal = await openMasterSpecModal(page);

    const link = modal.locator(".modal-toc-nav a").nth(2);
    const headingId = await link.evaluate((el) => {
      const href = el.getAttribute("href") ?? "";
      return href.startsWith("#") ? href.slice(1) : "";
    });

    await link.click();

    // Flash class applied immediately.
    // Use `[id="..."]` rather than `#...` because slugify can produce
    // ids starting with a digit (e.g. "2-outcome-..."), which is a
    // valid HTML id but an invalid CSS selector.
    const heading = page.locator(`[id="${headingId}"]`);
    await expect(heading).toHaveClass(/is-flash-heading/);

    // The class is removed by the time the 4s animation ends. Give
    // the runtime a 600ms slack window for animation+timeout drift.
    await expect(heading).not.toHaveClass(/is-flash-heading/, { timeout: 5000 });
  });

  test("re-clicking the same TOC link re-fires the flash", async ({ page }) => {
    const modal = await openMasterSpecModal(page);

    const link = modal.locator(".modal-toc-nav a").nth(2);
    const headingId = await link.evaluate((el) => {
      const href = el.getAttribute("href") ?? "";
      return href.startsWith("#") ? href.slice(1) : "";
    });

    await link.click();
    const heading = page.locator(`[id="${headingId}"]`);
    await expect(heading).toHaveClass(/is-flash-heading/);

    // Wait for the class to clear, then re-click and assert the class
    // is back. This is the "force reflow → re-trigger" path.
    await expect(heading).not.toHaveClass(/is-flash-heading/, { timeout: 5000 });

    await link.click();
    await expect(heading).toHaveClass(/is-flash-heading/);
  });
});

test.describe("demo modal — TOC under reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("opchain-demo-welcome-seen", "1");
      } catch {
        /* ignore */
      }
    });
  });

  test("flash class still applied + cleared via setTimeout fallback", async ({ page }) => {
    const modal = await openMasterSpecModal(page);

    const link = modal.locator(".modal-toc-nav a").nth(2);
    const headingId = await link.evaluate((el) => {
      const href = el.getAttribute("href") ?? "";
      return href.startsWith("#") ? href.slice(1) : "";
    });

    await link.click();
    // Attribute-selector form — slugify can produce digit-leading ids.
    const heading = page.locator(`[id="${headingId}"]`);
    await expect(heading).toHaveClass(/is-flash-heading/);

    // Under reduced motion the keyframes don't run, so animationend
    // never fires. The JS falls back to a 4s setTimeout cleanup.
    await expect(heading).not.toHaveClass(/is-flash-heading/, { timeout: 5000 });
  });
});
