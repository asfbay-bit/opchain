# opchain — Token & Cost Report (2026-07-10)

_Generated 2026-07-10T00:00:00Z · schema `1.1` · pricing `oc-claude-api@2026-07-10` (verified 2026-07-10)_

## Totals

| bucket | tokens |
|---|--:|
| input (fresh) | 5,060,626 |
| output | 3,805,951 |
| cache read | 365,736,532 |
| cache write | 22,430,767 |
| **total** | **397,033,876** |

**Grand-total est. cost: $649.59**

- **Sessions:** 27 · **assistant API responses:** 3,214 · **window:** 2026-05-26 → 2026-07-10 (UTC)
- Cache-read is **92.1%** of all tokens but a small fraction of cost (0.1× input). The four buckets are never collapsed.
- Cache-writes split by TTL: **11,825,965** at 1.25× (5-min) and **10,604,802** at 2.0× (1-hour), read from `usage.cache_creation`.
- `service_tier` is `standard` on every entry — **no Batch API discount** applied.
- Deduped **6,884 raw transcript lines → 2,999 unique `message.id`** this run (2.3× inflation avoided).

## By model

| model | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|---|---|---|---|---|---|---|
| `claude-fable-5` | 3,917,626 | 1,153,942 | 91,093,770 | 10,888,022 | 107,053,360 | $342.55 | 52.73% |
| `claude-opus-4-8` | 1,128,297 | 2,463,423 | 260,407,571 | 10,938,575 | 274,937,866 | $294.06 | 45.27% |
| `claude-sonnet-4-6` | 110 | 143,338 | 9,702,073 | 397,129 | 10,242,650 | $7.44 | 1.15% |
| `claude-opus-4-7` **[unpriced]** | 14,593 | 45,248 | 4,533,118 | 207,041 | 4,800,000 | $5.54 | 0.85% |
| `<synthetic>` **[unpriced]** | 0 | 0 | 0 | 0 | 0 | $0.00 | 0.0% |

> `<synthetic>` carries 0 tokens (Claude Code local placeholder messages) — cost-neutral.
> `claude-opus-4-7` is **[unpriced]** in the current `model-routing.md` table (listed as active-if-pinned, no rate given).
> Its $5.54 is carried verbatim from the earlier `anthropic-list-2026-06-28` epoch. Re-verify before quoting externally.

## By chat (session)

