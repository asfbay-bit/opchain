# Claude Code Token & Cost Report — 2026-06-28

_Generated 2026-06-28T04:34:44+00:00 · pricing `anthropic-list-current-2026-06-26` · schema `1.0`_

## Totals

- **Sessions (chats):** 5
- **Assistant entries:** 879
- **Date range (UTC):** 2026-05-26T01:15:35.389000+00:00 → 2026-06-28T04:34:44.150000+00:00

| bucket | tokens |
|---|--:|
| input (fresh) | 518,848 |
| output | 7,847,574 |
| cache-read | 129,516,091 |
| cache-write | 68,385,464 |
| **total** | **206,267,977** |

**Grand-total est. cost: $936.9547 ***

> Cache-write is 100% 1-hour ephemeral here (68,385,464 of 68,385,464 tokens), priced at 2.0× input. The four token buckets are kept separate everywhere; cache-read is **not** merged into fresh input.

## By model

| model | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| claude-opus-4-8 | 465,556 | 7,375,409 | 99,644,663 | 66,738,630 | 174,224,258 | $903.9216 | 96.47% |
| claude-opus-4-7 | 53,085 | 129,082 | 12,692,274 | 753,207 | 13,627,648 | $17.3707 | 1.85% |
| claude-sonnet-4-6 | 207 | 343,083 | 17,179,154 | 893,627 | 18,416,071 | $15.6624 | 1.67% |
| <synthetic> | 0 | 0 | 0 | 0 | 0 | $0.0000 * | 0.00% |

## By chat (session)

| session | first → last (UTC) | dominant branch | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|---|---|--:|--:|--:|--:|--:|--:|--:|
| `ec79f7c4…` | 2026-05-31T02:55:37.144000+00:00 → 2026-05-31T03:43:32.924000+00:00 | `main` | 279,689 | 6,991,101 | 62,533,613 | 65,627,489 | 135,431,892 | $863.7177 | 92.18% |
| `2e8201ef…` | 2026-05-26T01:15:35.389000+00:00 → 2026-05-31T03:22:33.046000+00:00 | `main` | 77,848 | 344,531 | 42,177,025 | 1,468,019 | 44,067,423 | $44.7712 * | 4.78% |
| `24c401f6…` | 2026-06-05T20:44:39.757000+00:00 → 2026-06-06T01:17:47.998000+00:00 | `design/changelog-layout-options` | 207 | 343,083 | 17,179,154 | 893,627 | 18,416,071 | $15.6624 | 1.67% |
| `bdb6c4f8…` | 2026-06-28T04:18:10.676000+00:00 → 2026-06-28T04:34:44.150000+00:00 | `claude/wizardly-hamilton-8ccf05` | 70,104 | 163,299 | 7,547,307 | 347,029 | 8,127,739 | $11.6769 | 1.25% |
| `6d92b43e…` | 2026-06-28T04:27:57.293000+00:00 → 2026-06-28T04:28:01.220000+00:00 | `claude/nostalgic-wiles-a1b9a8` | 91,000 | 5,560 | 78,992 | 49,300 | 224,852 | $1.1265 | 0.12% |

## By PR

PR resolution: gh CLI (`gh pr list --head <branch> --state all`), local environment.

### Per-message attribution

_Each entry's tokens bucketed to the PR matching its own `gitBranch`._

| PR | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| unattributed (main/no-branch) | 351,073 | 5,527,814 | 77,724,744 | 55,950,880 | 139,554,511 | $736.3888 * | 78.59% |
| #245 feat(changelog): v1.5/v1.6/v1.7 roadmap + curated static timeline | 6,494 | 1,878,831 | 28,082,164 | 11,395,534 | 41,363,023 | $174.9997 | 18.68% |
| claude/wizardly-hamilton-8ccf05 [no PR] | 70,104 | 163,299 | 7,547,307 | 347,029 | 8,127,739 | $11.6769 | 1.25% |
| #257 design: 4 changelog side-by-side layout options | 137 | 232,746 | 10,589,088 | 595,486 | 11,417,457 | $10.2412 | 1.09% |
| #263 design(changelog): round 2-3 layout explorations — bidirectional takeover + full-width tabs | 40 | 39,324 | 5,493,796 | 47,235 | 5,580,395 | $2.5215 | 0.27% |
| claude/nostalgic-wiles-a1b9a8 [no PR] | 91,000 | 5,560 | 78,992 | 49,300 | 224,852 | $1.1265 | 0.12% |

