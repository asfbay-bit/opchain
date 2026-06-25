import { describe, it, expect } from "vitest";
import { checkReleaseSurfaces } from "../scripts/check-release-surfaces.mjs";

/**
 * Guards against release-surface drift (the "we shipped vN but the site still
 * says vN-1" bug that v1.6 S7 exists to fix). Every live-claim site surface —
 * Header chip, homepage release bar + stat, changelog Just-Released hero,
 * styleguide badge — must agree on the same release line.
 *
 * Catalog of surfaces + the build-PR-vs-deploy split:
 * skills/oc-release-ops/references/site-release-surfaces.md
 */
describe("release surfaces are consistent", () => {
  const report = checkReleaseSurfaces();

  it("every live-claim surface resolves to a release value (no probe broke)", () => {
    const broken = report.results.filter((r) => r.error);
    expect(
      broken.map((r) => `${r.label}: ${r.error}`),
      "a release-surface probe failed to find its pattern — the markup changed; update scripts/check-release-surfaces.mjs",
    ).toEqual([]);
  });

  it("all live-claim surfaces agree on the same release line", () => {
    expect(
      report.errors,
      `release-surface drift — fix per site-release-surfaces.md (resolved: ${report.expected})`,
    ).toEqual([]);
    expect(report.ok).toBe(true);
  });
});
