# Analytics

Two signals. Neither collects PII.

## Cloudflare Web Analytics — traffic beacon

- Cookieless. No consent gate (it collects no personal data).
- Loaded in `site/src/layouts/Base.astro` when `PUBLIC_CF_BEACON_TOKEN` is set at build.
- Token lives in the Cloudflare dashboard; copy it into the GitHub Actions secret
  `PUBLIC_CF_BEACON_TOKEN` so CI builds pick it up.
- Gives us pageviews, referrers, countries. Nothing more.

## PostHog — funnel + retention

- Consent-gated (see `site/src/components/ConsentBanner.astro`). Declining means no
  SDK load, no cookies, no events.
- Server-side capture also runs from the Worker (`src/lib/analytics.js`) for events
  the browser can't reliably send (`feedback_submitted`, `notify_submitted`,
  `zip_downloaded`).
- Distinct id is `SHA-256(lowercased email)` for events that have an email
  (`feedback_submitted`, `notify_submitted`); for `zip_downloaded` it's
  `SHA-256("ip:" + CF-Connecting-IP)`. Both are stable pseudonyms — the raw
  email/IP never lands in PostHog.

### Live event taxonomy

| Event | Source | Trigger |
|---|---|---|
| `$pageview` | client (autocapture) | Every navigation, post-consent |
| `notify_submitted` | server | `POST /api/notify` 2xx (CaptureModal lead) |
| `feedback_submitted` | server | `POST /api/feedback` 2xx |
| `zip_downloaded` | server | `GET /skills/*.zip` or `/opchain-skills.zip` 2xx |
| `install_copy_clicked` | client | Copy button on `/install`; `flow` property = which flow |

Reserved (declared in `site/src/lib/analytics.ts` but not yet wired):
`skill_filter_used`, `skill_detail_viewed`, `in_action_scenario_opened`. Don't
build dashboards on these until call sites exist.

### Dashboards (one-time setup)

Create these in the PostHog UI once the project is live. They rely only on
events that are actually being emitted today.

1. **Lead funnel** — `$pageview` (any) → `notify_submitted`. Conversion window:
   30 min. Break `notify_submitted` down by the `source` property (which page
   the modal opened from).
2. **Install intent** — `zip_downloaded` over time, with a 7-day moving average.
   Break down by `path` to separate per-skill `.zip` downloads from the combined
   bundle.
3. **Install CTA efficacy** — `install_copy_clicked` broken down by `flow`. Pair
   with `zip_downloaded` to see which flow converts.
4. **Feedback rate** — `feedback_submitted` / unique pageviews, broken down by
   `type` (bug / feature / improvement) and `skill`.
5. **Retention** — 4-week return curve keyed on `$distinct_id`. Most useful for
   identified leads (post `notify_submitted`).

Take screenshots and link them in a new `docs/analytics-screenshots/` dir once
the dashboards are up.

## Rollback

If we need to turn everything off quickly:
- Unset `PUBLIC_CF_BEACON_TOKEN` in GitHub secrets → redeploy.
- Unset `POSTHOG_PROJECT_API_KEY` + `PUBLIC_POSTHOG_KEY` → redeploy.
- Clients already have the consent banner; they can opt out without redeploy.
