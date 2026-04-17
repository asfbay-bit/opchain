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
  the browser can't reliably send (e.g. `feedback_submitted`, `zip_downloaded`).
- Distinct id is `SHA-256(lowercased email)` — a stable pseudonym so we can
  correlate a user across sessions without storing the raw email in PostHog.

### Dashboards (one-time setup)

Create these in the PostHog UI once the project is live. They rely on the events
already emitted by Worker + client.

1. **Try-It funnel** — `demo_email_submitted` → `demo_chat_started` → `demo_chat_completed`.
   Conversion windows: 1 hour for email → first message, 24 hours for first → completion.
2. **Install intent** — `zip_downloaded` (per-IP pseudonym) over time. Trend with a
   7-day moving average.
3. **Skill breakdown** — `demo_chat_started` broken down by the `skill` property.
   Pie chart + raw table.
4. **Feedback rate** — `feedback_submitted` / unique pageviews, broken down by `type`.
5. **Retention** — 4-week return curve keyed on `$distinct_id`.

Take screenshots and link them in a new `docs/analytics-screenshots/` dir once the
dashboards are up.

## Rollback

If we need to turn everything off quickly:
- Unset `PUBLIC_CF_BEACON_TOKEN` in GitHub secrets → redeploy.
- Unset `POSTHOG_PROJECT_API_KEY` + `PUBLIC_POSTHOG_KEY` → redeploy.
- Clients already have the consent banner; they can opt out without redeploy.
