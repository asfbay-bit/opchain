import { type Page, expect, test } from "@playwright/test";

/**
 * Architecture-diagram geometry guard.
 *
 * The /architecture diagram is a hand-authored set of inline SVGs (one
 * `<svg viewBox>` per phase, no group transforms) whose node labels are
 * positioned with literal x/y coordinates and hand-tuned `font-size`
 * attributes. That makes it easy to regress: a renamed skill, a longer
 * `/oc-*` slash-command string, or a stray font-size can push label text
 * past its node border or resurrect the "NEW vX" strikethrough bug (a
 * border-straddling chip whose opaque backing rect went missing, so the
 * node's top edge draws straight through the label). None of that shows
 * up in the route/Axe smoke suite.
 *
 * This guard measures the *rendered* geometry (via getBBox inside the
 * page) and asserts three invariants per breakpoint:
 *
 *   1. No node label <text> overflows its containing node <rect>
 *      horizontally. Chips that intentionally straddle a node border
 *      (CP / ORC / spine ordinal / NEW) are excluded.
 *   2. Every border-straddling badge chip has an opaque backing rect,
 *      so the node border can't strike through the label.
 *   3. The set of distinct font sizes stays on the approved scale.
 *
 * Coordinates: getBBox returns user-space units in the *local* SVG's
 * viewBox coordinate system, and (because none of these rects carry a
 * transform) a rect's getBBox equals its raw x/y/width/height attributes.
 * A label and the node that contains it always live in the SAME `<svg>`,
 * so all geometry is collected and compared per-`<svg>`. Never across.
 *
 * Breakpoints: the diagram swaps `.arch-desktop` / `.arch-mobile` via a
 * CSS media query at 767px, so the hidden variant is `display: none`
 * (getBBox throws / returns a zero box on it). Desktop assertions run at
 * >=1280w against `.arch-desktop`; mobile at 390w against `.arch-mobile`,
 * with every `<details>` band forced open first.
 */

/** Failure record for a label that spills past its node box. */
type OverflowViolation = {
  /** Offending label text. */
  text: string;
  /** Its `font-size` attribute (or "(inherited)" if unset). */
  fontSize: string;
  /** Measured rendered text width, user units. */
  width: number;
  /** Width of the node <rect> it overflowed. */
  nodeWidth: number;
};

/** Failure record for a border-straddling chip missing its opaque backing. */
type BadgeViolation = {
  /** The group key `x|y|w|h` of the chip rect(s). */
  badge: string;
  /** The chip's label text, so a dev can find it. */
  label: string;
  /** Every fill in the group (none of them opaque → the bug). */
  fills: string[];
};

/** Result of the font-size audit for one root. */
type FontSizeAudit = { distinct: number[]; disallowed: number[] };

interface GeometryConfig {
  rootSelector: string;
  /** A rect counts as a node when w>=nodeMinW && h>=nodeMinH. */
  nodeMinW: number;
  nodeMinH: number;
  /** A rect counts as a straddling chip when w>badgeMinW && w<=badgeMaxW && h<=badgeMaxH. */
  badgeMinW: number;
  badgeMaxW: number;
  badgeMaxH: number;
  /** Horizontal-overflow tolerance, user units. */
  tol: number;
}

const DESKTOP: GeometryConfig = {
  rootSelector: ".arch-desktop",
  nodeMinW: 55,
  nodeMinH: 28,
  badgeMinW: 10,
  badgeMaxW: 72,
  badgeMaxH: 20,
  tol: 0.5,
};

const MOBILE: GeometryConfig = {
  rootSelector: ".arch-mobile",
  nodeMinW: 90,
  nodeMinH: 40,
  badgeMinW: 8,
  badgeMaxW: 90,
  badgeMaxH: 24,
  tol: 0.5,
};

/**
 * For every <text> that sits inside a node box, flag it if its rendered
 * bbox spills past that node's left or right edge (beyond `tol`). Chips
 * that intentionally straddle a node border are excluded by centre test.
 */
