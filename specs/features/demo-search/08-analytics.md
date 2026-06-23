# 08 · Analytics — Demo Workbench Search & Filter

Analytics is **consent-gated PostHog** (client-side), via the existing
`ConsentBanner` + `PUBLIC_POSTHOG_*` wiring. No events fire before consent.
This feature adds a small, privacy-conscious event set so we can see whether
search/filter actually gets used (success metric #5).

## Events

| Event | When | Properties |
|---|---|---|
| `demo_search_performed` | User runs a text query (debounced; one per settled query, not per keystroke) | `query_length` (int), `has_results` (bool), `result_count` (int) |
| `demo_facet_applied` | A facet chip is toggled on | `facet_type` (`skill`\|`role`\|`kind`\|`phase`), `facet_value` (the id), `active_facet_count` (int) |
| `demo_result_opened` | A search result is activated (jump-to-exchange) | `scenario_id`, `step_id`, `via` (`search`\|`facet`) |
| `demo_deeplink_landed` | Page loaded with a `#scenario:step` hash that resolved | `scenario_id`, `step_id`, `had_filters` (bool) |

## Privacy rules

- **Do not capture raw query text.** Only `query_length` + result metadata.
  Free-text queries can contain anything; logging the string is unnecessary
  for the success signal and raises a needless privacy question. (This is a
  deliberate choice — confirm at the spec gate if product wants raw queries;
  default = **off**.)
- `facet_value` is a **closed vocabulary** (skill ids, the 7 roles, canonical
  kinds, phases) — safe to capture; no PII.
- `scenario_id` / `step_id` are public, first-party identifiers.
- All events inherit the site's existing PostHog consent + reverse-proxy
  setup; nothing new is sent server-side.

## Non-goals

- No funnels/dashboards in this feature beyond emitting the events; building
  PostHog insights is an ops follow-up.
- No server-side capture; the Worker is not in this path.
