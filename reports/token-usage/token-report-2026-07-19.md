# Claude Code token + cost report — 2026-07-19

**Repo:** `opchain` · **Window:** 2026-05-26 → 2026-07-19 · **Sessions:** 49 · **Messages:** 4,790

## Totals

| bucket | tokens |
|---|---:|
| input | 7,330,293 |
| output | 6,035,292 |
| cache read | 603,975,345 |
| cache write | 34,126,192 |
| **total** | **651,467,122** |

### Estimated cost: **$1,078.74**

- **This run's window** (2026-06-28 → 2026-07-19, 4,576 messages): **$1,020.04**
- **Preserved history** (2026-05-26 → 2026-06-06, 214 rows whose transcripts have rotated off disk): $58.70, carried at their original pricing epoch (`anthropic-list-2026-06-28`).
- **Prior ledger** — merged append-safe against the 2026-07-19 earlier run (uncommitted, worktree youthful-cerf-aafbf8): 4,750 rows / $1,074.87. This run adds **$3.87**. Against the latest *committed* report (`ab22742`, 2026-07-17, $1,064.60) the delta is **$14.14**.

## Method notes (why these numbers differ from a naive parse)

- **Per-message dedup.** Claude Code writes one transcript line per *content block*, each repeating the message's cumulative `usage`. Counted once per `(session_id, message.id)` taking the **max per field** — 11,250 assistant lines collapsed to 4,719 billable messages (**2.38×**). Summing per line would report **$2,488.50** — the 2026-06 reporting bug.
- **Cache-write TTL is a split, not a flat rate.** Fresh writes: 16,993,791 × 1.25× (5m) + 13,362,860 × 2.0× (1h) — 44.0% at the 1-hour rate. Pricing all writes flat-1.25× would understate this window by $71.61.
- **Subagent transcripts counted.** 493 of the 541 matched files are nested `subagents/**/agent-*.jsonl` — separate API conversations that bill for real and never appear in the parent transcript.
- **Discovery scans every line for `cwd`, not just line 1.** Sessions that open with a `queue-operation` record (scheduled tasks, notably this one) carry `cwd` on lines 2–4; a `head -1` filter silently drops them — 541 files matched (48 top-level + 493 nested) vs 493 with the line-1 filter, out of 1,752 scanned (68 had no `cwd` at all and carry zero assistant lines).
- **143 zero-token `<synthetic>` rows excluded** (no API call, no spend).
- **No Batch discount applied** — `service_tier` is `standard` on every fresh entry.

## By model

| model | input | output | cache-read | cache-write | total tokens | est. cost | % cost |
|---|---:|---:|---:|---:|---:|---:|---:|
| claude-fable-5 | 5,567,293 | 2,146,389 | 208,075,696 | 17,538,408 | 233,327,786 | $633.29 | 58.71% |
| claude-opus-4-8 | 1,748,297 | 3,700,317 | 381,664,458 | 15,983,614 | 403,096,686 | $432.47 | 40.09% |
| claude-sonnet-4-6 | 110 | 143,338 | 9,702,073 | 397,129 | 10,242,650 | $7.44 | 0.69% |
| claude-opus-4-7 | 14,593 | 45,248 | 4,533,118 | 207,041 | 4,800,000 | $5.54 | 0.51% |

`claude-sonnet-4-6` and `claude-opus-4-7` are **preserved-history only** (zero fresh entries). `claude-opus-4-7` has no rate in `model-routing.md` — it is **[unpriced]** for any new usage; the figure above is carried from its original epoch, not re-estimated.

## By chat (session)

