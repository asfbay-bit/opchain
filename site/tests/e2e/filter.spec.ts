import { test, expect } from "@playwright/test";

/**
 * Sprint 7a: phase filter on /skills strictly reduces visible card count.
 * Closes Sprint 3 DoD.
 */

test("filter: 'plan' phase reduces visible cards from the 'all' baseline", async ({ page }) => {
  await page.goto("/skills");

  const cards = page.locator(".skill-card");
  const allCount = await cards.evaluateAll((els) =>
    els.filter((el) => (el as HTMLElement).offsetParent !== null).length
  );
  expect(allCount).toBeGreaterThan(0);

  await page.locator('[data-phase="plan"]').click();

  const planCount = await cards.evaluateAll((els) =>
    els.filter((el) => (el as HTMLElement).offsetParent !== null).length
  );

  expect(planCount).toBeGreaterThan(0);
  expect(planCount).toBeLessThan(allCount);

  // Reset to all → original count restored.
  await page.locator('[data-phase="all"]').click();
  const restored = await cards.evaluateAll((els) =>
    els.filter((el) => (el as HTMLElement).offsetParent !== null).length
  );
  expect(restored).toBe(allCount);
});

test("filter: counter text updates to reflect visible count", async ({ page }) => {
  await page.goto("/skills");
  const counter = page.locator("#skill-count");

  const baseline = (await counter.textContent())?.trim() ?? "";
  expect(baseline).toMatch(/Showing \d+ of \d+ skills/);

  await page.locator('[data-phase="foundation"]').click();
  const filtered = (await counter.textContent())?.trim() ?? "";
  expect(filtered).toMatch(/Showing \d+ of \d+ skills/);
  expect(filtered).not.toBe(baseline);
});
