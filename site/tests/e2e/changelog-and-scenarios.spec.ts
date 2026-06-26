import { expect, test } from "@playwright/test";

/**
 * /changelog page + /demo scenario picker — kept in lockstep with the
 * release entries as opchain version-bumps.
 *
 * /changelog uses the Option C v2 layout: three full-width ARIA tabs —
 * "Just Released" (release history, newest first), "Coming Next" (the next
 * release, v1.7 "Seams & Signals" — a decided plan, no vote), and "Planned"
 * (v1.8 distribution-theme vote + v1.9 / v2.0 grouped roadmap cards). The
 * newest release (v1.6, shipped) is the open hero in Just Released, with v1.5
 * a collapsed hero below it; each card is a button[aria-expanded] disclosure.
 * Deep links: #v1-6/#v1-5 → Just Released; #v1-7 → Coming Next;
 * #v1-8/#v1-9/#v2-0 → Planned; #v1-4 still carries the /coverage link.
 *
 * Two specs:
 *   1. /changelog — three tabs; v1.6 is the open hero in Just Released;
 *      the v1.4 card still deep-links to /coverage; Coming Next leads with
 *      the v1.7 "Seams & Signals" plan; Planned leads with the v1.8 theme
 *      vote then groups v1.9 and v2.0 (>= 6 votable items across the page).
 *
 *   2. /demo — every curated scenario remains pickable on /demo. v1.5
 *      ("Build the AI app") added the four AI-native scenarios (RAG, agent,
 *      model migration, AI-safety gate) and retired the two enterprise-MCP
 *      scenarios + the superseded v1.2 PM scenario + the release dogfood;
 *      the set holds at twelve.
 */

// Every scenario folder that must remain pickable on /demo — the full set of
// twelve, kept in lockstep with site/src/data/walkthroughs/index.ts.
const ALL_PICKABLE = [
  "concept-to-shipped",
  "rag-answer-bot",
  "agent-triage",
  "model-migration",
  "ai-safety-gate",
  "dashboard-rescue",
  "legacy-revive",
  "stripe-ship",
  "postgres-migration",
  "security-hardening",
  "runtime-pm-loop",
  "django-render-shipped",
];

