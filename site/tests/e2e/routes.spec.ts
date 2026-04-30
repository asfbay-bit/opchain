import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

/**
 * Smoke: every top-level route renders.
 *
 * For each route we assert:
 *   - expected HTTP status (200 or listed)
 *   - an h1 matches the page (regex)
 *   - Axe finds zero violations (B-02, B-11)
 */

interface RouteSpec {
  path: string;
  h1: RegExp;
  /** Axe rule IDs to disable for this route, with a one-line reason. */
  disabledRules?: { id: string; reason: string }[];
}

const ROUTES: RouteSpec[] = [
  { path: "/",              h1: /opchain/i },
  { path: "/architecture",  h1: /how opchain skills chain/i },
  { path: "/install",       h1: /three flows/i },
  { path: "/skills",        h1: /every skill, filterable/i },
  { path: "/skills/app-architect", h1: /app architect/i },
  { path: "/skills/code-auditor",  h1: /code auditor/i },
  {
    path: "/demo",
    // The magazine cover rotates through all six walkthrough titles on
    // a 2-minute slot, so the h1 is non-deterministic across CI runs.
    // Widen to any of the six known titles.
    h1: /(concept → shipped|dashboard rescue|legacy rails|swap d1|security review|stripe subscriptions)/i,
    disabledRules: [
      {
        id: "region",
        reason:
          "chat-bubble mock content sits inside main but Axe wants extra landmarks",
      },
    ],
  },
  { path: "/privacy",    h1: /privacy/i },
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

    test(`Axe ${path} reports zero a11y violations`, async ({
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
      // Persist the JSON to disk so the post-test PR-comment step can
      // surface it. Path-based attach (rather than body-based) writes
      // an actual file to the test's outputDir; body-based attach only
      // lives in the HTML report metadata.
      if (violations.length > 0) {
        const slug =
          path === "/" ? "root" : path.replace(/^\//, "").replace(/\//g, "_");
        const file = testInfo.outputPath(`axe-violations-${slug}.json`);
        writeFileSync(file, JSON.stringify(violations, null, 2));
        await testInfo.attach(`axe-violations-${slug}.json`, {
          path: file,
          contentType: "application/json",
        });
      }
      expect(
        violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
        `Axe ${path}: unexpected violations — see attached artifact, then either fix in source or add to disabledRules in routes.spec.ts with a reason`,
      ).toEqual([]);
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
