# opchain — Claude Code Token & Cost Report — 2026-07-06

> Retro audit of Claude Code token usage for the **opchain** repo, read from `~/.claude/projects/*.jsonl` session transcripts (filtered by `cwd`). Broken down by **model**, **chat**, **PR**, and **release**. All four token buckets (fresh input / output / cache-read / cache-write) are kept separate; cache reads are **never** merged into fresh input.

## Methodology (read this before the numbers)

- **Counted per `message.id`, not per transcript line.** Claude Code writes each API response to the transcript once per streamed content block — all copies carry the same `message.id` and identical `usage`. Counting lines double-counts (**~2.31× inflation** here; ~13× historically per prior audits). Dedup is **global** so resume/fork-copied lines (which keep their original `message.id`) collapse too.
- **5,053** raw assistant lines → **2,192** unique billable responses across **18** chats and **386** transcripts (2026-06-05 → 2026-07-06, UTC).
- **Subagent/workflow transcripts are included** (real spend) and share their parent's `sessionId`, so the *by-chat* view rolls subagent cost into the parent chat.
- **Pricing** verified 2026-06-28 against `oc-claude-api/references/model-routing.md + prompt-caching.md`. Cache multipliers on each model's input rate: read **0.1×**, 5-min-TTL write **1.25×**, 1-hour-TTL write **2.0×** (split per response, not a flat rate). No batch discount (interactive traffic). `126` zero-token `<synthetic>` messages excluded.
- **One session recovered:** `24c401f6 (design/changelog, all sonnet-4-6)` was deleted from the live projects dir mid-run; recovered from the first snapshot via usage-signature dedup (94 responses), a method validated to match `message.id` dedup **exactly** on every present file (and whose sonnet total reconciles to the cent with the prior June audit).

## Totals

| Fresh input | Output | Cache read | Cache write | Total tokens | Est. cost |
|---|---|---|---|---|---|
| 4,343,654 | 2,199,822 | 203,421,475 | 13,718,424 | 223,683,375 | **$449.58** |

Cache reads are **91%** of all tokens — the cost lever is cache-read volume, which is billed at a tenth of fresh input.

## 1) By model

| Model | Input | Output | Cache read | Cache write | Total | Est. cost | % cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| claude-fable-5 | 3,917,626 | 1,153,942 | 91,093,770 | 10,888,022 | 107,053,360 | $342.55 | 76.2% |
| claude-opus-4-8 | 425,918 | 902,542 | 102,625,632 | 2,433,273 | 106,387,365 | $99.58 | 22.1% |
| claude-sonnet-4-6 | 110 | 143,338 | 9,702,073 | 397,129 | 10,242,650 | $7.44 | 1.7% |

## 2) By chat (session)

Sorted by est. cost. `dominant_branch` = the branch on the majority of the chat's responses; window is first→last response (UTC).

