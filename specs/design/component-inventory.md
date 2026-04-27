# Component Inventory — opchain.dev

This site has **no JS component framework**. "Components" here mean reusable CSS
class patterns + their HTML structure. There are ~18 distinct UI patterns.

---

### Site Header

- **Location:** every page, top of `<body>`
- **Classes:** `.site-header`, `.site-header-inner`, `.logo`, `.nav-scroll`, `.nav`
- **States:** default nav link; `.active` for current route
- **Behavior:** sticky, backdrop-filter blur; horizontally scrollable nav on narrow screens
- **Missing states:** hover is subtle (color only); no pressed state; no focus-visible ring

### Logo / Brand mark

- **Location:** `.site-header .logo` + `.intro-hero-mark` (oversized version on intro page)
- **Props:** text "opchain"
- **Variants:** compact (header, 1.1rem) and hero (`clamp(2.25rem, 7vw, 3.75rem)` with glow)
- **States:** static

### Outline Button (`.btn-outline`)

- **Location:** "Download all skills" on Skill Library, "Install opchain" on Try It complete
- **Props:** link target, inner text
- **States:** default, hover (`background: var(--accent-dim)`)
- **Missing:** focus-visible, disabled, loading

### Primary Button

Two near-identical solid orange buttons:

- `.tryit-gate-btn` — email submit
- `.tryit-send` — chat send
- **States:** default, hover (`opacity: 0.9`), `:disabled` (`opacity: 0.4–0.5`, `cursor: not-allowed`)
- **Missing:** focus-visible ring; loading state is done by text swap (`"Starting…"`), not a spinner

### Search Input

- **Location:** `.search-row input` on Skill Library
- **Props:** placeholder
- **States:** default, focus (accent border + `box-shadow`)
- **Missing:** clear affordance, loading/searching indicator

### Phase Select (compact)

- **Location:** `.phase-field` + `.phase-select` on Skill Library (shown < 640px)
- **Props:** options from `OPCHAIN_PHASES`
- **States:** default, focus (inherits)
- **Missing:** accent treatment on focus

### Phase Pills

- **Location:** `.phase-pills` > `.phase-pill` (shown ≥ 640px)
- **Props:** label, `data-phase`, `aria-pressed`
- **Variants:** default, pressed (`aria-pressed="true"` → accent border + bg)
- **States:** default, hover (color shift), pressed
- **Missing:** focus-visible

### Checkbox row (Tri-agent toggle)

- **Location:** `.tri-row` + `<input type="checkbox" id="tri-only">`
- **States:** unchecked, checked (uses `accent-color: var(--accent)` — browser native style)

### Skill Card

- **Location:** `.skill-card` (rendered by `skills-app.js` for each filtered skill)
- **Props:** `name`, `phaseLabel`, `triAgent`, `short`, `doc` URL
- **Structure:** `<h2>`, 1–2 `.skill-tag` badges, `.skill-desc`, `.skill-actions` link
- **States:** default only (no hover, no clickable card — only the "View docs" link is clickable)
- **Missing:** hover treatment on the whole card, visited state on link

### Skill Tag / Badge

- **Location:** `.skill-tag` inside cards
- **Props:** text
- **Variants:** phase label, "Tri-agent"
- **States:** static

### Meta text

- **Location:** `.meta`, `.tryit-counter`, `.meta#skill-count`
- **Props:** text (often `aria-live="polite"` for dynamic)
- **States:** static

### Email Gate Card

- **Location:** `.tryit-gate` block on Try It, shown only when no session token in `sessionStorage`
- **Structure:** label → form (input + button) → error line
- **States:** idle, submitting (button text swap + disabled), error (`.tryit-error` visible)
- **Missing:** success state (not shown; transitions directly to the app)

### Skill Pill (Try It)