| session | dominant branch · window (UTC) | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|---|---|---|---|---|---|---|---|
| `cb2ab85f` | `claude/pensive-hawking-1775f3` · 2026-07-04 23:44 → 2026-07-05 04:39 | 3,873,451 | 1,048,721 | 76,594,230 | 9,055,681 | 90,572,083 | $265.83 | 40.92% |
| `aed554b9` | `claude/arch-diagram-layout-audit` · 2026-07-08 21:13 → 2026-07-10 00:33 | 533,756 | 1,060,216 | 122,745,858 | 4,403,279 | 128,743,109 | $122.58 | 18.87% |
| `86cff5ec` | `claude/vigilant-rhodes-6ebe72` · 2026-07-02 23:59 → 2026-07-04 23:56 | 32,701 | 228,767 | 41,275,196 | 2,097,400 | 43,634,064 | $94.99 | 14.62% |
| `ec79f7c4` | `main` · 2026-05-31 02:55 → 2026-05-31 03:43 | 13,018 | 174,664 | 2,517,753 | 2,909,109 | 5,614,544 | $34.78 | 5.35% |
| `2e8201ef` | `main` · 2026-05-26 01:15 → 2026-05-31 03:22 | 23,304 | 125,236 | 17,188,249 | 463,303 | 17,800,092 | $16.47 | 2.54% |
| `82bd4980` | `claude/silly-tu-56b768` · 2026-06-28 20:47 → 2026-06-28 21:41 | 100,323 | 143,028 | 15,568,679 | 453,631 | 16,265,661 | $15.64 | 2.41% |
| `3119fc94` | `claude/determined-maxwell-019a92` · 2026-07-06 15:40 → 2026-07-06 23:47 | 24,734 | 98,972 | 8,465,005 | 567,268 | 9,155,979 | $12.50 | 1.92% |
| `9d461922` | `claude/friendly-elgamal-575049` · 2026-07-03 14:07 → 2026-07-03 14:32 | 25,576 | 100,295 | 11,513,957 | 199,571 | 11,839,399 | $10.39 | 1.6% |
| `3994fb80` | `claude/unruffled-kare-fbabf7` · 2026-06-29 14:07 → 2026-06-29 14:24 | 24,711 | 68,839 | 10,372,678 | 324,518 | 10,790,746 | $10.28 | 1.58% |
| `f484218c` | `claude/funny-bun-28f4f4` · 2026-07-01 14:07 → 2026-07-01 14:32 | 29,609 | 93,166 | 10,125,324 | 190,096 | 10,438,195 | $9.44 | 1.45% |
| `4f6667ef` | `claude/sad-villani-ed1aba` · 2026-06-30 04:16 → 2026-06-30 05:18 | 25,447 | 93,475 | 9,453,150 | 203,941 | 9,776,013 | $9.23 | 1.42% |
| `b7345019` | `claude/distracted-morse-689db5` · 2026-07-09 14:06 → 2026-07-09 14:34 | 25,376 | 101,143 | 8,824,310 | 176,081 | 9,126,910 | $8.83 | 1.36% |
| `24c401f6` | `design/changelog-layout-options` · 2026-06-05 20:44 → 2026-06-06 01:17 | 110 | 143,338 | 9,702,073 | 397,129 | 10,242,650 | $7.44 | 1.15% |
| `150261f6` | `claude/zen-lewin-0d3126` · 2026-07-04 16:22 → 2026-07-04 16:38 | 24,234 | 58,933 | 4,686,721 | 121,690 | 4,891,578 | $5.15 | 0.79% |
| `5b986f55` | `claude/strange-gagarin-93fd80` · 2026-07-02 14:07 → 2026-07-02 14:20 | 24,671 | 50,142 | 4,233,053 | 147,547 | 4,455,413 | $4.97 | 0.76% |
| `bdb6c4f8` | `claude/wizardly-hamilton-8ccf05` · 2026-06-28 04:18 → 2026-06-28 04:38 | 23,515 | 65,118 | 3,683,989 | 130,678 | 3,903,300 | $4.89 | 0.75% |
| `67b6fc5d` | `claude/focused-noyce-8d3046` · 2026-06-30 14:14 → 2026-06-30 14:28 | 23,222 | 32,799 | 3,144,935 | 109,854 | 3,310,810 | $3.61 | 0.56% |
| `5c9508db` | `claude/nifty-northcutt-4f1f9c` · 2026-07-10 14:04 → 2026-07-10 14:12 | 24,740 | 40,865 | 2,326,170 | 95,158 | 2,486,933 | $3.26 | 0.5% |
| `ef420082` | `claude/funny-turing-7a47c5` · 2026-07-08 14:03 → 2026-07-08 14:47 | 24,301 | 35,472 | 1,732,348 | 58,438 | 1,850,559 | $2.46 | 0.38% |
| `163673e3` | `claude/frosty-panini-598db8` · 2026-07-04 23:50 → 2026-07-04 23:51 | 18,600 | 7,843 | 190,197 | 41,521 | 258,161 | $1.60 | 0.25% |
| `5b4adb55` | `claude/heuristic-kapitsa-364ba4` · 2026-07-07 14:07 → 2026-07-07 14:22 | 24,154 | 17,219 | 726,552 | 60,291 | 828,216 | $1.52 | 0.23% |
| `2b8df57d` | `claude/awesome-lovelace-148138` · 2026-07-05 07:13 → 2026-07-05 07:16 | 23,965 | 12,891 | 336,602 | 57,531 | 430,989 | $1.19 | 0.18% |
| `b49d062c` | `codex/1-7-release` · 2026-07-06 15:40 → 2026-07-06 16:27 | 23,138 | 1,299 | 121,794 | 37,690 | 183,921 | $0.59 | 0.09% |
| `f396237f` | `claude/competent-chaplygin-679357` · 2026-07-03 23:44 → 2026-07-03 23:44 | 23,741 | 503 | 63,060 | 40,700 | 128,004 | $0.57 | 0.09% |
| `880e4f78` | `codex/1-7-release` · 2026-07-08 14:03 → 2026-07-08 14:03 | 23,656 | 848 | 61,742 | 38,136 | 124,382 | $0.55 | 0.08% |
| `2ca19912` | `codex/1-7-release` · 2026-07-10 14:04 → 2026-07-10 14:04 | 23,823 | 769 | 63,159 | 38,201 | 125,952 | $0.55 | 0.08% |
| `6d92b43e` | `claude/nostalgic-wiles-a1b9a8` · 2026-06-28 04:27 → 2026-06-28 04:27 | 22,750 | 1,390 | 19,748 | 12,325 | 56,213 | $0.28 | 0.04% |