test.describe("/changelog", () => {
  test("three tabs; Just Released is active with the v1.6 hero open", async ({ page }) => {
    await page.goto("/changelog");

    // Three ARIA tabs; Just Released is selected by default and its panel is
    // shown while Coming Next and Planned are hidden.
    await expect(page.locator('[role="tab"]')).toHaveCount(3);
    await expect(page.locator("#tab-released")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#panel-released")).toBeVisible();
    await expect(page.locator("#panel-coming")).toBeHidden();
    await expect(page.locator("#panel-planned")).toBeHidden();

    // The newest release (v1.6) is the accent hero, open on load, tagged
    // with its version + a non-empty compatibility note (changelog-recipe rule).
    const hero = page.locator("#v1-6.hero-card--released");
    await expect(hero).toBeVisible();
    await expect(hero.locator(".hero-ver")).toContainText("v1.6.0");
    await expect(hero.locator(".hero-head")).toHaveAttribute("aria-expanded", "true");
    await expect(hero.locator(".compat-box")).toBeVisible();
    await expect(hero.locator(".compat-box")).not.toBeEmpty();
  });

  test("the v1.4 entry deep-links to /coverage (the pack catalog)", async ({ page }) => {
    await page.goto("/changelog");
    // v1.4 is a collapsed past release; expand its disclosure, then the
    // /coverage link becomes visible.
    await page.locator("#v1-4 [data-disclosure-toggle]").click();
    const link = page.locator(`#v1-4 a[href="/coverage"]`).first();
    await expect(link, "expected /changelog v1.4 entry to deep-link to /coverage")
      .toBeVisible();
  });

  test("Coming Next leads with the v1.7 Seams & Signals plan (decided, no vote)", async ({ page }) => {
    await page.goto("/changelog");
    await page.locator("#tab-coming").click();

    await expect(page.locator("#panel-coming")).toBeVisible();
    // v1.6 shipped; Coming Next now owns v1.7 "Seams & Signals" — a scoped plan
    // of three new skills, not a theme vote.
    await expect(page.locator("#v1-7.hero-card--next .hero-title")).toHaveText(
      /Seams & Signals/i,
    );
    await expect(page.locator("#v1-7 .hero-ver")).toContainText("v1.7");
    for (const skill of ["oc-signal-forge", "oc-modularize-ops", "oc-fleet-ops"]) {
      await expect(page.locator("#v1-7").getByText(skill, { exact: false }).first()).toBeVisible();
    }
    // v1.7 is decided — it carries no vote buttons (the vote moved to v1.8).
    await expect(page.locator("#v1-7 [data-vote-target]")).toHaveCount(0);
  });

  test("Planned leads with the v1.8 theme vote then groups v1.9 / v2.0, >= 6 votable items", async ({ page }) => {
    await page.goto("/changelog");
    await page.locator("#tab-planned").click();

    await expect(page.locator("#panel-planned")).toBeVisible();
    // v1.8 is the relocated distribution-theme vote (hero card), open by default.
    await expect(page.locator("#v1-8.hero-card--next .hero-title")).toHaveText(
      /distribution play/i,
    );
    await expect(page.locator('#v1-8 [data-vote-target="OPC-170"]')).toBeVisible();
    await expect(page.locator("#v1-8 [data-disclosure-toggle]")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    // v1.9 / v2.0 are the longer-range grouped cards.
    await expect(page.locator("#v1-9 .pc-title")).toHaveText(/install and operate/i);
    await expect(page.locator("#v2-0 .pc-title")).toHaveText(/assurance and governed/i);
    // v1.6 shipped (Just Released) and v1.7 moved to Coming Next.
    await expect(page.locator("#panel-planned #v1-6")).toHaveCount(0);
    await expect(page.locator("#panel-planned #v1-7")).toHaveCount(0);

    // Votable items across the whole page: OPC-170/173/174 (v1.8 theme) +
    // OPC-18x (v1.9 / v2.0 planned).
    const voteButtons = page.locator("[data-vote-target]");
    expect(await voteButtons.count()).toBeGreaterThanOrEqual(6);
  });

  test("deep-link #v1-6 opens the Just Released tab and the v1.6 card", async ({ page }) => {
    await page.goto("/changelog#v1-6");
    await expect(page.locator("#tab-released")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#panel-released")).toBeVisible();
    await expect(
      page.locator("#v1-6 [data-disclosure-toggle]"),
    ).toHaveAttribute("aria-expanded", "true");
  });

  test("deep-link #v1-7 opens the Coming Next tab and the v1.7 card", async ({ page }) => {
    await page.goto("/changelog#v1-7");
    await expect(page.locator("#tab-coming")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#panel-coming")).toBeVisible();
    await expect(
      page.locator("#v1-7 [data-disclosure-toggle]"),
    ).toHaveAttribute("aria-expanded", "true");
  });

  test("deep-link #v1-8 opens the Planned tab and the v1.8 group", async ({ page }) => {
    await page.goto("/changelog#v1-8");
    await expect(page.locator("#tab-planned")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#panel-planned")).toBeVisible();
    await expect(
      page.locator("#v1-8 [data-disclosure-toggle]"),
    ).toHaveAttribute("aria-expanded", "true");
  });

  test("deep-link #v1-9 opens the Planned tab and the v1.9 group", async ({ page }) => {
    await page.goto("/changelog#v1-9");
    await expect(page.locator("#tab-planned")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#panel-planned")).toBeVisible();
    await expect(
      page.locator("#v1-9 [data-disclosure-toggle]"),
    ).toHaveAttribute("aria-expanded", "true");
  });

  test("deep-link #v2-0 opens the Planned tab and the v2.0 group", async ({ page }) => {
    await page.goto("/changelog#v2-0");
    await expect(page.locator("#tab-planned")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#panel-planned")).toBeVisible();
    await expect(
      page.locator("#v2-0 [data-disclosure-toggle]"),
    ).toHaveAttribute("aria-expanded", "true");
  });
});

test.describe("/demo — all curated scenarios pickable", () => {
  // Mirror demo-workbench.spec.ts: pre-set the welcome popup as seen so
  // its scrim doesn't intercept clicks.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("opchain-demo-welcome-seen", "1");
      } catch {
        /* ignore */
      }
    });
  });

  for (const id of ALL_PICKABLE) {
    test(`${id} folder is pickable and reveals its summary pane`, async ({ page }) => {
      await page.goto("/demo");
      const folder = page.locator(`.tree-folder[data-scenario="${id}"]`);
      await expect(folder, `tree folder for ${id} not present on /demo`).toBeVisible();
      await folder.click();
      const pane = page.locator(`[data-scenario-pane="${id}"]`);
      await expect(pane).toBeVisible();
      await expect(pane.locator('[data-view="summary"]')).toBeVisible();
    });
  }
});
