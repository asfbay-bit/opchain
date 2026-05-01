# Design System — opchain.dev

Extracted from `public/styles.css` (669 lines) and the 5 HTML pages in `public/`.

## Tokens

### Color palette

All colors are defined as CSS custom properties on `:root` (`styles.css` L1–L10).

| Token | Hex / value | Role |
|---|---|---|
| `--bg` | `#0c0a08` | App background (near-black, warm undertone) |
| `--surface` | `#1a1510` | Panels (library panel, chat container, gate card) |
| `--card` | `#221c16` | Interior surfaces (cards, inputs, chat bubbles from the assistant) |
| `--border` | `#3d3228` | Subtle 1px border for cards and inputs |
| `--text` | `#f4ede4` | Primary text (warm off-white) |
| `--muted` | `#a89888` | Secondary text, nav items, placeholders |
| `--accent` | `#e8945c` | Warm orange — links, active nav, primary buttons, brand hero |
| `--accent-dim` | `rgba(232, 148, 92, 0.2)` | Hover + pressed backgrounds |

Semantic colors hardcoded (no token):

| Usage | Value | Location |
|---|---|---|
| Error text | `#e85c5c` | `.tryit-error`, `.tryit-error-inline` |

### Typography

| Axis | Value | Source |
|---|---|---|
| Font family | `system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif` | `body` L26–L32 |
| Base size | `15px` | `body` L31 |
| Base line-height | `1.5` | `body` L30 |
| H1 (pages) | `1.5rem`, `font-weight: 700` | `.page-head h1`, `.intro-page h1` |
| H2 (skill cards) | `1.05rem` | `.skill-card h2` |
| Intro hero | `clamp(2.25rem, 7vw, 3.75rem)`, weight `800`, `letter-spacing: -0.04em` | `.intro-hero-mark` |
| Intro tagline | `0.8rem`, weight `600`, uppercase, `letter-spacing: 0.1em` | `.intro-tagline` |
| Nav links | `0.85rem`, weight `500` | `.nav a` |
| Tags / pills | `0.65rem–0.72rem`, weight `700`, uppercase, `letter-spacing: 0.04–0.06em` | `.skill-tag`, `.phase-pill`, `.tryit-skill-pill` |
| Body meta | `0.8rem`, muted | `.meta`, `.tryit-counter` |
| Message content | `0.9rem`, line-height `1.55` | `.tryit-msg-content` |

**Font-weight scale observed:** 400 (default), 500 (nav), 600 (intro body bold, phase
select), 700 (h1/h2, tags, buttons), 800 (logo, hero).

### Spacing

No declared base grid unit; spacing is in `rem` increments. Common values:

- Micro: `0.2rem`, `0.25rem`, `0.35rem`, `0.4rem`
- Small: `0.5rem`, `0.6rem`, `0.65rem`, `0.7rem`, `0.75rem`
- Medium: `0.85rem`, `1rem`, `1.25rem`, `1.5rem`
- Large: `2rem`, `3rem`
- Container max-width: `960px` (`.site-header-inner`, `main`)
- Text column max-width: `42rem` (`.intro-tagline`, `.intro-body`, prose paragraphs)
- Gate card max-width: `28rem`
- Chat max-height: `28rem`

### Radius

| Token (implicit) | Value | Usage |
|---|---|---|
| Chip/badge | `4px` | `.skill-tag` |
| Inline code | `3px` | `.tryit-inline-code` |
| Field / button / card | `8px` | Inputs, outline button, starter chip, send button |
| Card large | `10px`, `12px` | `.skill-card`, `.tryit-chat`, `.library-panel`, `.tryit-gate` |
| Pill | `999px` | `.phase-pill`, `.tryit-skill-pill` |
| Asymmetric bubbles | `border-bottom-{right,left}-radius: 3px` on last corner | `.tryit-msg-content` user vs assistant |

### Effects

- Header backdrop-filter: `blur(12px)` with semi-transparent bg (`rgba(12, 10, 8, 0.92)`).
- Hero text-shadow: `0 0 42px rgba(232, 148, 92, 0.45)` (warm glow on the `opchain` mark).
- Focus ring: `box-shadow: 0 0 0 2px var(--accent-dim)` + accent border (inputs).
- Streaming cursor: `animation: tryit-blink 0.6s steps(2) infinite`.

### Breakpoints

Only **one** responsive breakpoint:

- `@media (min-width: 640px)` — switches phase filter from a `<select>` to wrapping pills
  (`styles.css` L265–L270).

Everything else is fluid or uses `max-width: 42rem`/`960px` constraints.

### Icons

No icon library. No `<svg>` tags in any HTML. Text-only UI.

## Layout patterns

### Page shell

Every page uses the same top-level structure:

```html
<header class="site-header">
  <div class="site-header-inner">
    <div class="logo">opchain</div>
    <nav class="nav-scroll">
      <div class="nav">
        <a href="/">Introduction</a>
        <a href="/architecture.html">Architecture</a>
        <a href="/skills.html">Skill Library</a>
        <a href="/install.html">Install</a>
        <a href="/tryit.html">Try It</a>
      </div>
    </nav>
  </div>
</header>
<main>
  ...
</main>
```

Active route marked with `class="active"` on the corresponding `<a>` (hand-maintained
per page).

### Intro page

Custom composition with tagline → hero mark → body prose, all centered within the
`main` container's text column (`.intro-page`, `.intro-tagline`, `.intro-hero`,
`.intro-body`).

### Skill Library page

Filter panel (`.library-panel`) containing:
- Search input.
- Phase field (`<select>` on narrow, hidden in favor of `.phase-pills` at ≥640px).
- Tri-agent-only checkbox.
- Results count (`aria-live="polite"`).

Followed by `.skill-list` — a vertical flex column of `.skill-card` elements
populated client-side by `skills-app.js`.

### Try It page

Two-state UI:
1. **Gate** (`.tryit-gate`): email form, 28rem wide card.
2. **App** (`.tryit-app`): skill pills → chat (`.tryit-chat` scrolling container) →
   starter chips → input row → counter → complete CTA.

Chat bubbles right-aligned for user (warm orange background), left-aligned for
assistant (dark card with border).

## Motion / animation

Only one keyframe animation: `tryit-blink` (on the streaming cursor).

## Accessibility observations

- `visually-hidden` utility class for screen-reader-only labels (`styles.css` L12–L22).
- Phase filter has `aria-label` and `aria-live` for the count.
- Skill pills use `aria-pressed` for toggle state.
- Form inputs in the gate are `required` + `autocomplete="email"`.
- No skip-to-main-content link.
- No explicit focus-visible styles (relies on browser defaults + `:focus` box-shadow on inputs).
- Color contrast: `--text` on `--bg` is ~14:1 (passes WCAG AAA); `--muted` on `--bg` is ~5.8:1 (passes AA).
  Accent (`#e8945c`) on `--bg` is ~7.5:1 (passes AAA).

## Confidence

HIGH across the board — all tokens and patterns are directly observable in a single
CSS file.

## Gaps

- **No design tokens exported as JSON/JS.** If the Worker or a server-side renderer
  ever needs to know the brand orange, it has to re-read the CSS.
- **No dark/light theme toggle.** The site is dark-only. This is intentional but
  undocumented.
- **No focus-visible ring** on buttons (`.btn-outline`, `.tryit-gate-btn`,
  `.tryit-send`, pills). Keyboard users get inconsistent affordances.
- **One-off error color `#e85c5c`** not tokenized.
- **No styleguide page** — there's no `/styles.html` or similar showing the tokens.
