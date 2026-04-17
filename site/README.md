# opchain-site

Astro 5 app that will replace the current `public/` + `src/` Worker at
cutover (Sprint 6). Today it's a placeholder scaffold.

## Scripts

```bash
cd site
npm install
npm run dev      # astro dev on localhost:4321
npm run build    # astro build → ./dist
npm run check    # astro check (type + content validation)
```

## Roadmap

- Sprint 1: content collections for `skills/*/SKILL.md`, typed catalog.
- Sprint 2: Tailwind 4, design tokens, component library, styleguide page.
- Sprint 3: Intro, Architecture (real), Skill Library, per-skill pages, Install, Try-It shell.
- Sprint 4: Try-It chat ported in with PostHog event tracking.
- Sprint 5: Consent banner, CSP, hardening.
- Sprint 6: Cutover — Astro build replaces the old Worker.

See `roadmap/02-sprint-plan.md` for deliverables.