| Chat (sessionId) | Dominant branch | Window | Input | Output | Cache read | Cache write | Total | Est. cost | % cost |
|---|---|---|--:|--:|--:|--:|--:|--:|--:|
| `cb2ab85f` | claude/pensive-hawking-1775f3 | 2026-07-04→2026-07-05 | 3,873,451 | 1,048,721 | 76,594,230 | 9,055,681 | 90,572,083 | $265.83 | 59.1% |
| `86cff5ec` | claude/vigilant-rhodes-6ebe72 | 2026-07-02→2026-07-04 | 32,701 | 228,767 | 41,275,196 | 2,097,400 | 43,634,064 | $94.99 | 21.1% |
| `82bd4980` | claude/silly-tu-56b768 | 2026-06-28→2026-06-28 | 100,323 | 143,028 | 15,568,679 | 453,631 | 16,265,661 | $15.64 | 3.5% |
| `9d461922` | claude/friendly-elgamal-575049 | 2026-07-03→2026-07-03 | 25,576 | 100,295 | 11,513,957 | 199,571 | 11,839,399 | $10.39 | 2.3% |
| `3994fb80` | claude/unruffled-kare-fbabf7 | 2026-06-29→2026-06-29 | 24,711 | 68,839 | 10,372,678 | 324,518 | 10,790,746 | $10.28 | 2.3% |
| `f484218c` | claude/funny-bun-28f4f4 | 2026-07-01→2026-07-01 | 29,609 | 93,166 | 10,125,324 | 190,096 | 10,438,195 | $9.44 | 2.1% |
| `4f6667ef` | claude/sad-villani-ed1aba | 2026-06-30→2026-06-30 | 25,447 | 93,475 | 9,453,150 | 203,941 | 9,776,013 | $9.23 | 2.0% |
| `24c401f6` | design/changelog-layout-options | 2026-06-05→2026-06-06 | 110 | 143,338 | 9,702,073 | 397,129 | 10,242,650 | $7.44 | 1.7% |
| `150261f6` | claude/zen-lewin-0d3126 | 2026-07-04→2026-07-04 | 24,234 | 58,933 | 4,686,721 | 121,690 | 4,891,578 | $5.15 | 1.1% |
| `5b986f55` | claude/strange-gagarin-93fd80 | 2026-07-02→2026-07-02 | 24,671 | 50,142 | 4,233,053 | 147,547 | 4,455,413 | $4.97 | 1.1% |
| `bdb6c4f8` | claude/wizardly-hamilton-8ccf05 | 2026-06-28→2026-06-28 | 23,515 | 65,118 | 3,683,989 | 130,678 | 3,903,300 | $4.89 | 1.1% |
| `3119fc94` | claude/determined-maxwell-019a92 | 2026-07-06→2026-07-06 | 23,894 | 49,976 | 2,434,115 | 121,404 | 2,629,389 | $3.80 | 0.8% |
| `67b6fc5d` | claude/focused-noyce-8d3046 | 2026-06-30→2026-06-30 | 23,222 | 32,799 | 3,144,935 | 109,854 | 3,310,810 | $3.61 | 0.8% |
| `163673e3` | claude/frosty-panini-598db8 | 2026-07-04→2026-07-04 | 18,600 | 7,843 | 190,197 | 41,521 | 258,161 | $1.60 | 0.4% |
| `2b8df57d` | claude/awesome-lovelace-148138 | 2026-07-05→2026-07-05 | 23,965 | 12,891 | 336,602 | 57,531 | 430,989 | $1.19 | 0.3% |
| `f396237f` | claude/competent-chaplygin-679357 | 2026-07-03→2026-07-03 | 23,741 | 503 | 63,060 | 40,700 | 128,004 | $0.57 | 0.1% |
| `6d92b43e` | claude/nostalgic-wiles-a1b9a8 | 2026-06-28→2026-06-28 | 22,750 | 1,390 | 19,748 | 12,325 | 56,213 | $0.28 | 0.1% |
| `b49d062c` | codex/1-7-release | 2026-07-06→2026-07-06 | 23,134 | 598 | 23,768 | 13,207 | 60,707 | $0.27 | 0.1% |

## 3) By PR

Two attribution modes. **Per-message:** each response → the PR matching its own `gitBranch`. **Session-dominant:** a chat's *entire* cost → the PR of its majority branch. They diverge when one chat sprawls across several branches/PRs. All resolved PRs are **MERGED**.

### 3a) Per-message attribution