async function measureOverflow(
  page: Page,
  cfg: GeometryConfig,
): Promise<OverflowViolation[]> {
  return page.evaluate((c: GeometryConfig): OverflowViolation[] => {
    const root = document.querySelector(c.rootSelector);
    const out: OverflowViolation[] = [];
    if (!root) return out;

    for (const svg of Array.from(root.querySelectorAll("svg"))) {
      const rects = Array.from(svg.querySelectorAll("rect")).map((r) => ({
        x: parseFloat(r.getAttribute("x") || "0"),
        y: parseFloat(r.getAttribute("y") || "0"),
        w: parseFloat(r.getAttribute("width") || "0"),
        h: parseFloat(r.getAttribute("height") || "0"),
      }));
      const nodes = rects.filter((r) => r.w >= c.nodeMinW && r.h >= c.nodeMinH);
      const badges = rects.filter(
        (r) => r.w > c.badgeMinW && r.w <= c.badgeMaxW && r.h <= c.badgeMaxH,
      );

      for (const t of Array.from(svg.querySelectorAll("text"))) {
        // getBBox throws on display:none and returns a zero box on
        // non-rendered geometry (e.g. inside <defs>) — skip both.
        let box: DOMRect | undefined;
        try {
          box = t.getBBox();
        } catch {
          continue;
        }
        if (!box || box.width === 0 || box.height === 0) continue;

        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        // CP / ORC / spine ordinal / NEW chips straddle the node border
        // on purpose — exclude any label whose centre lands in a chip.
        const inBadge = badges.some(
          (r) => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h,
        );
        if (inBadge) continue;

        // Containing node = smallest (by area) node rect whose bounds
        // hold the label's centre.
        let node: { x: number; y: number; w: number; h: number } | null = null;
        let best = Infinity;
        for (const r of nodes) {
          if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
            const area = r.w * r.h;
            if (area < best) {
              best = area;
              node = r;
            }
          }
        }
        if (!node) continue; // free-floating annotation, not a node label

        const overflowsLeft = box.x < node.x - c.tol;
        const overflowsRight = box.x + box.width > node.x + node.w + c.tol;
        if (overflowsLeft || overflowsRight) {
          out.push({
            text: (t.textContent || "").trim(),
            fontSize: t.getAttribute("font-size") || "(inherited)",
            width: Math.round(box.width * 100) / 100,
            nodeWidth: node.w,
          });
        }
      }
    }
    return out;
  }, cfg);
}

/**
 * Group straddling chips by identical x|y|w|h. For any group that crosses
 * a node's top edge, require at least one rect in the group to be an
 * opaque 6-digit-hex backing (`#rrggbb`). A group with only translucent
 * `rgba(...)` fills is the "NEW vX" strikethrough bug.
 */
async function measureBadgeBackings(
  page: Page,
  cfg: GeometryConfig,
): Promise<BadgeViolation[]> {
  return page.evaluate((c: GeometryConfig): BadgeViolation[] => {
    const root = document.querySelector(c.rootSelector);
    const out: BadgeViolation[] = [];
    if (!root) return out;

    // An opaque backing is a solid 6-digit hex (e.g. #1c1710); the
    // translucent overlay that straddles the border is rgba(...).
    const opaqueHex = /^#[0-9a-f]{6}$/i;

    for (const svg of Array.from(root.querySelectorAll("svg"))) {
      const rects = Array.from(svg.querySelectorAll("rect")).map((r) => ({
        x: parseFloat(r.getAttribute("x") || "0"),
        y: parseFloat(r.getAttribute("y") || "0"),
        w: parseFloat(r.getAttribute("width") || "0"),
        h: parseFloat(r.getAttribute("height") || "0"),
        fill: (r.getAttribute("fill") || "").trim(),
      }));
      const nodes = rects.filter((r) => r.w >= c.nodeMinW && r.h >= c.nodeMinH);
      const badges = rects.filter(
        (r) => r.w > c.badgeMinW && r.w <= c.badgeMaxW && r.h <= c.badgeMaxH,
      );

      const groups = new Map<string, typeof badges>();
      for (const r of badges) {
        const key = `${r.x}|${r.y}|${r.w}|${r.h}`;
        const g = groups.get(key);
        if (g) g.push(r);
        else groups.set(key, [r]);
      }

      const texts = Array.from(svg.querySelectorAll("text"));
      for (const [key, group] of groups) {
        const b = group[0];
        // Crosses a node top edge = some node's top edge (node.y) sits
        // within the chip's vertical span AND they overlap horizontally.
        const crossesNodeTop = nodes.some(
          (n) =>
            n.y >= b.y - c.tol &&
            n.y <= b.y + b.h + c.tol &&
            b.x < n.x + n.w &&
            b.x + b.w > n.x,
        );
        if (!crossesNodeTop) continue;
        if (group.some((r) => opaqueHex.test(r.fill))) continue;

        // Name the chip by the text whose centre sits inside it.
        let label = "";
        for (const t of texts) {
          let box: DOMRect | undefined;
          try {
            box = t.getBBox();
          } catch {
            continue;
          }
          if (!box || box.width === 0) continue;
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
            label = (t.textContent || "").trim();
            break;
          }
        }
        out.push({ badge: key, label, fills: group.map((r) => r.fill) });
      }
    }
    return out;
  }, cfg);
}

