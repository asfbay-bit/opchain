# OpenGraph share cards

One PNG per top-level route. Lookup happens in
`site/src/layouts/Base.astro` (constant `ROUTE_OG_IMAGES`); skill detail
pages currently share `/og/skills.png` until each skill earns its own.

## Current state

| File              | Route          | Status                         |
|-------------------|----------------|--------------------------------|
| `home.png`        | `/`            | generated — branded, 1200×630  |
| `skills.png`      | `/skills`      | generated — branded, 1200×630  |
| `architecture.png`| `/architecture`| generated — branded, 1200×630  |
| `install.png`     | `/install`     | generated — branded, 1200×630  |
| `demo.png`        | `/demo`        | generated — branded, 1200×630  |
| `privacy.png`     | `/privacy`     | generated — branded, 1200×630  |

## How to regenerate

```bash
npm run gen-og
```

Runs `scripts/gen-og-images.mjs` (root-level). Uses `sharp` to rasterize
SVG templates → PNG. Regeneration also runs automatically as part of
`npm run prebuild`.

## How to customise

Edit the `ROUTES` array in `scripts/gen-og-images.mjs`:
- `headline` — large text, centre-left of the card
- `tagline` — smaller descriptor line below

To swap in a fully hand-crafted design: drop a 1200×630 PNG at the
relevant path here and the next build serves it automatically — no code
changes needed.

## Optional follow-up (not yet implemented)

Per-skill OG cards under `/og/skills/<skill-id>.png` keyed off
`Astro.params.id`. Currently every `/skills/<id>` shares `skills.png`.

Backlog: `roadmap/05-post-sprint-7-backlog.md` B-03.
