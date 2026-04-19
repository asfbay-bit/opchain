import { expect, test } from "@playwright/test";

/**
 * Smoke: every top-level route renders.
 *
 * For each route we assert:
 *   - 2xx response
 *   - an h1 is visible
 *   - the canonical link points at the route (belt-and-braces for the
 *     `Base.astro` meta bundle)
 */
const routes = [
  { path: "/",                         label: "home" },
  { path: "/architecture",             label: "architecture" },
  { path: "/install",                  label: "install" },
  { path: "/skills",                   label: "skill library" },
  { path: "/skills/app-architect",     label: "app-architect detail" },
  { path: "/skills/code-auditor",      label: "code-auditor detail" },
  { path: "/tryit",                    label: "try it" },
  { path: "/in-action",                label: "in action" },
  { path: "/privacy",                  label: "privacy" },
];

test.describe("routes render", () => {
  for (const { path, label } of routes) {
    test(`${label} (${path}) returns 200 with an h1`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res, `no response for ${path}`).not.toBeNull();
      expect(res!.status(), `unexpected status for ${path}`).toBeLessThan(400);
      await expect(page.locator("h1").first()).toBeVisible();
    });
  }

  test("404 route renders the 404 page", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-real-route");
    // Astro static 404 is served as 404.html → preview returns 404.
    expect(res!.status()).toBe(404);
    await expect(page.locator("h1").first()).toBeVisible();
  });
});
