# Claude Code Token & Cost Report — 2026-06-28

_Generated 2026-06-28T21:28:27Z · pricing `anthropic-list-2026-06-28` (verified 2026-06-28) · schema `1.1`_

## Totals

- **Sessions (chats):** 6
- **Assistant messages (billable responses):** 317 — deduped from 1,054 content-block lines (see methodology note)
- **Date range (UTC):** 2026-05-26T01:15:35.389000+00:00 → 2026-06-28T21:28:24.683000+00:00

| bucket | tokens |
|---|--:|
| input (fresh) | 106,572 |
| output | 622,538 |
| cache-read | 43,091,629 |
| cache-write | 4,116,125 |
| **total** | **47,936,864** |

**Grand-total est. cost: $73.8408**

> Cache-write is 100% 1-hour ephemeral (4,116,125 tokens), priced at 2.0× input. The four token buckets are kept separate everywhere; cache-read (0.1× input) is **not** merged into fresh input.

## By model

| model | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| claude-opus-4-8 | 91,869 | 433,952 | 28,856,438 | 3,511,955 | 32,894,214 | $60.8559 | 82.41% |
| claude-sonnet-4-6 | 110 | 143,338 | 9,702,073 | 397,129 | 10,242,650 | $7.4438 | 10.08% |
| claude-opus-4-7 | 14,593 | 45,248 | 4,533,118 | 207,041 | 4,800,000 | $5.5411 | 7.50% |
| <synthetic> | 0 | 0 | 0 | 0 | 0 | $0.0000 | 0.00% |

## By chat (session)

| session | first → last (UTC) | dominant branch | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|---|---|--:|--:|--:|--:|--:|--:|--:|
| `ec79f7c4…` | 2026-05-31T02:55:37.144000+00:00 → 2026-05-31T03:43:32.924000+00:00 | `main` | 13,018 | 174,664 | 2,517,753 | 2,909,109 | 5,614,544 | $34.7817 | 47.10% |
| `2e8201ef…` | 2026-05-26T01:15:35.389000+00:00 → 2026-05-31T03:22:25.396000+00:00 | `main` | 23,304 | 125,236 | 17,188,249 | 463,303 | 17,800,092 | $16.4746 | 22.31% |
| `82bd4980…` | 2026-06-28T20:47:19.727000+00:00 → 2026-06-28T21:28:24.683000+00:00 | `claude/silly-tu-56b768` | 23,875 | 112,792 | 9,979,817 | 203,581 | 10,320,065 | $9.9649 | 13.50% |
| `24c401f6…` | 2026-06-05T20:44:39.757000+00:00 → 2026-06-06T01:17:47.998000+00:00 | `design/changelog-layout-options` | 110 | 143,338 | 9,702,073 | 397,129 | 10,242,650 | $7.4438 | 10.08% |
| `bdb6c4f8…` | 2026-06-28T04:18:10.676000+00:00 → 2026-06-28T04:38:08.917000+00:00 | `claude/wizardly-hamilton-8ccf05` | 23,515 | 65,118 | 3,683,989 | 130,678 | 3,903,300 | $4.8943 | 6.63% |
| `6d92b43e…` | 2026-06-28T04:27:57.293000+00:00 → 2026-06-28T04:27:57.293000+00:00 | `claude/nostalgic-wiles-a1b9a8` | 22,750 | 1,390 | 19,748 | 12,325 | 56,213 | $0.2816 | 0.38% |

## By PR

PR resolution: gh CLI (`gh pr list --state all --head <branch>`), local environment. On-`main`/branchless entries are timestamp-correlated to the nearest merged PR within 14 days and tagged `[inferred]`; anything outside that window stays `unattributed` rather than force-fit.

### Per-message attribution

_Each entry's tokens bucketed to the PR matching its own `gitBranch` (or its inferred PR)._

| PR | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| #245 feat(changelog): v1.5/v1.6/v1.7 roadmap + curated static timeline [inferred] | 35,347 | 216,188 | 11,411,467 | 2,993,720 | 14,656,722 | $41.2244 | 55.83% |
| [no PR / non-PR branch] | 46,625 | 114,182 | 9,999,565 | 215,906 | 10,376,278 | $10.2465 | 13.88% |
| #245 feat(changelog): v1.5/v1.6/v1.7 roadmap + curated static timeline | 975 | 83,712 | 8,294,535 | 378,692 | 8,757,914 | $10.0319 | 13.59% |
| #257 design: 4 changelog side-by-side layout options | 78 | 104,138 | 6,487,950 | 286,502 | 6,878,668 | $5.2277 | 7.08% |
| #362 docs(reports): regenerate token report from full local chat history | 23,515 | 65,118 | 3,683,989 | 130,678 | 3,903,300 | $4.8943 | 6.63% |
| #263 design(changelog): round 2-3 layout explorations — bidirectional takeover + full-width tabs | 20 | 15,420 | 2,735,059 | 22,899 | 2,773,398 | $1.1893 | 1.61% |
| #257 design: 4 changelog side-by-side layout options [inferred] | 12 | 23,780 | 479,064 | 87,728 | 590,584 | $1.0268 | 1.39% |