## By PR

**Per-message** buckets each assistant response to the branch it was actually emitted on. **Session-dominant** assigns a whole session's spend to its majority branch. Both are shown because they disagree.

### Per-message attribution

| PR | title / state | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|---|---|---|---|---|---|---|---|
| [#376](https://github.com/asfbay-bit/opchain/pull/376) | fix(skills): make checkpoint writing + shared protoc · MERGED | 3,873,451 | 1,048,721 | 76,594,230 | 9,055,681 | 90,572,083 | $265.83 | 40.92% |
| [#384](https://github.com/asfbay-bit/opchain/pull/384) | fix(architecture): resolve 61 layout + formatting de · OPEN | 505,903 | 913,033 | 91,999,039 | 3,404,967 | 96,822,942 | $93.40 | 14.38% |
| *unattributed* | — · — | 384,689 | 523,634 | 47,325,675 | 1,546,754 | 49,780,752 | $54.94 | 8.46% |
| [#372](https://github.com/asfbay-bit/opchain/pull/372) | feat(blog): backfill launch-window posts, stage next · MERGED | 52,296 | 256,593 | 33,655,632 | 853,029 | 34,817,550 | $53.68 | 8.26% |
| [#245](https://github.com/asfbay-bit/opchain/pull/245) | feat(changelog): v1.5/v1.6/v1.7 roadmap + curated st · inferred `[inferred]` | 36,322 | 299,900 | 19,706,002 | 3,372,412 | 23,414,636 | $51.26 | 7.89% |
| [#383](https://github.com/asfbay-bit/opchain/pull/383) | feat(architecture): v1.8 quality-gate rail (docs-for · MERGED | 27,988 | 149,260 | 30,987,368 | 1,003,552 | 32,168,168 | $29.40 | 4.53% |
| [#374](https://github.com/asfbay-bit/opchain/pull/374) | chore(blog): drop the Jul 3 post to the drawer; docu · MERGED | 3,250 | 31,723 | 11,313,965 | 769,570 | 12,118,508 | $28.32 | 4.36% |
| [#373](https://github.com/asfbay-bit/opchain/pull/373) | feat(blog): pre-write Jul 6 + Jul 8 posts as staged  · MERGED | 2,731 | 40,746 | 7,819,556 | 674,372 | 8,537,405 | $23.37 | 3.6% |
| [#364](https://github.com/asfbay-bit/opchain/pull/364) | docs(reports): regenerate token report — per-message · MERGED | 100,190 | 141,438 | 15,030,848 | 451,414 | 15,723,890 | $15.31 | 2.36% |
| [#382](https://github.com/asfbay-bit/opchain/pull/382) | docs(reports): token+cost audit 2026-07-06 (per-mess · OPEN | 24,734 | 98,972 | 8,465,005 | 567,268 | 9,155,979 | $12.50 | 1.92% |
| [#371](https://github.com/asfbay-bit/opchain/pull/371) | Sync skills to released checkpoint-protocol upgrade  · MERGED | 25,447 | 93,475 | 9,453,150 | 203,941 | 9,776,013 | $9.23 | 1.42% |
| [#257](https://github.com/asfbay-bit/opchain/pull/257) | design: 4 changelog side-by-side layout options · MERGED | 90 | 127,918 | 6,967,014 | 374,230 | 7,469,252 | $6.25 | 0.96% |
| [#362](https://github.com/asfbay-bit/opchain/pull/362) | docs(reports): regenerate token report from full loc · MERGED | 23,515 | 65,118 | 3,683,989 | 130,678 | 3,903,300 | $4.89 | 0.75% |
| [#263](https://github.com/asfbay-bit/opchain/pull/263) | design(changelog): round 2-3 layout explorations — b · MERGED | 20 | 15,420 | 2,735,059 | 22,899 | 2,773,398 | $1.19 | 0.18% |

### Session-dominant attribution

| PR | title / state | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|---|---|---|---|---|---|---|---|
| [#376](https://github.com/asfbay-bit/opchain/pull/376) | fix(skills): make checkpoint writing + shared protoc · MERGED | 3,873,451 | 1,048,721 | 76,594,230 | 9,055,681 | 90,572,083 | $265.83 | 40.92% |
| [#384](https://github.com/asfbay-bit/opchain/pull/384) | fix(architecture): resolve 61 layout + formatting de · OPEN | 533,756 | 1,060,216 | 122,745,858 | 4,403,279 | 128,743,109 | $122.58 | 18.87% |
| [#372](https://github.com/asfbay-bit/opchain/pull/372) | feat(blog): backfill launch-window posts, stage next · MERGED | 58,277 | 329,062 | 52,789,153 | 2,296,971 | 55,473,463 | $105.38 | 16.22% |
| *unattributed* | — · — | 384,691 | 524,121 | 47,028,393 | 1,549,777 | 49,486,982 | $54.84 | 8.44% |
| [#245](https://github.com/asfbay-bit/opchain/pull/245) | feat(changelog): v1.5/v1.6/v1.7 roadmap + curated st · inferred | 36,322 | 299,900 | 19,706,002 | 3,372,412 | 23,414,636 | $51.26 | 7.89% |
| [#364](https://github.com/asfbay-bit/opchain/pull/364) | docs(reports): regenerate token report — per-message · MERGED | 100,323 | 143,028 | 15,568,679 | 453,631 | 16,265,661 | $15.64 | 2.41% |
| [#382](https://github.com/asfbay-bit/opchain/pull/382) | docs(reports): token+cost audit 2026-07-06 (per-mess · OPEN | 24,734 | 98,972 | 8,465,005 | 567,268 | 9,155,979 | $12.50 | 1.92% |
| [#371](https://github.com/asfbay-bit/opchain/pull/371) | Sync skills to released checkpoint-protocol upgrade  · MERGED | 25,447 | 93,475 | 9,453,150 | 203,941 | 9,776,013 | $9.23 | 1.42% |
| [#257](https://github.com/asfbay-bit/opchain/pull/257) | design: 4 changelog side-by-side layout options · MERGED | 110 | 143,338 | 9,702,073 | 397,129 | 10,242,650 | $7.44 | 1.15% |
| [#362](https://github.com/asfbay-bit/opchain/pull/362) | docs(reports): regenerate token report from full loc · MERGED | 23,515 | 65,118 | 3,683,989 | 130,678 | 3,903,300 | $4.89 | 0.75% |

### ⚠ Divergence flags (>20% of est. cost between modes) — 6

| PR | per-message | session-dominant | Δ | % diff | title |
|---|--:|--:|--:|--:|---|
| #372 | $53.68 | $105.38 | $+51.70 | 49.1% | feat(blog): backfill launch-window posts, stag |
| #383 | $29.40 | $0.00 | $-29.40 | 100.0% | feat(architecture): v1.8 quality-gate rail (do |
| #384 | $93.40 | $122.58 | $+29.18 | 23.8% | fix(architecture): resolve 61 layout + formatt |
| #374 | $28.32 | $0.00 | $-28.32 | 100.0% | chore(blog): drop the Jul 3 post to the drawer |
| #373 | $23.37 | $0.00 | $-23.37 | 100.0% | feat(blog): pre-write Jul 6 + Jul 8 posts as s |
| #263 | $1.19 | $0.00 | $-1.19 | 100.0% | design(changelog): round 2-3 layout exploratio |

These sessions sprawled across branches, so their attribution is genuinely ambiguous. Several PRs collapse to **$0.00** under session-dominant because the session that produced them spent most of its messages on a *different* branch. **Per-message is the more honest of the two** and is what the fact table stores.

## By release

Tags in repo: `wip/v1-8-docs-mesh-20260703` (2026-07-04)

| release window | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |
|---|---|---|---|---|---|---|---|
| `unreleased-post-wip/v1-8-docs-mesh-20260703` | 4,647,311 | 2,468,676 | 235,660,907 | 15,411,313 | 258,188,207 | $452.73 | 69.69% |
| `unreleased` | 413,315 | 1,337,275 | 130,075,625 | 7,019,454 | 138,845,669 | $196.87 | 30.31% |

> **This dimension is degenerate.** The repo has exactly one tag — `wip/v1-8-docs-mesh-20260703`, a work-in-progress
> marker, not a semver release — and no GitHub Releases at all. Every entry therefore lands either before it
> (`unreleased`) or after it (`unreleased-post-…`); neither bucket is a shipped release. Cut real `v*` tags and this
> table starts carrying signal.

## Method & caveats

- **Coverage:** 418/418 manifest files processed, 0 failed. Fact-table rows (3,214) == `entry_count`. No sampling, no recency cap.
- **The `head -1` manifest filter in the task spec is broken.** 97 transcripts carry `cwd` on lines 2–4 (their first record is `queue-operation` / `started` / `ai-title`) and would have been silently dropped — including scheduled-task sessions. This run scans **every line** of each `.jsonl` for the first `cwd`. A further 58 files (workflow `journal.jsonl`) have no `cwd` at all; each was confirmed to contain **zero** assistant entries, so no spend is lost by excluding them.
- **Worktrees:** sessions live under 17 distinct project folders (`-Users-aidanelsesser-repos-opchain*`). Filtering on `cwd` rather than folder name caught all of them, including **394 workflow-subagent transcripts** whose tokens are real billable spend.
- **Dedup:** billing is per API response, so rows are keyed on `message.id`. 3,885 duplicate lines were dropped (1,267 with *conflicting* usage numbers — partial/streamed records; the maximal record wins). Counting per line would have overstated cost by ~2.3×.
- **Append-safe merge.** The fact table is keyed on `message_id`. This run retained **215** historical rows (2026-05-26 → 06-28, from transcripts since rotated off disk), added **2,999** new rows, and resolved **102** overlapping ids in favour of the newer TTL-correct pricing. A naive overwrite would have destroyed the earlier window; a naive concat would have double-counted the overlap.
- **Mixed pricing epochs.** 215 rows retain `anthropic-list-2026-06-28`; 2,999 use `oc-claude-api@2026-07-10`. Every row carries its own `pricing_version` — cost is meaningless without it.
- **Attribution is lossy.** 179 entries were `[inferred]` by timestamp correlation against PR windows. Work on `main`, reverts and exploration land in **unattributed** ($54.94, 8.46%). Nothing was force-fit.
- Cache multipliers are applied on **each model's own input rate**, never a blended rate. All timestamps UTC.

## Files

| file | purpose |
|---|---|
| `token-report-2026-07-10.md` | this document (human) |
| `fact_token_usage.csv` | canonical tidy fact table, one row per assistant response, append-safe on `message_id` |
| `aggregates.json` | pre-rolled `by_model` / `by_session` / `by_pr_*` / `by_release` / `totals` |
| `meta.json` | self-describing manifest: coverage, dedup, merge, pricing snapshot, divergence |
| `dashboard_export.json` | oc-telemetry-ops export contract (retroactive, k-anonymised) |
| `.checkpoints/oc-cost-ops.checkpoint.json` | wire-1.1 `cost` object for `/oc-cost` + orchestrator |