| PR | Input | Output | Cache read | Cache write | Total | Est. cost | % cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| [#376](https://github.com/asfbay-bit/opchain/pull/376) fix(skills): checkpoint writing + shared protocol self-contained | 3,873,451 | 1,048,721 | 76,594,230 | 9,055,681 | 90,572,083 | $265.83 | 59.1% |
| _unattributed_ | 288,252 | 502,745 | 48,161,053 | 1,469,909 | 50,421,959 | $52.90 | 11.8% |
| [#372](https://github.com/asfbay-bit/opchain/pull/372) feat(blog): backfill launch-window posts | 26,720 | 156,298 | 22,141,675 | 653,458 | 22,978,151 | $43.29 | 9.6% |
| [#374](https://github.com/asfbay-bit/opchain/pull/374) chore(blog): drop the Jul 3 post to the drawer | 3,250 | 31,723 | 11,313,965 | 769,570 | 12,118,508 | $28.32 | 6.3% |
| [#373](https://github.com/asfbay-bit/opchain/pull/373) feat(blog): pre-write Jul 6 + Jul 8 posts | 2,731 | 40,746 | 7,819,556 | 674,372 | 8,537,405 | $23.37 | 5.2% |
| [#364](https://github.com/asfbay-bit/opchain/pull/364) docs(reports): regenerate token report — per-message | 100,190 | 141,438 | 15,030,848 | 451,414 | 15,723,890 | $15.31 | 3.4% |
| [#371](https://github.com/asfbay-bit/opchain/pull/371) Sync skills to released checkpoint-protocol upgrade | 25,447 | 93,475 | 9,453,150 | 203,941 | 9,776,013 | $9.23 | 2.0% |
| [#257](https://github.com/asfbay-bit/opchain/pull/257) design: 4 changelog side-by-side layout options | 78 | 104,138 | 6,487,950 | 286,502 | 6,878,668 | $5.23 | 1.2% |
| [#362](https://github.com/asfbay-bit/opchain/pull/362) docs(reports): regenerate token report from full log | 23,515 | 65,118 | 3,683,989 | 130,678 | 3,903,300 | $4.89 | 1.1% |
| [#263](https://github.com/asfbay-bit/opchain/pull/263) design(changelog): round 2-3 layout explorations | 20 | 15,420 | 2,735,059 | 22,899 | 2,773,398 | $1.19 | 0.3% |

### 3b) Session-dominant attribution

| PR | Input | Output | Cache read | Cache write | Total | Est. cost | % cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| [#376](https://github.com/asfbay-bit/opchain/pull/376) fix(skills): checkpoint writing + shared protocol self-contained | 3,873,451 | 1,048,721 | 76,594,230 | 9,055,681 | 90,572,083 | $265.83 | 59.1% |
| [#372](https://github.com/asfbay-bit/opchain/pull/372) feat(blog): backfill launch-window posts | 32,701 | 228,767 | 41,275,196 | 2,097,400 | 43,634,064 | $94.99 | 21.1% |
| _unattributed_ | 288,107 | 477,375 | 47,144,158 | 1,379,964 | 49,289,604 | $51.55 | 11.5% |
| [#364](https://github.com/asfbay-bit/opchain/pull/364) docs(reports): regenerate token report — per-message | 100,323 | 143,028 | 15,568,679 | 453,631 | 16,265,661 | $15.64 | 3.5% |
| [#371](https://github.com/asfbay-bit/opchain/pull/371) Sync skills to released checkpoint-protocol upgrade | 25,447 | 93,475 | 9,453,150 | 203,941 | 9,776,013 | $9.23 | 2.0% |
| [#257](https://github.com/asfbay-bit/opchain/pull/257) design: 4 changelog side-by-side layout options | 110 | 143,338 | 9,702,073 | 397,129 | 10,242,650 | $7.44 | 1.7% |
| [#362](https://github.com/asfbay-bit/opchain/pull/362) docs(reports): regenerate token report from full log | 23,515 | 65,118 | 3,683,989 | 130,678 | 3,903,300 | $4.89 | 1.1% |

### Divergence flags (per-message vs session-dominant differ > 20%)

| PR | Per-message | Session-dominant | Δ | Reading |
|---|--:|--:|--:|---|
| #372 feat(blog): backfill launch-window | $43.29 | $94.99 | 54.4% | chat's cost absorbed by its dominant branch's PR |
| #374 chore(blog): drop the Jul 3 post t | $28.32 | $0.00 | 100.0% | these responses lived in chats dominated by another PR's branch |
| #373 feat(blog): pre-write Jul 6 + Jul  | $23.37 | $0.00 | 100.0% | these responses lived in chats dominated by another PR's branch |
| #257 design: 4 changelog side-by-side l | $5.23 | $7.44 | 29.8% | chat's cost absorbed by its dominant branch's PR |
| #263 design(changelog): round 2-3 layou | $1.19 | $0.00 | 100.0% | these responses lived in chats dominated by another PR's branch |

These are the genuinely ambiguous attributions: a few long chats (notably the vigilant-rhodes blog/changelog session) touched blog *and* changelog branches, so per-message splits their cost across #372/#373/#374/#263 while session-dominant dumps it all on #372.

## 4) By release

Only one tag exists: `wip/v1-8-docs-mesh-20260703` @ 2026-07-04T21:14:19Z — a `wip/` docs tag, not a semver release. Per the spec, pre-tag work is `unreleased`; at/after-tag work carries the tag label.

| Release window | Input | Output | Cache read | Cache write | Total | Est. cost | % cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| wip/v1-8-docs-mesh-20260703 | 3,966,661 | 1,162,447 | 93,051,852 | 10,071,382 | 108,252,342 | $303.96 | 67.6% |
| unreleased | 376,993 | 1,037,375 | 110,369,623 | 3,647,042 | 115,431,033 | $145.61 | 32.4% |

## Attribution honesty

- **`unattributed` = $52.90 (11.8% of cost).** These are responses on `main` or on worktree branches (`friendly-elgamal`, `funny-bun`, `unruffled-kare`, `zen-lewin`, `strange-gagarin`, `focused-noyce`, `awesome-lovelace`, `frosty-panini`, `competent-chaplygin`, `nostalgic-wiles`, `codex/1-7-release`, `determined-maxwell` [this run]) that never opened a PR with that head. Surfaced honestly rather than timestamp-force-fit onto a PR.
- **Unpriced models:** none — every model that produced tokens is in the pricing table.

## Data layer (companion files)

- `fact_token_usage.csv` — one row per deduped response (full grain); every table above is one `GROUP BY` away.
- `aggregates.json` — pre-rolled `by_model` / `by_session` / `by_pr_permessage` / `by_pr_session_dominant` / `by_release` / `totals`.
- `meta.json` — pricing snapshot, date range, counts, divergence list, methodology notes.
- `oc-cost-ops.checkpoint.json` — wire-1.1 cost object (`Σ by_phase == Σ by_model == total_usd`), also written to `.checkpoints/`.
- `dashboard_export.json` — oc-telemetry-ops `/dashboard` contract, satisfied retroactively (NOT from `usage.sqlite`).