- **Location:** `.tryit-skills` > `.tryit-skill-pill`
- **Props:** `data-skill`, name, `aria-pressed`
- **Variants:** default, selected (pressed)
- **States:** default, hover, pressed
- **Missing:** disabled (when demo complete)

### Chat Container

- **Location:** `.tryit-chat`
- **Props:** scrollable, max-height 28rem
- **Children:** `.tryit-intro`, `.tryit-msg*`
- **States:** empty (intro visible), active (messages), streaming (cursor on last assistant bubble)

### Intro message (in chat)

- **Location:** `.tryit-intro`
- **Props:** skill-specific HTML (from `INTROS`)
- **States:** static italic muted text

### Message Bubble

- **Location:** `.tryit-msg` + `.tryit-msg-label` + `.tryit-msg-content`
- **Variants:**
  - `.tryit-msg--user` — right-aligned, accent solid bg, bottom-right corner tucked
  - `.tryit-msg--assistant` — left-aligned, card bg, bottom-left corner tucked
- **States:** default, `.tryit-streaming` (blinking cursor on assistant bubble)
- **Markdown rendering:** renderMarkdown renders H1–H4, **bold**, *italic*, lists (ul/ol), inline + fenced code, paragraphs. HTML is escaped first; code blocks/inline are extracted before regex passes to avoid double-escape.

### Starter Chips

- **Location:** `.tryit-starters` > `.tryit-starter`
- **Props:** text (from `STARTERS[skillId]`)
- **States:** default, hover (accent border + bg)
- **Behavior:** clicking fills the input and auto-sends
- **Missing:** disabled state; focus ring

### Chat Input Row

- **Location:** `.tryit-input-row` > textarea + button
- **States:** idle, sending (disabled + opacity), empty (send still disabled)
- **Behavior:** auto-resize up to 120px; Enter submits, Shift+Enter newline

### Exchange Counter

- **Location:** `.tryit-counter`
- **Props:** text, hidden boolean
- **States:** visible showing "N of 5 exchanges remaining"; "No exchanges remaining" when done

### Complete CTA

- **Location:** `.tryit-complete`
- **Structure:** title, body, outline button linking to `/install.html`
- **States:** hidden by default; shown when remaining ≤ 0

### Code Block / Inline Code (in assistant output)

- **Location:** `.tryit-code` (block) and `.tryit-inline-code`
- **States:** static
- **Missing:** language label, copy button

---

## JS modules (client)

| File | Exports | Purpose |
|---|---|---|
| `public/skills.js` | `window.OPCHAIN_SKILLS`, `window.OPCHAIN_PHASES` | Data catalogue (10 skills, 5 phases) |
| `public/skills-app.js` | IIFE, no exports | Renders Skill Library filter + cards |
| `public/tryit.js` | IIFE, no exports | Email gate, skill selection, streaming chat, markdown render |

## HTML pages (static)

| Page | Purpose | Total LOC |
|---|---|---|
| `index.html` | Introduction + hero | 44 |
| `architecture.html` | **Stub** — one paragraph of prose | 34 |
| `skills.html` | Skill Library with filter panel | 58 |
| `install.html` | **Stub** — one paragraph of prose | 33 |
| `tryit.html` | Email-gated AI demo | 78 |

## Gaps

- **No shared focus-visible treatment.** A single `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }` would fix it everywhere.
- **No hover on skill cards** — only the "View docs" link is interactive; the card itself looks clickable but isn't.
- **`architecture.html` and `install.html` are stubs.** They each say "see the Skill Library" or "copy the folder" — worth expanding to real content or converting to a section of the Introduction page.
- **Skill cards don't show the trigger keyword** (e.g. `/discover`). Users have to click through to see it.
- **Client markdown renderer** is bespoke, ~60 lines of regex. Small surface, but any future issue with LLM output will require touching it.
- **No dedicated loading skeleton** for the skill list (renders instantly from static data, so not urgent).
- **No empty state visual.** "No skills match these filters." is plain muted text.
