import { expect, test } from "@playwright/test";

/**
 * The /skills page ships a client-side filter over data-* attributes.
 * This suite asserts the filter actually changes what's visible; the
 * exact skill set is intentionally not hardcoded so adding or removing
 * a skill doesn't break the suite.
 */

function visibleSkillCount(page: import("@playwright/test").Page) {
  return page.locator("[data-skill]:visible").count();
}

test.describe("skill library filter", () => {
  test("All pill shows every skill", async ({ page }) => {
    await page.goto("/skills");
    const total = await page.locator("[data-skill]").count();
    expect(total, "expected at least a handful of skills").toBeGreaterThanOrEqual(5);
    expect(await visibleSkillCount(page)).toBe(total);
  });

  test("Plan pill reduces the visible card set", async ({ page }) => {
    await page.goto("/skills");
    const total = await page.locator("[data-skill]").count();

    await page.locator('[data-phase="plan"]').click();
    const planCount = await visibleSkillCount(page);

    expect(planCount).toBeGreaterThan(0);
    expect(planCount).toBeLessThan(total);
  });

  test("Empty state appears when no skills match", async ({ page }) => {
    await page.goto("/skills");
    const search = page.locator('input[type="search"]');
    await search.fill("thisSkillDoesNotExist_xyz123");

    await expect(page.locator("#empty")).toBeVisible();
    expect(await visibleSkillCount(page)).toBe(0);
  });

  test("Tri-agent checkbox further narrows the set", async ({ page }) => {
    await page.goto("/skills");
    const total = await page.locator("[data-skill]").count();
    await page.locator("#tri-only").check();
    const triCount = await visibleSkillCount(page);
    expect(triCount).toBeGreaterThan(0);
    expect(triCount).toBeLessThan(total);
  });

  test("counter text updates to reflect visible count", async ({ page }) => {
    await page.goto("/skills");
    const counter = page.locator("#skill-count");

    const baseline = (await counter.textContent())?.trim() ?? "";
    expect(baseline).toMatch(/Showing \d+ of \d+ skills/);

    await page.locator('[data-phase="foundation"]').click();
    const filtered = (await counter.textContent())?.trim() ?? "";
    expect(filtered).toMatch(/Showing \d+ of \d+ skills/);
    expect(filtered).not.toBe(baseline);
  });
});