| session | first seen | branch | input | output | cache-read | cache-write | total tokens | est. cost | % cost |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| cb2ab85f-3adb-46c6-ba71-169a6e128e2f | 2026-07-04 23:44 | `claude/pensive-hawking-1775f3` | 3,873,451 | 1,048,721 | 76,594,230 | 9,055,681 | 90,572,083 | $265.83 | 24.64% |
| aed554b9-6ace-4497-925c-977830892947 | 2026-07-08 21:13 | `claude/arch-diagram-layout-audit` | 542,929 | 1,154,203 | 165,108,193 | 4,950,224 | 171,755,549 | $151.63 | 14.06% |
| 86cff5ec-bccc-4965-b6ea-9c7f057e1ac3 | 2026-07-02 23:59 | `claude/vigilant-rhodes-6ebe72` | 32,701 | 228,767 | 41,275,196 | 2,097,400 | 43,634,064 | $94.99 | 8.81% |
| d4f12cec-babb-4216-b209-7c75af67a1c9 | 2026-07-10 16:42 | `claude/skills-1-8-coverage-095ab4` | 1,117,921 | 318,568 | 23,357,681 | 2,635,257 | 27,429,427 | $85.35 | 7.91% |
| 739d6741-11b0-4ef5-b132-63c58cbbe437 | 2026-07-12 16:15 | `claude/opchain-self-improving-skil` | 791,205 | 533,643 | 19,229,694 | 3,520,681 | 24,075,223 | $72.75 | 6.74% |
| 2ca19912-31ae-458f-84c8-fb4587289c82 | 2026-07-10 14:04 | `claude/release-v1-8` | 46,947 | 131,048 | 36,555,808 | 784,278 | 37,518,081 | $58.30 | 5.4% |
| ec79f7c4-ac0c-45e0-91bc-7a2c9a4d7098 | 2026-05-31 02:55 | `main` | 13,018 | 174,664 | 2,517,753 | 2,909,109 | 5,614,544 | $34.78 | 3.22% |
| ed25180e-f176-45cb-b2c3-ae0cc0da31a9 | 2026-07-12 16:59 | `claude/trusting-chaum-a51d10` | 25,806 | 65,545 | 18,239,913 | 531,401 | 18,862,665 | $32.40 | 3.0% |
| 14d3634a-e13b-4f7a-ad06-a85a90567f8a | 2026-07-10 20:53 | `claude/angry-spence-69342a` | 27,934 | 127,274 | 11,137,502 | 553,928 | 11,846,638 | $26.61 | 2.47% |
| 83144ecc-2fad-4ff7-ae76-568a04b1a431 | 2026-07-10 21:23 | `claude/loving-snyder-873d27` | 29,972 | 69,722 | 9,835,838 | 551,174 | 10,486,706 | $20.38 | 1.89% |
| 2e8201ef-73de-431d-b009-848815d3142c | 2026-05-26 01:15 | `main` | 23,304 | 125,236 | 17,188,249 | 463,303 | 17,800,092 | $16.47 | 1.53% |
| 82bd4980-f79e-4307-b525-6a0dc61f17d3 | 2026-06-28 20:47 | `claude/silly-tu-56b768` | 100,323 | 143,028 | 15,568,679 | 453,631 | 16,265,661 | $15.64 | 1.45% |
| 3119fc94-547c-4c8d-954a-8d1fc6ab2f70 | 2026-07-06 15:40 | `claude/determined-maxwell-019a92` | 24,734 | 98,972 | 8,465,005 | 567,268 | 9,155,979 | $12.50 | 1.16% |
| c4a4a82c-47fb-4540-9e20-d50cb40ccd02 | 2026-07-10 17:38 | `claude/epic-ellis-90e84e` | 27,605 | 28,939 | 6,441,890 | 216,145 | 6,714,579 | $12.49 | 1.16% |
| 3ceb5190-caff-4f10-a81c-edab1df1f6c3 | 2026-07-12 15:17 | `claude/reverent-ramanujan-26c26e` | 24,292 | 119,812 | 11,292,322 | 227,506 | 11,663,932 | $11.04 | 1.02% |
| 9d461922-c26a-41fe-840d-614686f29132 | 2026-07-03 14:07 | `claude/friendly-elgamal-575049` | 25,576 | 100,295 | 11,513,957 | 199,571 | 11,839,399 | $10.39 | 0.96% |
| 3994fb80-2087-475a-8b59-23c41587e947 | 2026-06-29 14:07 | `claude/unruffled-kare-fbabf7` | 24,711 | 68,839 | 10,372,678 | 324,518 | 10,790,746 | $10.28 | 0.95% |
| 076f1cbe-daac-495e-89b6-265b0f5bb7d1 | 2026-07-17 14:07 | `claude/vigilant-moore-18894f` | 110 | 85,305 | 8,736,436 | 344,606 | 9,166,457 | $9.95 | 0.92% |
| 13739cb5-406a-42a8-9e45-c26043bdda40 | 2026-07-15 14:44 | `claude/blissful-northcutt-83f2bd` | 114 | 111,836 | 9,463,715 | 195,310 | 9,770,975 | $9.48 | 0.88% |
| f484218c-6f1d-4f26-b5f7-d84369d2ea22 | 2026-07-01 14:07 | `claude/funny-bun-28f4f4` | 29,609 | 93,166 | 10,125,324 | 190,096 | 10,438,195 | $9.44 | 0.88% |
| 4f6667ef-50a2-4d46-a494-f0de0a0463cc | 2026-06-30 04:16 | `claude/sad-villani-ed1aba` | 25,447 | 93,475 | 9,453,150 | 203,941 | 9,776,013 | $9.23 | 0.86% |
| 447a14c2-0eb5-41b2-8c42-24a4e4db51d3 | 2026-07-14 14:07 | `claude/vigilant-poitras-81ddab` | 24,127 | 99,939 | 8,932,223 | 195,948 | 9,252,237 | $9.04 | 0.84% |
| b7345019-28c9-476f-ae61-7e46528a7c7e | 2026-07-09 14:06 | `claude/distracted-morse-689db5` | 25,376 | 101,143 | 8,824,310 | 176,081 | 9,126,910 | $8.83 | 0.82% |
| 5a14cde8-41e4-4826-9ee6-6f95c88eec51 | 2026-07-12 16:15 | `claude/sync-opchain-skills-c99909` | 24,265 | 64,469 | 6,451,951 | 355,918 | 6,896,603 | $8.52 | 0.79% |
| 2d8074bb-b264-4250-a4fa-2e335b886435 | 2026-07-10 21:25 | `claude/eager-dhawan-38def8` | 19,327 | 76,439 | 1,253,169 | 142,838 | 1,491,773 | $8.13 | 0.75% |

