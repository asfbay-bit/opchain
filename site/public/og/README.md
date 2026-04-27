# OpenGraph share cards

One PNG per top-level route. Lookup happens in
`site/src/layouts/Base.astro` (constant `ROUTE_OG_IMAGES`); skill detail
pages currently share `/skills.png` until each skill earns its own.

| File              | Route          | Status                                          |
|-------------------|----------------|-------------------------------------------------|
| `home.png`        | `/`            | placeholder — copy of `/og-image.png`           |
| `skills.png`      | `/skills`      | placeholder — copy of `/og-image.png`           |
| `architecture.png`| `/architecture`| placeholder — copy of `/og-image.png`           |
| `install.png`     | `/install`     | placeholder — copy of `/og-image.png`           |
| `demo.png`        | `/demo`        | placeholder — copy of `/og-image.png`           |
| `privacy.png`     | `/privacy`     | placeholder — copy of `/og-image.png`           |

Replace any placeholder with a real 1200×630 PNG, drop it in here, and
the next build serves it automatically — no code changes needed.

Backlog: `roadmap/05-post-sprint-7-backlog.md` B-03.