### Session-dominant attribution

_Each session's entire tokens bucketed to the branch appearing in the majority of its entries._

| PR | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| unattributed (main/no-branch) | 357,537 | 7,335,632 | 104,710,638 | 67,095,508 | 179,499,315 | $908.4889 * | 96.96% |
| #257 design: 4 changelog side-by-side layout options | 207 | 343,083 | 17,179,154 | 893,627 | 18,416,071 | $15.6624 | 1.67% |
| claude/wizardly-hamilton-8ccf05 [no PR] | 70,104 | 163,299 | 7,547,307 | 347,029 | 8,127,739 | $11.6769 | 1.25% |
| claude/nostalgic-wiles-a1b9a8 [no PR] | 91,000 | 5,560 | 78,992 | 49,300 | 224,852 | $1.1265 | 0.12% |

### Divergence flags (modes differ by >20% of est. cost)

| PR | per-message cost | session-dominant cost | abs % diff |
|---|--:|--:|--:|
| #263 design(changelog): round 2-3 layout explorations — bidirectional takeover + full-width tabs | $2.5215 | $0.0000 | 100.0% |
| #245 feat(changelog): v1.5/v1.6/v1.7 roadmap + curated static timeline | $174.9997 | $0.0000 | 100.0% |
| #257 design: 4 changelog side-by-side layout options | $10.2412 | $15.6624 | 34.6% |

## By release

| release | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| unreleased | 518,848 | 7,847,574 | 129,516,091 | 68,385,464 | 206,267,977 | $936.9547 * | 100.00% |

## Notes & caveats

- **Pricing basis:** current Anthropic list pricing (anthropic-list-current-2026-06-26) — opus-4-x $5/$25, sonnet-4-x $3/$15, haiku-4-x $1/$5 per MTok (input/output). Models map to a family by name (e.g. `claude-opus-4-8` → `claude-opus-4-x`, `claude-sonnet-4-6` → `claude-sonnet-4-x`). (The prompt's pasted block had the stale Opus-3-era $15/$75 rate; the user selected current rates.)
- **Cache pricing:** cache-read = 0.10× input; cache-write = 1.25× input for 5-minute TTL, 2.0× input for 1-hour TTL. All cache writes in this dataset are 1-hour.
- **No git tags exist**, so every entry falls in the `unreleased` window.
- **Live-session caveat:** 5 transcripts are included. The most recent one is the live session producing this report, so it measures itself only up to the moment of generation (assistant turns spent generating/committing the report afterward are not captured). The other 4 session(s) are complete.
- **Chat coverage (all chats for this repo):** scanned every Claude project dir on this machine resolving to `opchain` — the main checkout plus any linked worktrees under it — 3 dir(s) checked, with session files in: `-Users-aidanelsesser-repos-opchain` (3); `-Users-aidanelsesser-repos-opchain--claude-worktrees-nostalgic-wiles-a1b9a8` (1); `-Users-aidanelsesser-repos-opchain--claude-worktrees-wizardly-hamilton-8ccf05` (1). Entries are deduped across dirs by `entry_id`. Any development chats created on a *different* machine live under a project dir not present on this filesystem and are therefore not included.
- **Unpriced models (flagged, cost shown as `$… *`):** <synthetic> — not in the pricing table; tokens counted, cost not estimated.
- All timestamps UTC. Costs are estimates from list prices, not a billing statement.
