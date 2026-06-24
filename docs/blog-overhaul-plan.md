# Blog overhaul plan

> Status: **Wave 1 + Wave 2 shipped.** Page, schema, infra, per-post OG
> automation, and all 11 flagship posts (#1–#11) are live. Remaining: ongoing
> cadence (§9 S5) and the v1.6 release narrative (#12) when v1.6 lands.
>
> Owner: opchain. Authored via `/oc-app-architect`. Last updated 2026-06-24.

## 1. Why

The blog was two thin release-flavored notes (`v1.5 — Build the AI app`,
`Building rag-forge with rag-forge`), both dated the same day, both essentially
changelog commentary. There was no evergreen content, no point of view, nothing
that would make a Claude Code user bookmark the site or a search engine rank it.
The page template matched: a flat card list and a bare prose renderer — no author
identity, reading time, table of contents, related posts, series, or share cards.

For a product whose entire thesis is *"building with AI should be an engineering
discipline, not a vibe,"* the blog was the one surface that didn't demonstrate the
thesis. This overhaul fixes both halves: **the writing** and **the reading
experience**.

## 2. Goals & non-goals

**Primary goals** (chosen with the user):

1. **Developer credibility.** Earn trust with practitioners. Deep, opinionated,
   technical writing that proves opchain is built by people who do real
   engineering. This is the word-of-mouth engine in the Claude Code / AI-dev
   community.
2. **Organic discovery (SEO).** Rank for AI-assisted-development search terms and
   pull in readers who don't know opchain yet. Favors evergreen, keyword-aware,
   genuinely-useful pieces over time-boxed announcements.

These two goals are compatible: the same deep, honest, well-structured post that
earns a developer's respect is also the one Google rewards and that gets cited.
We optimize for **the human first**; SEO is the byproduct of writing the best
resource on a topic, not a separate content stream.

**Non-goals:**

- No CMS. The blog stays static Markdown in `site/src/blog/`, version-controlled,
  reviewed in PRs like code. (Matches the rest of the site and the product ethos.)
- No engagement theater — no comment system, no like buttons, no newsletter popup
  gating content. RSS is the subscription surface.
- Not a news feed. We publish when we have something worth a developer's 8
  minutes, not on a content-calendar quota.

## 3. Audience & positioning

| Reader | Why they're here | What converts them |
|---|---|---|
| Claude Code power user | Hit the "Claude loses the plot between chats" wall | A post that names their exact pain and shows the checkpoint protocol |
| Skeptical senior engineer | Suspicious of "AI coding" hype | An honest engineering deep-dive with real trade-offs and what broke |
| Agency / consultancy lead | Evaluating opchain as a delivery pipeline | A playbook that maps a client engagement onto the skillchain |
| Search visitor | Googled "eval-driven prompt engineering" or similar | An evergreen reference that happens to be built on opchain |

Voice: confident, technical, slightly irreverent, allergic to hype. We show the
seams. The existing dogfooding post's honesty ("the honest version is more
useful, so here it is") is the house style — keep it.

## 4. Content pillars

Four pillars, each with a canonical slug, a badge, and an editorial remit. Every
post declares exactly one `pillar` in frontmatter.

| Pillar | `pillar` value | Badge | Remit | Serves |
|---|---|---|---|---|
| **Engineering** | `engineering` | accent | How opchain is built and dogfooded — the recursion, the hard calls, what broke and why. Highest credibility-per-post. | Credibility |
| **Opinion** | `opinion` | info | Takes on AI-assisted development as a discipline — checkpoints over context windows, eval-driven prompts, the case against vibe coding. Shareable, memorable, citable. | Credibility + reach |
| **Playbook** | `playbook` | success | Practical "ship X with opchain" walkthroughs, end to end. Activation + SEO. Complements (does not duplicate) `/ai-recipes`: recipes are reference cards, playbooks are narrated builds. | SEO + activation |
| **Release** | `release` | neutral | The story behind a release — why these skills, what problem they close. Deeper than `/changelog`. | Existing users |

Pillar mix target over the first 12 posts: **4 engineering, 3 opinion, 3 playbook,
2 release.** Credibility-weighted, because that's the primary goal and the hardest
to fake.

## 5. Editorial slate (backlog)

Flagship posts, prioritized. Each is sized for a single focused read (1,200–2,500
words). The first wave (★) ships with this overhaul.

### Wave 1 — ships now ★

| # | Working title | Pillar | Angle / thesis | Target query |
|---|---|---|---|---|
| 1 | **Why your AI coding agent forgets everything (and what to do about it)** | opinion | The context window is not memory. Checkpoints are. The core opchain insight, argued from first principles. | "claude code loses context", "ai agent memory" |
| 2 | **Evaluate, don't eyeball: putting prompts under test** | engineering | A strong model hides a broken retrieval/prompt. The discipline of eval sets, golden data, and regression gates. | "eval driven prompt engineering", "llm regression testing" |
| 3 | **Ship a RAG answer bot in a week with opchain** | playbook | End-to-end narrated build: stack-forge → rag-forge → app-architect → deploy. Real decisions, real eval numbers. | "build rag app", "rag tutorial claude" |
| 4 | **v1.5 — Build the AI app** (rewrite of existing) | release | Four AI-native skills, why now, what each closes. Tightened, with the "evaluated artifact" through-line. | "claude code ai skills" |
| 5 | **Dogfooding has a stopping point** (rewrite of existing rag-forge note) | engineering | Where eating your own cooking is a quality signal vs. theater. Part of the "Dogfooding opchain" series. | "dogfooding software", "rag when not to use vector db" |

### Wave 2 — shipped ★

| # | Title (as shipped) | Pillar | Angle |
|---|---|---|---|
| 6 | **Why 22 small skills beat one big agent** | opinion | Composable, single-responsibility skills vs. monolithic prompts. Unix philosophy for AI dev. (Title uses the real skill count, 22 — the plan's "18" was stale.) |
| 7 | **Migrating a model version without breaking prod** | playbook | oc-claude-api's migration playbook as a narrated, real upgrade with a diff PR. |
| 8 | **What a checkpoint actually contains** | engineering | Anatomy of `.checkpoint.json` — the schema, why each field exists, how resume works. |
| 9 | **Vibe coding is fine until it isn't** | opinion | The honest boundary between exploratory vibe coding and shippable engineering. |
| 10 | **From Django monolith to shipped in an afternoon** | playbook | reverse-spec → app-architect → deploy on a legacy codebase; migration-ops on the write path. |
| 11 | **How opchain.dev is built with opchain** | engineering | The recursion in full. Part 3 of the "Dogfooding opchain" series. |

### Wave 3 — backlog

| # | Working title | Pillar | Angle |
|---|---|---|---|
| 12 | **v1.6 release narrative** | release | (When v1.6 lands.) |

Each backlog row is a future `/oc-app /oc-build` unit: pick it up, draft, run the
content QA checklist (§8), publish.

## 6. Page & template design

Built on the existing ember/obsidian token system and UI kit (`Card`, `Badge`,
`Eyebrow`, `Pill`). No new design language — this is the brand applied to a
content surface it didn't have yet.

### 6a. Index (`/blog`)

- **Featured hero.** The newest `featured: true` post (fallback: newest overall)
  gets a full-width card with a larger title, description, pillar badge, reading
  time, and date. The "magazine cover" treatment the homepage already uses.
- **Pillar filter.** A row of `Pill` toggles (All / Engineering / Opinion /
  Playbook / Release) that filter the grid client-side (progressive enhancement —
  the full list renders server-side; JS only hides). Each pill shows a count.
- **Rich cards.** Pillar badge, title, description, and a meta line (date ·
  reading time · author). Series posts show a "Series · Dogfooding opchain" tag.
- **RSS** link stays, more prominent.
- Empty/loading/error states: index is static, so only the empty state matters —
  retained.

### 6b. Post (`/blog/<slug>`)

- **Byline block.** Pillar badge · date · reading time · author. `updated` date
  shown when present.
- **Table of contents.** Auto-built from `h2`/`h3` headings via Astro's
  `render()` `headings`. Renders only when a post has ≥3 headings. Sticky on
  desktop, collapsible on mobile.
- **Series navigation.** When `series` is set: "Part N of M · <series name>" with
  prev/next-in-series links.
- **Author bio card** at the foot, from the authors registry (§7).
- **Related posts.** Up to 3, same pillar first, then shared tags, newest first.
- **Prev/next** across the whole blog by date.
- **Share / canonical.** `BlogPosting` JSON-LD (headline, datePublished,
  dateModified, author, image) merged into Base's `@graph`; per-post `ogImage`
  wired through Base for social cards.
- **Reading experience.** Existing `.prose` styles, slightly widened measure for
  long-form, drop-cap-free, generous heading rhythm.

### 6c. Social / OG cards — shipped

Schema gains an `image` field. **Per-post auto-generated OG cards are live**
(Wave 2): `scripts/gen-og-images.mjs` reads each post's frontmatter and emits a
branded `/og/blog/<slug>.png` (title word-wrapped, pillar as an accent eyebrow,
same ember/obsidian template as the route cards). Built with the existing
SVG→`sharp` pipeline rather than adding a Satori/`@vercel/og` dependency.
`[slug].astro` defaults `ogImage` to the per-post card; the shared `/og/blog.png`
remains the index card and the fallback. Cards regenerate every build, so a title
edit can't drift from its share image.

## 7. Infra / schema changes

### Schema (`site/src/content.config.ts`, `blog` collection)

Add **optional** fields only (back-compatible; existing posts keep validating).
Per the file's existing constraint, stick to basic zod methods — no `.default()`,
no `.coerce` (they degrade the inferred type to `never`):

```ts
pillar:   z.enum(["engineering", "opinion", "playbook", "release"]).optional(),
series:   z.string().optional(),
featured: z.boolean().optional(),
updated:  z.string().optional(),   // ISO YYYY-MM-DD
image:    z.string().optional(),   // /og/... path or absolute URL
```

Reading time is **computed**, not stored — word count of `post.body` / 200 wpm.

### New files

- `site/src/data/authors.ts` — author registry (id → name, role, bio, url). Keeps
  bylines DRY and powers the bio card. Single canonical author today (`opchain` →
  "The opchain team"); structured to add more.
- `site/src/lib/blog.ts` — helpers: `readingTime(body)`, `pillarMeta(pillar)`,
  `sortByDate(posts)`, `relatedPosts(post, all)`, `seriesPosts(series, all)`.

### Touched files

- `site/src/pages/blog/index.astro` — redesigned per §6a.
- `site/src/pages/blog/[slug].astro` — redesigned per §6b, adds `BlogPosting`
  JSON-LD + `ogImage`.
- `site/src/pages/blog/rss.xml.ts` — add `<author>`/`<dc:creator>` and
  `<lastBuildDate>`; categories already present.
- `site/src/content.config.ts` — schema additions above.

## 8. Content quality checklist (the "Evaluator" for posts)

Every post passes this gate before publish — the editorial analogue of the build
loop's Evaluator:

- [ ] **Thesis in the first 2 paragraphs.** A reader knows what they'll learn and
      why it's true by the end of the intro.
- [ ] **Shows the seams.** At least one real trade-off, failure, or "here's where
      it stops working" — no glossy fiction.
- [ ] **Concrete over abstract.** Real skill names, real commands, real numbers.
      No "Customer A / B / C", no `[1,2,3]` examples.
- [ ] **Earns its length.** Every section pays for itself; cut anything that's
      throat-clearing.
- [ ] **One clear next action.** Ends with a specific path: install, try a skill,
      read a recipe — never a generic "learn more."
- [ ] **Skimmable.** Headings, lists, and bold carry the spine; the post is
      legible at a scroll.
- [ ] **SEO hygiene.** Title ≤60 chars where possible, description 120–160 chars,
      one target query the post genuinely answers better than what ranks today.
- [ ] **Internal links.** Links to ≥2 relevant skills/pages, naturally.

## 9. Roadmap (sprints)

| Sprint | Scope | Status |
|---|---|---|
| **S1 — Foundation** | Schema additions, authors registry, `lib/blog.ts`, RSS enrichment. | ✅ shipped |
| **S2 — Page redesign** | Index (featured + filter + rich cards) and post template (byline, TOC, series, related, prev/next, bio, JSON-LD). | ✅ shipped |
| **S3 — First content wave** | Rewrite 2 existing posts + 3 new flagship posts (slate #1–#5), all passing §8. | ✅ shipped |
| **S4 — OG automation** | Build-time per-post OG card generation (SVG→sharp, not Satori — reuses the existing pipeline). | ✅ shipped |
| **S5 — Wave-2 content** | Slate #6–#11: 2 opinion, 2 playbook, 2 engineering (one extends the "Dogfooding opchain" series to 3 parts). All passing §8. | ✅ shipped |
| **S6 — Cadence** | Wave-3 backlog (#12+); ~2 posts/month, credibility-weighted. | ongoing |

## 10. Success metrics

- **Leading:** posts published per month; % passing §8 on first review; avg
  words/post in the 1,200–2,500 band.
- **Lagging (90 days):** organic sessions to `/blog/*` (Cloudflare Analytics);
  `/blog` → `/install` click-through; external inbound links / citations; RSS
  subscribers.
- **Qualitative:** does a skeptical senior engineer who reads one post come away
  thinking "these people can actually build"? That's the bar.
