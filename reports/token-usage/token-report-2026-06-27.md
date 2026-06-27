# Claude Code Token & Cost Report — 2026-06-27

_Generated 2026-06-27T05:09:38+00:00 · pricing `anthropic-list-current-2026-06-26` · schema `1.0`_

## Totals

- **Sessions (chats):** 1
- **Assistant entries:** 146
- **Date range (UTC):** 2026-06-26T23:43:36.737000+00:00 → 2026-06-27T05:09:37.681000+00:00

| bucket | tokens |
|---|--:|
| input (fresh) | 41,680 |
| output | 234,608 |
| cache-read | 38,083,427 |
| cache-write | 2,470,356 |
| **total** | **40,830,071** |

**Grand-total est. cost: $49.8189**

> Cache-write is 100% 1-hour ephemeral here (2,470,356 of 2,470,356 tokens), priced at 2.0× input. The four token buckets are kept separate everywhere; cache-read is **not** merged into fresh input.

## By model

| model | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| claude-opus-4-8 | 41,680 | 234,608 | 38,083,427 | 2,470,356 | 40,830,071 | $49.8189 | 100.00% |

## By chat (session)

| session | first → last (UTC) | dominant branch | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|---|---|--:|--:|--:|--:|--:|--:|--:|
| `41037e38…` | 2026-06-26T23:43:36.737000+00:00 → 2026-06-27T05:09:37.681000+00:00 | `claude/token-analysis-prompt-xis8j8` | 41,680 | 234,608 | 38,083,427 | 2,470,356 | 40,830,071 | $49.8189 | 100.00% |

## By PR

PR resolution: github-mcp (gh CLI unavailable).

### Per-message attribution

_Each entry's tokens bucketed to the PR matching its own `gitBranch`._

| PR | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| claude/token-analysis-prompt-xis8j8 [no PR] | 41,680 | 234,608 | 38,083,427 | 2,470,356 | 40,830,071 | $49.8189 | 100.00% |

### Session-dominant attribution

_Each session's entire tokens bucketed to the branch appearing in the majority of its entries._

| PR | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| claude/token-analysis-prompt-xis8j8 [no PR] | 41,680 | 234,608 | 38,083,427 | 2,470,356 | 40,830,071 | $49.8189 | 100.00% |

### Divergence flags (modes differ by >20% of est. cost)

_None — the two attribution modes agree (single session on a single branch; no sessions sprawl across PRs)._

## By release

| release | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| unreleased | 41,680 | 234,608 | 38,083,427 | 2,470,356 | 40,830,071 | $49.8189 | 100.00% |

## Notes & caveats

- **Pricing basis:** current Anthropic list pricing (anthropic-list-current-2026-06-26). `claude-opus-4-8` → `claude-opus-4-x` family at $5.00 input / $25.00 output per MTok. (The prompt's pasted block had the stale Opus-3-era $15/$75 rate; the user selected current rates.)
- **Cache pricing:** cache-read = 0.10× input; cache-write = 1.25× input for 5-minute TTL, 2.0× input for 1-hour TTL. All cache writes in this dataset are 1-hour.
- **No git tags exist**, so every entry falls in the `unreleased` window.
- **Live-session caveat:** the only transcript is the session that produced this report. It necessarily measures itself up to the moment of generation; assistant turns spent generating/committing the report afterward are not captured.
- **Chat coverage (all chats for this repo):** scanned every Claude project dir resolving to `opchain` across checkout paths — 1 dir(s) checked, with session files in: `-home-user-opchain` (1). Only chats run against this repo in *this* environment are present; historical development chats created on another machine (a different absolute checkout path) live under a different project dir not synced into this ephemeral container. Re-running picks up any that appear, deduped by `entry_id`.
- All timestamps UTC. Costs are estimates from list prices, not a billing statement.