_Top 25 of 49 sessions by cost._

## By PR — per-message attribution

Each message's tokens bucket to the PR matching its own `gitBranch`.

| PR | input | output | cache-read | cache-write | total tokens | est. cost | % cost |
|---|---:|---:|---:|---:|---:|---:|---:|
| [#376](https://github.com/asfbay-bit/opchain/pull/376) fix(skills): make checkpoint writing + shared protoc _merged_ | 3,873,451 | 1,048,721 | 76,594,230 | 9,055,681 | 90,572,083 | $265.83 | 24.64% |
| unattributed | 1,081,151 | 1,394,719 | 140,340,183 | 5,772,543 | 148,588,596 | $187.02 | 17.34% |
| [#384](https://github.com/asfbay-bit/opchain/pull/384) fix(architecture): resolve 61 layout + formatting de _merged_ | 555,316 | 1,006,413 | 98,976,221 | 4,175,633 | 104,713,583 | $110.41 | 10.24% |
| [#387](https://github.com/asfbay-bit/opchain/pull/387) docs(skills): wire the v1.8 quality-gate rail (oc-do _merged_ | 1,118,195 | 329,758 | 25,151,603 | 2,653,345 | 29,252,901 | $88.07 | 8.16% |
| [#372](https://github.com/asfbay-bit/opchain/pull/372) feat(blog): backfill launch-window posts, stage next _merged_ | 52,296 | 256,593 | 33,655,632 | 853,029 | 34,817,550 | $53.68 | 4.98% |
| [#245](https://github.com/asfbay-bit/opchain/pull/245) feat(changelog): v1.5/v1.6/v1.7 roadmap + curated st _merged_ | 36,322 | 299,900 | 19,706,002 | 3,372,412 | 23,414,636 | $51.26 | 4.75% |
| [#399](https://github.com/asfbay-bit/opchain/pull/399) feat(install): update-check hook + catalogVersion in _merged_ | 25,806 | 65,545 | 18,239,913 | 531,401 | 18,862,665 | $32.40 | 3.0% |
| [#383](https://github.com/asfbay-bit/opchain/pull/383) feat(architecture): v1.8 quality-gate rail (docs-for _merged_ | 27,988 | 149,260 | 30,987,368 | 1,003,552 | 32,168,168 | $29.40 | 2.73% |
| [#392](https://github.com/asfbay-bit/opchain/pull/392) fix(worker): serve /api/health with Cache-Control: n _merged_ | 28,069 | 151,967 | 11,501,619 | 604,143 | 12,285,798 | $29.21 | 2.71% |
| [#374](https://github.com/asfbay-bit/opchain/pull/374) chore(blog): drop the Jul 3 post to the drawer; docu _merged_ | 3,250 | 31,723 | 11,313,965 | 769,570 | 12,118,508 | $28.32 | 2.63% |
| [#389](https://github.com/asfbay-bit/opchain/pull/389) release: v1.8.0 "Documentation & repo hygiene" _merged_ | 8,768 | 48,002 | 22,799,130 | 96,782 | 22,952,682 | $27.22 | 2.52% |
| [#397](https://github.com/asfbay-bit/opchain/pull/397) docs(changelog): surface the v1.8.1 patch on /change _merged_ | 200,035 | 369,347 | 14,393,927 | 1,256,145 | 16,219,454 | $26.95 | 2.5% |
| [#373](https://github.com/asfbay-bit/opchain/pull/373) feat(blog): pre-write Jul 6 + Jul 8 posts as staged  _merged_ | 2,731 | 40,746 | 7,819,556 | 674,372 | 8,537,405 | $23.37 | 2.17% |
| [#393](https://github.com/asfbay-bit/opchain/pull/393) fix(api): make /api/health uncacheable, cache-bust d _merged_ | 29,966 | 67,640 | 9,428,301 | 549,152 | 10,075,059 | $20.10 | 1.86% |
| [#388](https://github.com/asfbay-bit/opchain/pull/388) fix(roadmap): re-pin distribution play to v1.9 — v1. _merged_ | 31,672 | 33,677 | 7,149,929 | 532,346 | 7,747,624 | $19.80 | 1.84% |
| [#364](https://github.com/asfbay-bit/opchain/pull/364) docs(reports): regenerate token report — per-message _merged_ | 100,190 | 141,438 | 15,030,848 | 451,414 | 15,723,890 | $15.31 | 1.42% |
| [#382](https://github.com/asfbay-bit/opchain/pull/382) docs(reports): token+cost audit 2026-07-06 (per-mess _closed_ | 24,734 | 98,972 | 8,465,005 | 567,268 | 9,155,979 | $12.50 | 1.16% |
| [#386](https://github.com/asfbay-bit/opchain/pull/386) fix(architecture): remove auto-cycle to eliminate /a _merged_ | 8,315 | 39,795 | 10,638,230 | 107,750 | 10,794,090 | $10.85 | 1.01% |
| [#371](https://github.com/asfbay-bit/opchain/pull/371) Sync skills to released checkpoint-protocol upgrade  _merged_ | 25,447 | 93,475 | 9,453,150 | 203,941 | 9,776,013 | $9.23 | 0.86% |
| [#401](https://github.com/asfbay-bit/opchain/pull/401) docs(reports): weekly token+cost audit 2026-07-14 ($ _open_ | 24,127 | 99,939 | 8,932,223 | 195,948 | 9,252,237 | $9.04 | 0.84% |

## By PR — session-dominant attribution

Each session's *entire* spend buckets to the branch appearing in the majority of its messages.

| PR | input | output | cache-read | cache-write | total tokens | est. cost | % cost |
|---|---:|---:|---:|---:|---:|---:|---:|
| [#376](https://github.com/asfbay-bit/opchain/pull/376) fix(skills): make checkpoint writing + shared protoc _merged_ | 3,873,451 | 1,048,721 | 76,594,230 | 9,055,681 | 90,572,083 | $265.83 | 24.64% |
| unattributed | 1,359,216 | 2,132,996 | 150,845,250 | 10,363,994 | 164,701,456 | $258.22 | 23.94% |
| [#384](https://github.com/asfbay-bit/opchain/pull/384) fix(architecture): resolve 61 layout + formatting de _merged_ | 542,929 | 1,154,203 | 165,108,193 | 4,950,224 | 171,755,549 | $151.63 | 14.06% |
| [#372](https://github.com/asfbay-bit/opchain/pull/372) feat(blog): backfill launch-window posts, stage next _merged_ | 32,701 | 228,767 | 41,275,196 | 2,097,400 | 43,634,064 | $94.99 | 8.81% |
| [#387](https://github.com/asfbay-bit/opchain/pull/387) docs(skills): wire the v1.8 quality-gate rail (oc-do _merged_ | 1,117,921 | 318,568 | 23,357,681 | 2,635,257 | 27,429,427 | $85.35 | 7.91% |
| [#389](https://github.com/asfbay-bit/opchain/pull/389) release: v1.8.0 "Documentation & repo hygiene" _merged_ | 46,947 | 131,048 | 36,555,808 | 784,278 | 37,518,081 | $58.30 | 5.4% |
| [#399](https://github.com/asfbay-bit/opchain/pull/399) feat(install): update-check hook + catalogVersion in _merged_ | 25,806 | 65,545 | 18,239,913 | 531,401 | 18,862,665 | $32.40 | 3.0% |
| [#392](https://github.com/asfbay-bit/opchain/pull/392) fix(worker): serve /api/health with Cache-Control: n _merged_ | 27,934 | 127,274 | 11,137,502 | 553,928 | 11,846,638 | $26.61 | 2.47% |
| [#393](https://github.com/asfbay-bit/opchain/pull/393) fix(api): make /api/health uncacheable, cache-bust d _merged_ | 29,972 | 69,722 | 9,835,838 | 551,174 | 10,486,706 | $20.38 | 1.89% |
| [#364](https://github.com/asfbay-bit/opchain/pull/364) docs(reports): regenerate token report — per-message _merged_ | 100,323 | 143,028 | 15,568,679 | 453,631 | 16,265,661 | $15.64 | 1.45% |
| [#382](https://github.com/asfbay-bit/opchain/pull/382) docs(reports): token+cost audit 2026-07-06 (per-mess _closed_ | 24,734 | 98,972 | 8,465,005 | 567,268 | 9,155,979 | $12.50 | 1.16% |
| [#388](https://github.com/asfbay-bit/opchain/pull/388) fix(roadmap): re-pin distribution play to v1.9 — v1. _merged_ | 27,605 | 28,939 | 6,441,890 | 216,145 | 6,714,579 | $12.49 | 1.16% |
| [#371](https://github.com/asfbay-bit/opchain/pull/371) Sync skills to released checkpoint-protocol upgrade  _merged_ | 25,447 | 93,475 | 9,453,150 | 203,941 | 9,776,013 | $9.23 | 0.86% |
| [#401](https://github.com/asfbay-bit/opchain/pull/401) docs(reports): weekly token+cost audit 2026-07-14 ($ _open_ | 24,127 | 99,939 | 8,932,223 | 195,948 | 9,252,237 | $9.04 | 0.84% |
| [#397](https://github.com/asfbay-bit/opchain/pull/397) docs(changelog): surface the v1.8.1 patch on /change _merged_ | 24,265 | 64,469 | 6,451,951 | 355,918 | 6,896,603 | $8.52 | 0.79% |
| [#257](https://github.com/asfbay-bit/opchain/pull/257) design: 4 changelog side-by-side layout options _merged_ | 110 | 143,338 | 9,702,073 | 397,129 | 10,242,650 | $7.44 | 0.69% |
| [#398](https://github.com/asfbay-bit/opchain/pull/398) fix(tests): flags-skills fixture resolves node_modul _merged_ | 23,290 | 21,170 | 2,326,774 | 82,197 | 2,453,431 | $5.26 | 0.49% |
| [#362](https://github.com/asfbay-bit/opchain/pull/362) docs(reports): regenerate token report from full loc _merged_ | 23,515 | 65,118 | 3,683,989 | 130,678 | 3,903,300 | $4.89 | 0.45% |

### Divergence flags (>20% cost difference between the two modes)

| PR | per-message | session-dominant | Δ |
|---|---:|---:|---:|
| unattributed | $187.02 | $258.22 | +27.6% |
| #384 | $110.41 | $151.63 | +27.2% |
| #372 | $53.68 | $94.99 | +43.5% |
| #389 | $27.22 | $58.30 | +53.3% |
| #245 | $51.26 | $0.00 | -100.0% |
| #383 | $29.40 | $0.00 | -100.0% |
| #374 | $28.32 | $0.00 | -100.0% |
| #397 | $26.95 | $8.52 | -68.4% |
| #373 | $23.37 | $0.00 | -100.0% |
| #388 | $19.80 | $12.49 | -36.9% |
| #386 | $10.85 | $0.00 | -100.0% |
| #390 | $4.74 | $0.00 | -100.0% |
| #391 | $4.07 | $0.00 | -100.0% |
| #394 | $1.82 | $0.00 | -100.0% |
| #263 | $1.19 | $0.00 | -100.0% |
| #396 | $0.50 | $0.00 | -100.0% |

16 PRs diverge. These are sessions that sprawled across branches — their attribution is genuinely ambiguous, and the per-message table is the more honest of the two. PRs showing `-100%` (#245, #383, #374 …) were touched mid-session but never dominated one, so session-dominant hands their spend to `unattributed`.

> **Note:** PRs whose `headRefName` is literally `main` (here, #33) are excluded from the session-dominant branch→PR map. Without that guard every main-dominant session force-maps onto one unrelated April PR, inventing ~$50 of phantom attribution.

## By release

| release window | input | output | cache-read | cache-write | total tokens | est. cost | % cost |
|---|---:|---:|---:|---:|---:|---:|---:|
| v1.8.0 | 5,817,501 | 3,039,624 | 334,862,785 | 19,132,855 | 362,852,765 | $617.61 | 57.25% |
| post-v1.8.1 | 942,735 | 1,183,568 | 91,534,665 | 5,906,059 | 99,567,027 | $168.60 | 15.63% |
| wip/v1-8-docs-mesh-20260703 | 376,883 | 894,037 | 100,667,550 | 3,249,913 | 105,188,383 | $138.17 | 12.81% |
| v1.8.1 | 156,742 | 474,825 | 47,502,270 | 2,067,824 | 50,201,661 | $95.66 | 8.87% |
| unreleased | 36,432 | 443,238 | 29,408,075 | 3,769,541 | 33,657,286 | $58.70 | 5.44% |

Windows are cut on tag creation dates. `unreleased` is the preserved pre-first-tag history; `post-v1.8.1` is everything since the v1.8.1 tag (2026-07-12) — i.e. work in flight toward the next release.

## Attribution caveats

- **$187.02 (17.34%) is `unattributed`** — exploratory work, on-`main` debugging, reverts, and scheduled tasks that never landed on a PR branch. Shown as its own bucket rather than force-fit.
- Timestamp-window inference runs **only against merged PRs' [created, merged] windows**. Open PRs are unbounded catch-all windows that swallow everything.
- All timestamps UTC.