### Session-dominant attribution

_Each session's entire tokens bucketed to the branch appearing in the majority of its entries._

| PR | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| #245 feat(changelog): v1.5/v1.6/v1.7 roadmap + curated static timeline [inferred] | 36,322 | 299,900 | 19,706,002 | 3,372,412 | 23,414,636 | $51.2562 | 69.41% |
| [no PR / non-PR branch] | 46,625 | 114,182 | 9,999,565 | 215,906 | 10,376,278 | $10.2465 | 13.88% |
| #257 design: 4 changelog side-by-side layout options | 110 | 143,338 | 9,702,073 | 397,129 | 10,242,650 | $7.4438 | 10.08% |
| #362 docs(reports): regenerate token report from full local chat history | 23,515 | 65,118 | 3,683,989 | 130,678 | 3,903,300 | $4.8943 | 6.63% |

### Divergence flags (per-PR, modes differ by >20% of est. cost)

_`abs % diff` = |per-message − session-dominant| ÷ the **larger of the two** (i.e. relative to that PR's own attributed cost, **not** total spend). A PR flags when the two attribution modes disagree by >20% on how much to charge it — the signal for a session that sprawled across PRs._

| PR | per-message cost | session-dominant cost | abs % diff |
|---|--:|--:|--:|
| #263 | $1.1893 | $0.0000 | 100.0% |

> These are sessions whose tokens land on different PRs depending on the rule — their attribution is genuinely ambiguous. Here, session `24c401f6` built both #257 and #263; session-dominant assigns all of it to #257, so #263 drops to $0.

## By release

### Canonical (git-tag windows)

_No git tags exist in this repo, so every entry falls in the single `unreleased` window._

| release | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| unreleased | 106,572 | 622,538 | 43,091,629 | 4,116,125 | 47,936,864 | $73.8408 | 100.00% |

### Supplementary (changelog release-commit windows)

_opchain ships via `chore(release): vX.Y` commits, not git tags. This non-canonical view buckets each entry into the window opened by the most recent release commit at its timestamp._

| release | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| v1.4 → v1.6 | 36,432 | 443,238 | 29,408,075 | 3,769,541 | 33,657,286 | $58.7000 | 79.50% |
| v1.7 → HEAD | 70,140 | 179,300 | 13,683,554 | 346,584 | 14,279,578 | $15.1408 | 20.50% |

## Notes & caveats

- **Pricing basis:** current Anthropic list pricing (`anthropic-list-2026-06-28`, verified 2026-06-28 against `skills/oc-claude-api/references/model-routing.md`): fable-5 $10/$50, opus-4-x $5/$25, sonnet-4-x $3/$15, haiku-4-x $1/$5 per MTok (input/output). `claude-opus-4-7` prices at the Opus tier (no separate rate; 4.6/4.7 remain Opus-tier). The pasted prompt block matched this table.
- **Cache pricing** (`skills/oc-claude-api/references/prompt-caching.md`): cache-read 0.10× input; cache-write 1.25× input (5-min TTL) / 2.0× input (1-hour TTL). All cache writes in this dataset are 1-hour.
- **Chat discovery (spec Step 1):** enumerated every `~/.claude/projects/*/*.jsonl` on this machine and kept the 6 whose in-file `cwd` is `/Users/aidanelsesser/repos/opchain` or nested under it — NOT derived from the lossy project-folder name. The manifest is `reports/token-usage/sessions.manifest`.
- **Coverage guarantee:** processed 6/6 manifest files, 0 failed; scanned 1,054 assistant content-block lines → 317 distinct messages → 317 CSV rows (asserted equal). 100% of the manifest, no sampling.
- **Per-message dedup (methodology):** Claude Code logs one JSONL line per assistant *content block* (thinking/text/tool_use), each repeating the message's **cumulative** `usage`. Billing is per message (one `message.id`/`requestId`), so this report counts usage **once per message**. Summing per-line — as a naive reader of the transcript would — inflates the cost-dominant buckets ~14-17× (output 13.9×, cache-write 17×). 0 messages carried a conflicting usage tuple, so the dedup is exact, not an approximation.
- **Live-session caveat:** the most recent transcript (`82bd4980…`) is the session generating this report; it measures itself only up to generation time. The other 5 session(s) are complete.
- **Unpriced models (flagged `$… *`):** <synthetic> — not in the pricing table (e.g. Claude Code `<synthetic>` placeholder turns); tokens counted, cost not estimated.
- Attribution is lossy: on-`main` work is inferred, not hard-linked. All timestamps UTC. Costs are list-price estimates, not a billing statement.
