# opchain navigation & discoverability — proposal

**Branch:** `claude/enhance-site-navigation-TyY5C`
**Status:** PROPOSAL ONLY — no code outside `previews/` has been changed yet.
**Decision needed:** Pick approaches (or pieces of them) to ship. The previews in this directory are scratch HTML for review; once you decide, real changes land in `site/src/`.

---

## Problem

The top nav exposes 5 routes (Home, Architecture, Skill Library, Demo, Install). The site actually ships **15+** pages — `/compare`, `/pipeline-builder`, `/showcase`, `/changelog`, `/glossary`, `/uses`, `/security`, `/status`, `/privacy`, `/404`, `/styleguide` — and they live only in the footer. Result:

- High-intent commercial pages (`/compare`) hide below the fold.
- The most interactive surface (`/pipeline-builder`) is invisible from the nav.
- Trust signals (`/uses`, `/showcase`, `/security`) only reach footer scrollers.
- Mobile drawer reproduces the same 5-link flat list.

## Constraints (from your answers)

- **Fidelity:** pixel-faithful (uses real opchain tokens).
- **Scope:** top bar + in-page nesting + ⌘K palette. No sidebars.
- **Viewports:** desktop primary, key mobile variants.
- **Output:** previews here, code only after you approve.

---

## The 41 changes

Grouped into 10 themes. Each row has a tag `[P-NN]` you can reference in feedback (e.g. "skip P-07, do P-08 differently"). Bold rows have a dedicated preview file.

### A — Top-bar restructure (replace flat 5-link list)

- **[P-01]** Collapse 5 anchors into **4 top-level groups**: `Product`, `Pipeline`, `Resources`, `Install`. Demo/Architecture/Skills/Compare nest under groups instead of competing for top-row real estate. → **preview: `01-top-bar-dropdowns.html`**
- **[P-02]** Each group is a **hover/focus dropdown panel** with label + one-line blurb per child link (not just a wall of link text).
- **[P-03]** `Install` stays a leaf link (call-to-action) and ends the row, visually distinct (filled ember pill).
- **[P-04]** **Active-section indicator**: when you're on `/compare`, the `Product` group lights up its accent border, not just an active link buried inside the dropdown.
- **[P-05]** **Sticky group caret**: dropdown groups carry a small ▾ caret so the affordance is obvious without hover.
- **[P-06]** Keep `Home` reachable through the logo brand-link (already true) and remove it from the link row — the brand IS the home affordance.

### B — In-nav badges & metadata

- **[P-07]** **"new" pill** on changelog/recent-release entries inside the `Product` dropdown — auto-driven from changelog frontmatter `date`. → **preview: `11-header-badges.html`**
- **[P-08]** **"interactive" chip** on `Pipeline Builder` and `Demo` so visitors see at a glance that they're tools, not docs.
- **[P-09]** **Skill count badge** on `Skills` group (e.g. `Skills 14`) — pulled from the skills content collection.
- **[P-10]** **Version chip** on the right of the bar showing the deployed `__OPCHAIN_VERSION__` short SHA, links to `/changelog`. Replaces the standalone release pill on home.

### C — Command palette ⌘K

- **[P-11]** **Global `⌘K` palette** as a centered modal: searches pages, skills, glossary terms, and a small set of actions ("toggle theme", "open feedback", "copy install command"). → **preview: `02-command-palette.html`**
- **[P-12]** Palette is reachable via a **visible pill in the header** (the `⌘K` keycap), not only the shortcut, so non-power-users discover it.
- **[P-13]** **Empty state** suggests 4–6 "popular" jumps: Pipeline Builder, Compare, latest skill, latest changelog entry, install command.
- **[P-14]** **Section grouping** in results: `Pages`, `Skills`, `Glossary`, `Actions`. Each section is collapsible visually (one row of metadata, then rows).
- **[P-15]** **Mobile**: ⌘K becomes a full-screen sheet triggered from a header search icon. → **preview: `09-mobile-palette.html`**

### D — Homepage hero & module rail

- **[P-16]** **"Explore" tile rail** below the hero CTAs — 4 cards linking Compare, Pipeline Builder, Showcase, Uses. Each card carries a one-line claim and a tag (DOC / TOOL / GALLERY). → **preview: `03-home-explore-rail.html`**
- **[P-17]** **Replace** the static `v1.3 release notes` pill with an **auto-rotating "what's new" pill** that cycles the last 3 changelog entries on a 6-second beat (respects reduced-motion).
- **[P-18]** Add a third hero CTA: `compare opchain ›` (ghost variant), sandwiched between primary `install` and outline `walkthrough`. Surfaces /compare directly from the most-trafficked page.
- **[P-19]** **"Made with opchain"** strip under the hero — small attribution row that links `/uses`. Doubles as social proof and a discovery hook.

### E — In-page contextual nesting

