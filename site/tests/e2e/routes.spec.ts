import { test, expect } from "@playwright/test";

/**
 * Sprint 7a: every top-level route returns 200 and renders its h1.
 * Closes Sprint 2/3 DoD: route smoke as a CI gate.
 */

const ROUTES: { path: string; h1: RegExp }[] = [
  { path: "/",                       h1: /opchain/i },
  { path: "/architecture",           h1: /how opchain skills chain/i },
  { path: "/install",                h1: /three flows/i },
  { path: "/skills",                 h1: /every skill, filterable/i },
  { path: "/skills/app-architect",   h1: /app architect/i },
  { path: "/in-action",              h1: /proof, not pitches/i },
  { path: "/tryit",                  h1: /five free exchanges/i },
  { path: "/privacy",                h1: /privacy/i },
  { path: "/styleguide",             h1: /styleguide/i },
];

for (const { path, h1 } of ROUTES) {
  test(`GET ${path} renders its h1`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response, `no response for ${path}`).not.toBeNull();
    expect(response!.status(), `${path} returned ${response!.status()}`).toBe(200);
    await expect(page.locator("h1").first()).toHaveText(h1);
  });
}

test("GET /missing-page renders 404", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist", { waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  // astro preview serves the 404 page body but with 404 status.
  expect(response!.status()).toBe(404);
  await expect(page.locator("h1").first()).toHaveText(/nothing to see here/i);
});
