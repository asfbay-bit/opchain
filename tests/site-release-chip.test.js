import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const header = readFileSync("site/src/components/Header.astro", "utf8");
const skillsPage = readFileSync("site/src/pages/skills/index.astro", "utf8");
const statusPage = readFileSync("site/src/pages/status.astro", "utf8");
const versionLocations = readFileSync("skills/oc-release-ops/references/version-locations.md", "utf8");

describe("site release chip", () => {
  it("keeps the header chip as a hard-coded release label", () => {
    expect(header).toContain('const CURRENT_RELEASE = "v1.8";');
    expect(header).toContain('const CURRENT_RELEASE_HREF = "/changelog#v1-8";');
    expect(header).toContain("data-version-chip");
    expect(header).toContain('data-release-version={CURRENT_RELEASE}');
    expect(header).toContain('<span class="vchip-tag">{CURRENT_RELEASE}</span>');
    expect(header).not.toContain("versionChipLabel");
  });

  it("uses /api/health only to color the release chip", () => {
    expect(header).toContain('fetch("/api/health"');
    expect(header).toContain('body.ok === true || body.status === "ok"');
    expect(header).not.toContain("live Worker ${version}");
  });

  it("keeps the Skill Library release callout on the current release", () => {
    expect(skillsPage).toContain('href="/changelog#v1-8"');
    expect(skillsPage).toContain('aria-label="See what shipped in opchain v1.8"');
    expect(skillsPage).toContain('<span class="release-callout-tag">v1.8 · SHIPPED</span>');
    expect(skillsPage).toContain("Documentation &amp; repo hygiene");
    expect(skillsPage).toContain("<code>oc-docs-forge</code>");
    expect(skillsPage).toContain("<code>oc-repo-ops</code>");
  });

  it("documents the release chip in the release-version location map", () => {
    expect(versionLocations).toContain("site/src/components/Header.astro");
    expect(versionLocations).toContain('CURRENT_RELEASE = "v1.3"');
  });

  it("documents the actual health payload shape on the status page", () => {
    expect(statusPage).toContain("<code>ok: true</code>");
    expect(statusPage).toContain('json.ok === true || json.status === "ok"');
  });
});
