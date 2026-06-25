import { expect, test } from "@playwright/test";

test.describe("blog layout", () => {
  test("index content is centered with real page gutters", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/blog");

    const metrics = await page.locator(".blog-index").evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        paddingLeft: Number.parseFloat(style.paddingLeft),
      };
    });

    expect(metrics.width).toBeLessThan(1100);
    expect(metrics.left).toBeGreaterThan(80);
    expect(1280 - metrics.right).toBeGreaterThan(80);
    expect(metrics.paddingLeft).toBeGreaterThanOrEqual(20);
  });

  test("article TOC sits in a rail without collapsing prose width", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/blog/2026-06-24-why-your-ai-coding-agent-forgets");

    const metrics = await page.evaluate(() => {
      const main = document.querySelector(".blog-post")!.getBoundingClientRect();
      const toc = document.querySelector(".toc")!.getBoundingClientRect();
      const prose = document.querySelector(".prose")!.getBoundingClientRect();
      return {
        mainLeft: main.left,
        tocWidth: toc.width,
        tocRight: toc.right,
        proseLeft: prose.left,
        proseWidth: prose.width,
      };
    });

    expect(metrics.mainLeft).toBeGreaterThan(60);
    expect(metrics.tocWidth).toBeGreaterThan(140);
    expect(metrics.tocWidth).toBeLessThan(230);
    expect(metrics.proseLeft - metrics.tocRight).toBeGreaterThan(36);
    expect(metrics.proseWidth).toBeGreaterThan(640);
    expect(metrics.proseWidth).toBeLessThanOrEqual(720);
  });
});
