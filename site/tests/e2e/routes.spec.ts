import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

/**
 * Smoke: every top-level route renders.
 *
 * For each route we assert:
 *   - expected HTTP status (200 or listed)
 *   - an h1 matches the page (regex)
 *   - optional Axe pass (artifacts in CI; baseline does not fail the job)
 */

interface RouteSpec {
  path: string;
  h1: RegExp;
  /** Axe rule IDs to disable for this route, with a one-line reason. */
  disabledRules?: { id: string; reason: string }[];
}

const ROUTES: RouteSpec[] = [
  { path: "/", h1: /opchain/i },
  { path: "/architecture", h1: /how opchain skills chain/i },
  { path: "/install", h1: /three flows/i },
  { path: "/skills", h1: /every skill, filterable/i },
  { path: "/skills/app-architect", h1: /app architect/i },
  { path: "/skills/code-auditor", h1: /code auditor/i },
  {
    path: "/in-action",
    h1: /proof, not pitches/i,
    disabledRules: [
      {
        id: "region",
        reason:
          "chat-bubble mock content sits inside main but Axe wants extra landmarks",
      },
    ],
  },
  { path: "/tryit", h1: /five free exchanges/i },
  { path: "/privacy", h1: /privacy/i },
  { path: "/styleguide", h1: /styleguide/i },
];

test.describe("routes render", () => {
  for (const { path, h1, disabledRules } of ROUTES) {
    test(`${path} returns 200 with its h1`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res, `no response for ${path}`).not.toBeNull();
      expect(res!.status(), `unexpected status for ${path}`).toBe(200);
      await expect(page.locator("h1").first()).toHaveText(h1);
    });

    test(`Axe ${path} reports any a11y violations as artifacts`, async ({
      page,
    }, testInfo) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      let builder = new AxeBuilder({ page }).withTags([
        "wcag2a",
        "wcag2aa",
        "wcag21a",
        "wcag21aa",
        "best-practice",
      ]);
      if (disabledRules?.length) {
        builder = builder.disableRules(disabledRules.map((r) => r.id));
      }
      const { violations } = await builder.analyze();
      if (violations.length > 0) {
        const slug =
          path === "/" ? "root" : path.replace(/^\//, "").replace(/\//g, "_");
        await testInfo.attach(`axe-violations-${slug}.json`, {
          body: JSON.stringify(violations, null, 2),
          contentType: "application/json",
        });
        // eslint-disable-next-line no-console
        console.warn(`Axe ${path}: ${violations.length} violation(s) — see attached artifact`);
      }
    });
  }

  test("404 route renders the 404 page", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-real-route", {
      waitUntil: "domcontentloaded",
    });
    expect(res!.status()).toBe(404);
    await expect(page.locator("h1").first()).toHaveText(/nothing to see here/i);
  });
});
