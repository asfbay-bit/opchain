# B-10: Color-Contrast Audit — Hand-off to UX Session

**Generated:** 2026-04-29
**Source:** `site/src/styles/tokens.css` (token values as of HEAD `c18978b`)
**Method:** WCAG 2.1 relative-luminance contrast ratio computed for every
`fg × bg` token pair. Threshold reference:

- **AA normal text:** ratio ≥ 4.5
- **AA large text / UI components:** ratio ≥ 3.0
- **Hard fail:** ratio < 3.0 (fails even the relaxed UI threshold)

This file exists because B-10 (color-contrast sweep across `/`, `/skills`,
`/demo`) was found to be almost entirely token-level work during the
2026-04-29 audit. Per the original B-10 DoD ("Token offenders: coordinate
with the UX-pass session on the colour core. Don't unilaterally darken/
lighten — tokens drive the whole site"), the orchestrator paused before
making any changes and dumped findings here for the user-owned UX pass to
resolve.

The Axe disables in `site/tests/e2e/routes.spec.ts` (B-11) cannot be
removed until at least the **hard fails** below are cleared.

---

## Dark theme — fg × bg ratios

```
fg \ bg          bg      ribbon  surface card
text             13.48✓  12.84✓  11.86✓  12.70✓
muted            9.07✓   8.64✓   7.98✓   8.54✓
subtle           4.21△   4.01△   3.71△   3.97△
accent           4.84✓   4.62✓   4.26△   4.56✓
accent-hover     3.30△   3.15△   2.91✗   3.11△
info             3.74△   3.57△   3.29△   3.52△
success          7.02✓   6.69✓   6.18✓   6.61✓
danger           5.03✓   4.79✓   4.42△   4.73✓
warning          9.01✓   8.59✓   7.93✓   8.49✓
in-progress      9.82✓   9.36✓   8.64✓   9.25✓
```

## Light theme — fg × bg ratios

```
fg \ bg          bg      ribbon  surface card
text             15.17✓  12.87✓  14.38✓  17.81✓
muted            7.28✓   6.18✓   6.90✓   8.55✓
subtle           3.69△   3.13△   3.50△   4.34△
accent           3.50△   2.97✗   3.32△   4.11△
accent-hover     5.22✓   4.43△   4.95✓   6.13✓
info             6.45✓   5.48✓   6.12✓   7.58✓
success          4.67✓   3.97△   4.43△   5.48✓
danger           4.99✓   4.24△   4.73✓   5.86✓
warning          4.25△   3.61△   4.03△   4.99✓
```

Legend: ✓ ≥ 4.5 (AA normal)  △ ≥ 3.0 (AA large/UI only)  ✗ < 3.0 (hard fail)

---

## Hard fails (must fix to remove `COLOR_CONTRAST_DISABLE`)

Two combos fall below 3.0 — these fail Axe even for large text and UI
elements, and are the highest-priority items for the UX pass.

| Theme | fg | bg | Ratio | Likely usage |
|---|---|---|---|---|
| Dark  | `--accent-hover` (`#b84510`) | `--surface` (`#2a2218`) | **2.91** | Hovered button/link inside cards, ribbon CTAs |
| Light | `--accent` (`#d95010`)       | `--ribbon` (`#eed8bc`)  | **2.97** | Eyebrow text, pill labels, hero accents on the ribbon strip |

### Suggested minimums (UX session decides)

If the design intent is to keep the ember orange as the accent, the
minimum mechanical fix is:

- **Dark:** push `--accent-hover` lighter (e.g. `#d05518` instead of
  `#b84510`) — but this collides with the visual "hover = darker" mental
  model. Alternative: forbid `accent-hover` on top of `--surface`; force
  it to use `--bg` or `--ribbon` instead (3.30 / 3.15 — still △, not ✓).
- **Light:** darken `--accent` toward `#b84510` (would yield ~4.4 on
  ribbon) or shift `--ribbon` one notch lighter. Either decision propagates
  through the homepage hero, eyebrows, and `--logo-filled`.

These are visual-identity calls. Do not auto-apply.

---

## AA-normal fails (broader sweep, lower urgency)

The following combos pass the AA-large threshold (3.0) but fail AA-normal
(4.5). These are real WCAG misses for body-copy or small-label use, but
Lighthouse weighting still keeps the page scores at 0.96 — they pass the
LHCI 0.95 floor.

**Dark theme:**

- `--subtle` on every bg (3.71–4.21) — used in `.eyebrow`, secondary
  metadata, footer copy. Either bump `--subtle` toward `#9d8b78` (would
  reach ~4.7 on `--bg`) or restrict its use to large-text contexts only.
- `--accent` on `--surface` (4.26) — affects accent text inside cards.
  Switching to `--accent` on `--bg` (4.84 ✓) is the cheapest fix.
- `--accent-hover` on bg/ribbon/card (3.11–3.30) — see hard-fail note.
- `--info` on every bg (3.29–3.74) — currently `#64748B` (Tailwind slate-500).
  Bumping to `slate-400` (`#94A3B8`) yields ~5.5 on `--bg`.
- `--danger` on `--surface` (4.42) — borderline; same trick as accent.

**Light theme:**

- `--subtle` on every bg (3.13–4.34) — `--subtle: #8c7657` is the worst
  on `--ribbon` (3.13).
- `--accent` on bg/surface/card (3.32–4.11) — see hard-fail note.
- `--accent-hover` on `--ribbon` (4.43) — borderline.
- `--success` on `--ribbon` (3.97), `--surface` (4.43) — `#047857` already
  quite dark; consider deeper green like `#065F46`.
- `--warning` on every bg (3.61–4.25) — `#4d7c0f` is olive-green; would
  need to go darker to clear AA normal.

---

## Recommended approach for the UX session

1. Decide whether the brand wants ember-orange to remain the accent at
   `#e05c18`/`#d95010`. If yes, the contrast deficit must come out of
   the **backgrounds**, not the accent — i.e. shift `--surface` darker
   in dark theme and `--ribbon` lighter in light theme.
2. Decide whether `--subtle` should remain a `△` (AA-large only) token.
   If yes, document that constraint inline in `tokens.css` and audit
   every `--subtle` usage to confirm it's only used at ≥18px or for
   non-essential metadata. If no, push it toward `#9d8b78` / `#6e5c40`.
3. The remaining narrow misses (`info`, `success`, `warning` on
   surfaces) should be solved as a batch: nudge each foreground until
   it clears 4.5 on `--ribbon` (the worst-case bg in both themes).
4. After token values land, re-run this audit to confirm zero
   hard-fails and zero AA-normal fails on the canonical bg set.
5. Then close B-10 and proceed to B-11 (drop `COLOR_CONTRAST_DISABLE`
   plus the per-rule disables for `link-in-text-block`, `label`,
   `nested-interactive`).

---

## How to re-run this audit

The contrast-ratio script lives inline in this PR's commit message and
can be regenerated from any tokens.css with a small Node script:

```js
function srgb(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
function lum(hex) {
  const h = hex.replace("#", "");
  return 0.2126 * srgb(parseInt(h.slice(0,2),16))
       + 0.7152 * srgb(parseInt(h.slice(2,4),16))
       + 0.0722 * srgb(parseInt(h.slice(4,6),16));
}
function ratio(fg, bg) {
  const a = lum(fg), b = lum(bg);
  return ((Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05)).toFixed(2);
}
```

The full Playwright/Axe audit (which would also catch component-local
offenders the token analysis misses) lives in `site/tests/e2e/routes.spec.ts` —
temporarily delete the `COLOR_CONTRAST_DISABLE` entries and run
`cd site && npm run test:e2e` to surface the actual selector list.