/** Collect the distinct numeric font-size attributes under a root. */
async function measureFontSizes(
  page: Page,
  rootSelector: string,
  allowed: number[],
): Promise<FontSizeAudit> {
  return page.evaluate(
    (c: { rootSelector: string; allowed: number[] }): FontSizeAudit => {
      const root = document.querySelector(c.rootSelector);
      const set = new Set<number>();
      if (root) {
        for (const t of Array.from(root.querySelectorAll("text"))) {
          const fs = t.getAttribute("font-size");
          if (fs !== null && fs.trim() !== "") {
            const n = Number(fs);
            if (!Number.isNaN(n)) set.add(n);
          }
        }
      }
      const distinct = Array.from(set).sort((a, b) => a - b);
      const disallowed = distinct.filter((v) => !c.allowed.includes(v));
      return { distinct, disallowed };
    },
    { rootSelector, allowed },
  );
}

test.describe("architecture diagram — desktop geometry (>=1280w)", () => {
  // Approved desktop font-size scale.
  const ALLOWED_FONT_SIZES = [5.5, 6.5, 7.5, 8, 9];

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/architecture", { waitUntil: "load" });
    // Text metrics depend on the web fonts — wait for them before measuring.
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
  });

  test("no node label overflows its node box horizontally", async ({
    page,
  }) => {
    const violations = await measureOverflow(page, DESKTOP);
    expect(
      violations,
      `Desktop: these node labels overflow their node <rect> horizontally ` +
        `(text · font-size · measured width · node width). Shorten the copy ` +
        `or drop the font-size one step on the approved scale:\n` +
        `${JSON.stringify(violations, null, 2)}`,
    ).toEqual([]);
  });

  test("every border-straddling badge has an opaque backing rect", async ({
    page,
  }) => {
    const violations = await measureBadgeBackings(page, DESKTOP);
    expect(
      violations,
      `Desktop: these chips cross a node's top edge with no opaque backing ` +
        `rect, so the node border strikes through the label (the "NEW vX" ` +
        `strikethrough bug). Add a solid #rrggbb rect behind each chip, ` +
        `beneath its translucent overlay:\n${JSON.stringify(violations, null, 2)}`,
    ).toEqual([]);
  });

  test("font-size attributes stay on the approved scale", async ({ page }) => {
    const { distinct, disallowed } = await measureFontSizes(
      page,
      ".arch-desktop",
      ALLOWED_FONT_SIZES,
    );
    expect(
      disallowed,
      `Desktop: font-size values off the approved scale ` +
        `${JSON.stringify(ALLOWED_FONT_SIZES)}. Snap each to the nearest ` +
        `allowed size. Distinct sizes seen: ${JSON.stringify(distinct)}`,
    ).toEqual([]);
    expect(
      distinct.length,
      `Desktop: too many distinct font sizes (${distinct.length} > 5): ` +
        `${JSON.stringify(distinct)}`,
    ).toBeLessThanOrEqual(5);
  });
});

test.describe("architecture diagram — mobile geometry (390w)", () => {
  // Approved mobile font-size scale.
  const ALLOWED_FONT_SIZES = [9, 11, 13, 15, 17];

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/architecture", { waitUntil: "load" });
    // Expand every band so its SVG is laid out — getBBox throws on the
    // display:none content of a collapsed <details>.
    await page.evaluate(() => {
      document
        .querySelectorAll<HTMLDetailsElement>(".arch-mobile details")
        .forEach((d) => {
          d.open = true;
        });
    });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
  });

  test("no node label overflows its node box horizontally", async ({
    page,
  }) => {
    const violations = await measureOverflow(page, MOBILE);
    expect(
      violations,
      `Mobile: these node labels overflow their node <rect> horizontally ` +
        `(text · font-size · measured width · node width). Shorten the copy ` +
        `or drop the font-size one step on the approved scale:\n` +
        `${JSON.stringify(violations, null, 2)}`,
    ).toEqual([]);
  });

  test("font-size attributes stay on the approved scale", async ({ page }) => {
    const { distinct, disallowed } = await measureFontSizes(
      page,
      ".arch-mobile",
      ALLOWED_FONT_SIZES,
    );
    expect(
      disallowed,
      `Mobile: font-size values off the approved scale ` +
        `${JSON.stringify(ALLOWED_FONT_SIZES)}. Snap each to the nearest ` +
        `allowed size. Distinct sizes seen: ${JSON.stringify(distinct)}`,
    ).toEqual([]);
    expect(
      distinct.length,
      `Mobile: too many distinct font sizes (${distinct.length} > 5): ` +
        `${JSON.stringify(distinct)}`,
    ).toBeLessThanOrEqual(5);
  });
});
