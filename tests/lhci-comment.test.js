import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildComment } from "../scripts/lhci-comment.cjs";

// Each lhr fixture is a minimal Lighthouse Result object — enough for
// buildComment to compute scores, find URL keys, and detect failing a11y audits.
function lhr(url, scores, a11yAudits = {}) {
  return {
    requestedUrl: url,
    finalUrl: url,
    categories: {
      performance: { score: scores.performance },
      accessibility: {
        score: scores.accessibility,
        auditRefs: Object.keys(a11yAudits).map((id) => ({ id, weight: 1 })),
      },
      "best-practices": { score: scores["best-practices"] },
      seo: { score: scores.seo },
    },
    audits: a11yAudits,
  };
}

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lhci-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(name, contents) {
  writeFileSync(join(dir, name), JSON.stringify(contents));
}

describe("buildComment", () => {
  it("emits a per-route median table when 3 runs per URL are present", () => {
    write("lhr-1.json", lhr("http://localhost/", { performance: 0.94, accessibility: 0.96, "best-practices": 1, seo: 1 }));
    write("lhr-2.json", lhr("http://localhost/", { performance: 0.95, accessibility: 0.96, "best-practices": 1, seo: 1 }));
    write("lhr-3.json", lhr("http://localhost/", { performance: 0.96, accessibility: 0.96, "best-practices": 1, seo: 1 }));

    const out = buildComment(dir);
    expect(out).toContain("median of 3 runs");
    expect(out).toMatch(/\|\s*`\/`\s*\|\s*0\.95\s*\|\s*0\.96\s*\|\s*1\.00\s*\|\s*1\.00\s*\|/);
  });

  it("groups multiple URLs and shows each as its own row", () => {
    write("lhr-a.json", lhr("http://h/", { performance: 1, accessibility: 1, "best-practices": 1, seo: 1 }));
    write("lhr-b.json", lhr("http://h/skills", { performance: 0.99, accessibility: 0.96, "best-practices": 1, seo: 1 }));

    const out = buildComment(dir);
    expect(out).toContain("`/`");
    expect(out).toContain("`/skills`");
  });

  it("looks up report URLs by the requested URL key in links.json", () => {
    write("lhr-1.json", lhr("http://h/demo", { performance: 1, accessibility: 1, "best-practices": 1, seo: 1 }));
    write("links.json", { "http://h/demo": "https://storage/report.html" });

    const out = buildComment(dir);
    expect(out).toContain("[link](https://storage/report.html)");
  });

  it("falls back to looking up by absolute html path when URL key is absent", () => {
    write("lhr-1.json", lhr("http://h/demo", { performance: 1, accessibility: 1, "best-practices": 1, seo: 1 }));
    const absKey = join(dir, "lhr-1.html");
    write("links.json", { [absKey]: "https://storage/abs-report.html" });

    const out = buildComment(dir);
    expect(out).toContain("[link](https://storage/abs-report.html)");
  });

  it("emits a debug section when links.json has entries but none match", () => {
    write("lhr-1.json", lhr("http://h/demo", { performance: 1, accessibility: 1, "best-practices": 1, seo: 1 }));
    write("links.json", { "totally-different-key": "https://storage/r.html" });

    const out = buildComment(dir);
    expect(out).toContain("debug: report-URL lookup miss");
    expect(out).toContain("totally-different-key");
  });

  it("lists failing accessibility audits per route under the score table", () => {
    write(
      "lhr-1.json",
      lhr(
        "http://h/demo",
        { performance: 1, accessibility: 0.91, "best-practices": 1, seo: 1 },
        {
          "color-contrast": { score: 0, title: "Background and foreground colors do not have a sufficient contrast ratio." },
          "button-name": { score: 0, title: "Buttons do not have an accessible name" },
          "image-alt": { score: 1, title: "Image elements have [alt] attributes" }, // passes — should not appear
        }
      )
    );

    const out = buildComment(dir);
    expect(out).toContain("### `/demo` — failing accessibility audits");
    expect(out).toContain("`color-contrast`");
    expect(out).toContain("`button-name`");
    expect(out).not.toContain("`image-alt`");
  });

  it("returns a friendly message when the directory has no lhr-*.json", () => {
    const out = buildComment(dir);
    expect(out).toContain("no reports found");
  });

  it("returns a friendly message when the directory itself does not exist", () => {
    const out = buildComment(join(dir, "missing"));
    expect(out).toContain("directory missing");
  });
});