- **[P-20]** **`Related` block** at the end of every interior page — 2–3 contextual cards keyed by page. → **preview: `04-related-blocks.html`**
- **[P-21]** **Architecture → `Build your own`** CTA at bottom links to Pipeline Builder.
- **[P-22]** **Architecture → `See it shipped`** mini-strip links Showcase.
- **[P-23]** **Skills index → `Compare with alternatives`** banner above the skill grid.
- **[P-24]** **Skill detail page** grows a "Glossary terms used here" inline strip (small chips, click-through to /glossary anchor).
- **[P-25]** **Skill detail page** grows **prev / next skill** footer-nav (familiar from docs sites).
- **[P-26]** **Install → "Try it without installing"** chip links Demo.
- **[P-27]** **Compare → "Now build yours"** CTA at bottom links Pipeline Builder.
- **[P-28]** **Demo → "Read the architecture"** link in walkthrough sidebar.
- **[P-29]** **Pipeline Builder → "Why these skills?"** link out to Compare from result card.
- **[P-30]** **Glossary cross-linking**: every term mentioned in skill docs becomes a `?` hover-popover with the definition + jump-to link.

### F — Resources & trust surfacing

- **[P-31]** **"Resources" section above the footer** on the home page — three cards: Glossary, Uses, Security. Reduces dependence on footer scroll. → **preview: `05-resources-strip.html`**
- **[P-32]** **`Status` pill** in the header right-cluster (small green dot + "all systems normal") sourced from `/api/health`. Doubles as trust signal + nav.

### G — Footer reorganisation

- **[P-33]** **Reorder footer columns** to mirror top nav: Product, Pipeline, Resources, Trust, Source. Same labels everywhere reduces cognitive load.
- **[P-34]** **Add `Sitemap` link** in the Source column.
- **[P-35]** **Add `/sitemap` page** listing every public page with a one-line description, grouped by section. Belt-and-suspenders for SEO + a11y crawlers. → **preview: `08-sitemap-page.html`**

### H — Cross-page connectors

- **[P-36]** **Breadcrumbs** on `/skills/[id]` (currently the only nested route). Format: `opchain › skills › app-architect`. → **preview: `04-related-blocks.html`** (shown together with related block).
- **[P-37]** **Page-end `What next?` nudge** on long pages (Architecture, Compare): a small sticky-when-scrolled-past-bottom strip showing the next logical destination.

### I — Mobile-specific

- **[P-38]** **Grouped drawer**: replace flat list with collapsible sections matching desktop dropdowns. → **preview: `10-mobile-drawer.html`**
- **[P-39]** **Quick-action chips** at the top of the drawer: `Install`, `Demo`, `Compare` — three primary destinations in one row, before the grouped sections.
- **[P-40]** **Search icon** in mobile header (between burger and feedback) opens the full-screen ⌘K sheet ([P-15]).

### J — Plumbing

- **[P-41]** **Single source of truth** for nav structure: move from inline `defaultLinks` in `Header.astro` to `site/src/data/nav.ts`. Footer + sitemap + ⌘K palette all consume the same tree. Adding a page = touching one file.

---

## Previews → changes map

| Preview file | Changes demonstrated |
|---|---|
| `00-baseline.html` | Current state (today) for side-by-side |
| `01-top-bar-dropdowns.html` | P-01 / P-02 / P-03 / P-04 / P-05 / P-06 / P-12 |
| `02-command-palette.html` | P-11 / P-13 / P-14 |
| `03-home-explore-rail.html` | P-16 / P-17 / P-18 / P-19 |
| `04-related-blocks.html` | P-20 / P-21 / P-22 / P-25 / P-36 |
| `05-resources-strip.html` | P-31 / P-32 |
| `08-sitemap-page.html` | P-33 / P-34 / P-35 |
| `09-mobile-palette.html` | P-15 |
| `10-mobile-drawer.html` | P-38 / P-39 / P-40 |
| `11-header-badges.html` | P-07 / P-08 / P-09 / P-10 |

Open `index.html` for a launcher with thumbnails + descriptions.

---

## What's NOT in scope

- Persistent left/right sidebars (excluded per your "no sidebars" answer).
- Visual redesign of pages — only nav/CTA additions.
- Removing pages or routes — every existing route stays addressable.
- Light-mode previews — defaulted to dark; tokens.css already handles the swap so production code will follow the existing theme protocol.

## Open questions for you (after review)

1. Group naming: do you prefer `Product / Pipeline / Resources` or something like `Learn / Build / Reference`?
2. Should `Install` stay as a leaf-link CTA, or fold into a "Get started" group with Demo?
3. Are you OK adding `/sitemap` as a real page, or skip [P-34]/[P-35]?
4. Status pill ([P-32]) — fine to ping `/api/health` from every page render?
5. ⌘K — palette as Astro island + vanilla JS, or pull in a lib (cmdk-style)?
