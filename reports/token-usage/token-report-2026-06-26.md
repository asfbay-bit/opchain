# Claude Code Token & Cost Report — 2026-06-26

_Generated 2026-06-26T23:52:02+00:00 · pricing `anthropic-list-current-2026-06-26` · schema `1.0`_

## Totals

- **Sessions (chats):** 1
- **Assistant entries:** 49
- **Date range (UTC):** 2026-06-26T23:43:36.737000+00:00 → 2026-06-26T23:52:01.833000+00:00

| bucket | tokens |
|---|--:|
| input (fresh) | 33,938 |
| output | 120,488 |
| cache-read | 7,667,528 |
| cache-write | 1,242,386 |
| **total** | **9,064,340** |

**Grand-total est. cost: $19.4395**

> Cache-write is 100% 1-hour ephemeral here (1,242,386 of 1,242,386 tokens), priced at 2.0× input. The four token buckets are kept separate everywhere; cache-read is **not** merged into fresh input.

## By model

| model | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| claude-opus-4-8 | 33,938 | 120,488 | 7,667,528 | 1,242,386 | 9,064,340 | $19.4395 | 100.00% |

## By chat (session)

| session | first → last (UTC) | dominant branch | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|---|---|--:|--:|--:|--:|--:|--:|--:|
| `41037e38…` | 2026-06-26T23:43:36.737000+00:00 → 2026-06-26T23:52:01.833000+00:00 | `claude/token-analysis-prompt-xis8j8` | 33,938 | 120,488 | 7,667,528 | 1,242,386 | 9,064,340 | $19.4395 | 100.00% |

## By PR

PR resolution: github-mcp (gh CLI unavailable).

### Per-message attribution

_Each entry's tokens bucketed to the PR matching its own `gitBranch`._

| PR | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| claude/token-analysis-prompt-xis8j8 [no PR] | 33,938 | 120,488 | 7,667,528 | 1,242,386 | 9,064,340 | $19.4395 | 100.00% |

### Session-dominant attribution

_Each session's entire tokens bucketed to the branch appearing in the majority of its entries._

| PR | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| claude/token-analysis-prompt-xis8j8 [no PR] | 33,938 | 120,488 | 7,667,528 | 1,242,386 | 9,064,340 | $19.4395 | 100.00% |

### Divergence flags (modes differ by >20% of est. cost)

_None — the two attribution modes agree (single session on a single branch; no sessions sprawl across PRs)._

## By release

| release | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| unreleased | 33,938 | 120,488 | 7,667,528 | 1,242,386 | 9,064,340 | $19.4395 | 100.00% |

## Notes & caveats

- **Pricing basis:** current Anthropic list pricing (anthropic-list-current-2026-06-26). `claude-opus-4-8` → `claude-opus-4-x` family at $5.00 input / $25.00 output per MTok. (The prompt's pasted block had the stale Opus-3-era $15/$75 rate; the user selected current rates.)
- **Cache pricing:** cache-read = 0.10× input; cache-write = 1.25× input for 5-minute TTL, 2.0× input for 1-hour TTL. All cache writes in this dataset are 1-hour.
- **No git tags exist**, so every entry falls in the `unreleased` window.
- **Live-session caveat:** the only transcript is the session that produced this report. It necessarily measures itself up to the moment of generation; assistant turns spent generating/committing the report afterward are not captured.
- All timestamps UTC. Costs are estimates from list prices, not a billing statement.
