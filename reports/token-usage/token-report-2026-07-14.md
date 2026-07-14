# opchain — Claude Code token & cost report (2026-07-14)

_Generated 2026-07-14T14:30:00Z · pricing `oc-claude-api@2026-07-14` (verified 2026-07-14) · schema v1.1_

## Totals

- **Window (UTC):** 2026-05-26T01:15:35.389000+00:00 → 2026-07-14T14:22:26.423Z
- **Sessions:** 42  ·  **Billable entries:** 4,531 (4,317 fresh + 214 preserved historical)  ·  **Excluded:** 141 zero-token `<synthetic>` entries

| Bucket | Tokens |
|---|--:|
| Fresh input | 7,322,245 |
| Output | 5,695,950 |
| Cache **read** (0.1× input) | 568,652,505 |
| Cache **write** (5m 1.25× / 1h 2×) | 33,044,757 |
| **Total tokens** | **614,715,457** |

### **Estimated cost: $1,041.74**

> Cache tokens dominate volume (cache-read alone is 93% of tokens) but a smaller slice of cost. The four buckets are priced separately and never collapsed.

## By model

| model | input | output | cache-read | cache-write | total | est. cost | % cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| `claude-fable-5` | 5,567,293 | 2,146,389 | 208,075,696 | 17,538,408 | 233,327,786 | $633.29 | 60.8% |
| `claude-opus-4-8` | 1,740,249 | 3,360,975 | 346,341,618 | 14,902,179 | 366,345,021 | $395.47 | 38.0% |
| `claude-sonnet-4-6` | 110 | 143,338 | 9,702,073 | 397,129 | 10,242,650 | $7.44 | 0.7% |
| `claude-opus-4-7` | 14,593 | 45,248 | 4,533,118 | 207,041 | 4,800,000 | $5.54 | 0.5% |

## By release

_Window = [tag, next-tag); labeled by the tag opening it; pre-first-tag = `unreleased`. Only `wip/v1-8-docs-mesh-20260703`, `v1.8.0`, `v1.8.1` exist — most spend predates all tags._

| release | input | output | cache-read | cache-write | total | est. cost | % cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| `wip/v1-8-docs-mesh-20260703` | 5,817,501 | 3,039,624 | 334,862,785 | 19,132,855 | 362,852,765 | $617.61 | 59.3% |
| `unreleased` | 413,315 | 1,337,275 | 130,075,625 | 7,019,454 | 138,845,669 | $196.87 | 18.9% |
| `v1.8.1` | 934,687 | 844,226 | 56,211,825 | 4,824,624 | 62,815,362 | $131.60 | 12.6% |
| `v1.8.0` | 156,742 | 474,825 | 47,502,270 | 2,067,824 | 50,201,661 | $95.66 | 9.2% |

## By chat (session)

_42 sessions, sorted by est. cost._

| session · dominant branch · window | input | output | cache-read | cache-write | total | est. cost | % cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| `cb2ab85f` · `claude/pensive-hawking-1775f3` · 2026-07-04→2026-07-05 | 3,873,451 | 1,048,721 | 76,594,230 | 9,055,681 | 90,572,083 | $265.83 | 25.5% |
| `aed554b9` · `claude/arch-diagram-layout-audit` · 2026-07-08→2026-07-10 | 542,929 | 1,154,203 | 165,108,193 | 4,950,224 | 171,755,549 | $151.63 | 14.6% |
| `86cff5ec` · `claude/vigilant-rhodes-6ebe72` · 2026-07-02→2026-07-04 | 32,701 | 228,767 | 41,275,196 | 2,097,400 | 43,634,064 | $94.99 | 9.1% |
| `d4f12cec` · `claude/skills-1-8-coverage-095ab4` · 2026-07-10→2026-07-10 | 1,117,921 | 318,568 | 23,357,681 | 2,635,257 | 27,429,427 | $85.35 | 8.2% |
| `739d6741` · `claude/opchain-self-improving-skills-57efac` · 2026-07-12→2026-07-12 | 791,205 | 533,643 | 19,229,694 | 3,520,681 | 24,075,223 | $72.75 | 7.0% |
| `2ca19912` · `claude/release-v1-8` · 2026-07-10→2026-07-10 | 46,947 | 131,048 | 36,555,808 | 784,278 | 37,518,081 | $58.30 | 5.6% |
| `ec79f7c4` · `main` · 2026-05-31→2026-05-31 | 13,018 | 174,664 | 2,517,753 | 2,909,109 | 5,614,544 | $34.78 | 3.3% |
| `ed25180e` · `claude/trusting-chaum-a51d10` · 2026-07-12→2026-07-12 | 25,806 | 65,545 | 18,239,913 | 531,401 | 18,862,665 | $32.40 | 3.1% |
| `14d3634a` · `claude/angry-spence-69342a` · 2026-07-10→2026-07-10 | 27,934 | 127,274 | 11,137,502 | 553,928 | 11,846,638 | $26.61 | 2.5% |
| `83144ecc` · `claude/loving-snyder-873d27` · 2026-07-10→2026-07-12 | 29,972 | 69,722 | 9,835,838 | 551,174 | 10,486,706 | $20.38 | 2.0% |
| `2e8201ef` · `main` · 2026-05-26→2026-05-31 | 23,304 | 125,236 | 17,188,249 | 463,303 | 17,800,092 | $16.47 | 1.6% |
| `82bd4980` · `claude/silly-tu-56b768` · 2026-06-28→2026-06-28 | 100,323 | 143,028 | 15,568,679 | 453,631 | 16,265,661 | $15.64 | 1.5% |
| `3119fc94` · `claude/determined-maxwell-019a92` · 2026-07-06→2026-07-06 | 24,734 | 98,972 | 8,465,005 | 567,268 | 9,155,979 | $12.50 | 1.2% |
| `c4a4a82c` · `claude/epic-ellis-90e84e` · 2026-07-10→2026-07-10 | 27,605 | 28,939 | 6,441,890 | 216,145 | 6,714,579 | $12.49 | 1.2% |
| `3ceb5190` · `claude/reverent-ramanujan-26c26e` · 2026-07-12→2026-07-12 | 24,292 | 119,812 | 11,292,322 | 227,506 | 11,663,932 | $11.04 | 1.1% |
| `9d461922` · `claude/friendly-elgamal-575049` · 2026-07-03→2026-07-03 | 25,576 | 100,295 | 11,513,957 | 199,571 | 11,839,399 | $10.39 | 1.0% |
| `3994fb80` · `claude/unruffled-kare-fbabf7` · 2026-06-29→2026-06-29 | 24,711 | 68,839 | 10,372,678 | 324,518 | 10,790,746 | $10.28 | 1.0% |
| `f484218c` · `claude/funny-bun-28f4f4` · 2026-07-01→2026-07-01 | 29,609 | 93,166 | 10,125,324 | 190,096 | 10,438,195 | $9.44 | 0.9% |
| `4f6667ef` · `claude/sad-villani-ed1aba` · 2026-06-30→2026-06-30 | 25,447 | 93,475 | 9,453,150 | 203,941 | 9,776,013 | $9.23 | 0.9% |
| `b7345019` · `claude/distracted-morse-689db5` · 2026-07-09→2026-07-09 | 25,376 | 101,143 | 8,824,310 | 176,081 | 9,126,910 | $8.83 | 0.8% |
| `5a14cde8` · `claude/sync-opchain-skills-c99909` · 2026-07-12→2026-07-12 | 24,265 | 64,469 | 6,451,951 | 355,918 | 6,896,603 | $8.52 | 0.8% |
| `2d8074bb` · `claude/eager-dhawan-38def8` · 2026-07-10→2026-07-10 | 19,327 | 76,439 | 1,253,169 | 142,838 | 1,491,773 | $8.13 | 0.8% |
| `257f31bb` · `claude/fervent-euler-f378ef` · 2026-07-13→2026-07-13 | 23,982 | 103,354 | 7,114,501 | 178,922 | 7,420,759 | $8.05 | 0.8% |
| `24c401f6` · `design/changelog-layout-options` · 2026-06-05→2026-06-06 | 110 | 143,338 | 9,702,073 | 397,129 | 10,242,650 | $7.44 | 0.7% |
| `f7dab5e1` · `claude/theopchain-skill-updates-92616b` · 2026-07-10→2026-07-10 | 24,540 | 46,446 | 2,558,536 | 98,340 | 2,727,862 | $7.09 | 0.7% |
| `94852c17` · `claude/dazzling-proskuriakova-fba3fa` · 2026-07-12→2026-07-12 | 23,290 | 21,170 | 2,326,774 | 82,197 | 2,453,431 | $5.26 | 0.5% |
| `150261f6` · `claude/zen-lewin-0d3126` · 2026-07-04→2026-07-04 | 24,234 | 58,933 | 4,686,721 | 121,690 | 4,891,578 | $5.15 | 0.5% |
| `5c9508db` · `claude/nifty-northcutt-4f1f9c` · 2026-07-10→2026-07-10 | 25,024 | 62,763 | 4,085,088 | 123,882 | 4,296,757 | $4.98 | 0.5% |
| `5b986f55` · `claude/strange-gagarin-93fd80` · 2026-07-02→2026-07-02 | 24,671 | 50,142 | 4,233,053 | 147,547 | 4,455,413 | $4.97 | 0.5% |
| `bdb6c4f8` · `claude/wizardly-hamilton-8ccf05` · 2026-06-28→2026-06-28 | 23,515 | 65,118 | 3,683,989 | 130,678 | 3,903,300 | $4.89 | 0.5% |
| `447a14c2` · `claude/vigilant-poitras-81ddab` · 2026-07-14→2026-07-14 | 23,416 | 54,592 | 2,648,795 | 115,820 | 2,842,623 | $3.96 | 0.4% |
| `67b6fc5d` · `claude/focused-noyce-8d3046` · 2026-06-30→2026-06-30 | 23,222 | 32,799 | 3,144,935 | 109,854 | 3,310,810 | $3.61 | 0.3% |
| `ef420082` · `claude/funny-turing-7a47c5` · 2026-07-08→2026-07-08 | 24,301 | 35,472 | 1,732,348 | 58,438 | 1,850,559 | $2.46 | 0.2% |
| `163673e3` · `claude/frosty-panini-598db8` · 2026-07-04→2026-07-04 | 18,600 | 7,843 | 190,197 | 41,521 | 258,161 | $1.60 | 0.1% |
| `5b4adb55` · `claude/heuristic-kapitsa-364ba4` · 2026-07-07→2026-07-07 | 24,154 | 17,219 | 726,552 | 60,291 | 828,216 | $1.52 | 0.1% |
| `2b8df57d` · `claude/awesome-lovelace-148138` · 2026-07-05→2026-07-05 | 23,965 | 12,891 | 336,602 | 57,531 | 430,989 | $1.19 | 0.1% |
| `6c7e6600` · `claude/opchain-skills-sync-prompt-391f3f` · 2026-07-12→2026-07-12 | 22,760 | 12,409 | 213,308 | 42,432 | 290,909 | $0.95 | 0.1% |
| `bf247cac` · `main` · 2026-07-13→2026-07-13 | 22,723 | 1,453 | 200,197 | 39,685 | 264,058 | $0.65 | 0.1% |
| `b49d062c` · `codex/1-7-release` · 2026-07-06→2026-07-06 | 23,138 | 1,299 | 121,794 | 37,690 | 183,921 | $0.59 | 0.1% |
| `f396237f` · `claude/competent-chaplygin-679357` · 2026-07-03→2026-07-03 | 23,741 | 503 | 63,060 | 40,700 | 128,004 | $0.57 | 0.1% |
| `880e4f78` · `codex/1-7-release` · 2026-07-08→2026-07-08 | 23,656 | 848 | 61,742 | 38,136 | 124,382 | $0.55 | 0.1% |
| `6d92b43e` · `claude/nostalgic-wiles-a1b9a8` · 2026-06-28→2026-06-28 | 22,750 | 1,390 | 19,748 | 12,325 | 56,213 | $0.28 | 0.0% |

## By PR — per-message attribution

_Each entry's tokens bucketed to the PR of its own `gitBranch`. Named branches with no PR and `main`/`HEAD` entries are shown as `unattributed` rather than force-fit._

| PR / bucket | input | output | cache-read | cache-write | total | est. cost | % cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| [PR #376] MERGED — fix(skills): make checkpoint writing + shared protoc | 3,873,451 | 1,048,721 | 76,594,230 | 9,055,681 | 90,572,083 | $265.83 | 25.5% |
| [PR #384] MERGED — fix(architecture): resolve 61 layout + formatting de | 506,038 | 917,093 | 92,886,820 | 3,811,202 | 98,121,153 | $98.01 | 9.4% |
| [PR #387] MERGED — docs(skills): wire the v1.8 quality-gate rail (oc-do | 1,117,921 | 318,568 | 23,357,681 | 2,635,257 | 27,429,427 | $85.35 | 8.2% |
| _unattributed branch: claude/opchain-self-improving-skills-57efac_ | 791,205 | 533,643 | 19,229,694 | 3,520,681 | 24,075,223 | $72.75 | 7.0% |
| [PR #245] MERGED — feat(changelog): v1.5/v1.6/v1.7 roadmap + curated st | 36,322 | 299,900 | 19,706,002 | 3,372,412 | 23,414,636 | $51.26 | 4.9% |
| [PR #372] MERGED — feat(blog): backfill launch-window posts, stage next | 26,720 | 156,298 | 22,141,675 | 653,458 | 22,978,151 | $43.29 | 4.2% |
| [PR #399] MERGED — feat(install): update-check hook + catalogVersion in | 25,806 | 65,545 | 18,239,913 | 531,401 | 18,862,665 | $32.40 | 3.1% |
| [PR #383] MERGED — feat(architecture): v1.8 quality-gate rail (docs-for | 27,853 | 147,183 | 30,746,819 | 998,312 | 31,920,167 | $29.18 | 2.8% |
| [PR #374] MERGED — chore(blog): drop the Jul 3 post to the drawer; docu | 3,250 | 31,723 | 11,313,965 | 769,570 | 12,118,508 | $28.32 | 2.7% |
| _unattributed branch: codex/1-7-release_ | 84,820 | 78,669 | 9,735,750 | 752,795 | 10,652,034 | $27.47 | 2.6% |
| [PR #389] MERGED — release: v1.8.0 "Documentation & repo hygiene" | 8,768 | 48,002 | 22,799,130 | 96,782 | 22,952,682 | $27.22 | 2.6% |
| [PR #392] MERGED — fix(worker): serve /api/health with Cache-Control: n | 27,934 | 127,274 | 11,137,502 | 553,928 | 11,846,638 | $26.61 | 2.5% |
| [PR #373] MERGED — feat(blog): pre-write Jul 6 + Jul 8 posts as staged  | 2,731 | 40,746 | 7,819,556 | 674,372 | 8,537,405 | $23.37 | 2.2% |
| _unattributed branch: claude/font-cls-fix_ | 8,883 | 81,327 | 34,096,600 | 129,904 | 34,316,714 | $20.42 | 2.0% |
| [PR #393] MERGED — fix(api): make /api/health uncacheable, cache-bust d | 29,298 | 50,806 | 8,271,065 | 442,583 | 8,793,752 | $18.04 | 1.7% |
| [PR #364] MERGED — docs(reports): regenerate token report — per-message | 100,190 | 141,438 | 15,030,848 | 451,414 | 15,723,890 | $15.31 | 1.5% |
| [PR #382] CLOSED — docs(reports): token+cost audit 2026-07-06 (per-mess | 24,734 | 98,972 | 8,465,005 | 567,268 | 9,155,979 | $12.50 | 1.2% |
| [PR #388] MERGED — fix(roadmap): re-pin distribution play to v1.9 — v1. | 27,605 | 28,939 | 6,441,890 | 216,145 | 6,714,579 | $12.49 | 1.2% |
| _unattributed branch: claude/reverent-ramanujan-26c26e_ | 24,292 | 119,812 | 11,292,322 | 227,506 | 11,663,932 | $11.04 | 1.1% |
| _unattributed branch: claude/friendly-elgamal-575049_ | 25,576 | 100,295 | 11,513,957 | 199,571 | 11,839,399 | $10.39 | 1.0% |
| _unattributed branch: claude/unruffled-kare-fbabf7_ | 24,711 | 68,839 | 10,372,678 | 324,518 | 10,790,746 | $10.28 | 1.0% |
| _unattributed branch: claude/funny-bun-28f4f4_ | 29,609 | 93,166 | 10,125,324 | 190,096 | 10,438,195 | $9.44 | 0.9% |
| [PR #371] MERGED — Sync skills to released checkpoint-protocol upgrade  | 25,447 | 93,475 | 9,453,150 | 203,941 | 9,776,013 | $9.23 | 0.9% |
| _unattributed branch: claude/distracted-morse-689db5_ | 25,376 | 101,143 | 8,824,310 | 176,081 | 9,126,910 | $8.83 | 0.8% |
| [PR #397] MERGED — docs(changelog): surface the v1.8.1 patch on /change | 24,265 | 64,469 | 6,451,951 | 355,918 | 6,896,603 | $8.52 | 0.8% |
| _unattributed branch: claude/eager-dhawan-38def8_ | 19,327 | 76,439 | 1,253,169 | 142,838 | 1,491,773 | $8.13 | 0.8% |
| _unattributed branch: claude/fervent-euler-f378ef_ | 23,982 | 103,354 | 7,114,501 | 178,922 | 7,420,759 | $8.05 | 0.8% |
| _unattributed branch: claude/theopchain-skill-updates-92616b_ | 24,540 | 46,446 | 2,558,536 | 98,340 | 2,727,862 | $7.09 | 0.7% |
| [PR #257] MERGED — design: 4 changelog side-by-side layout options | 90 | 127,918 | 6,967,014 | 374,230 | 7,469,252 | $6.25 | 0.6% |
| [PR #398] MERGED — fix(tests): flags-skills fixture resolves node_modul | 23,290 | 21,170 | 2,326,774 | 82,197 | 2,453,431 | $5.26 | 0.5% |
| _unattributed branch: claude/zen-lewin-0d3126_ | 24,234 | 58,933 | 4,686,721 | 121,690 | 4,891,578 | $5.15 | 0.5% |
| _unattributed branch: claude/nifty-northcutt-4f1f9c_ | 25,024 | 62,763 | 4,085,088 | 123,882 | 4,296,757 | $4.98 | 0.5% |
| _unattributed branch: claude/strange-gagarin-93fd80_ | 24,671 | 50,142 | 4,233,053 | 147,547 | 4,455,413 | $4.97 | 0.5% |
| [PR #362] MERGED — docs(reports): regenerate token report from full loc | 23,515 | 65,118 | 3,683,989 | 130,678 | 3,903,300 | $4.89 | 0.5% |
| [PR #390] MERGED — docs(audits): land the 2026-06-29 checkpoint-system  | 153 | 6,524 | 4,204,464 | 10,527 | 4,221,668 | $4.74 | 0.5% |
| [PR #386] MERGED — fix(architecture): remove auto-cycle to eliminate /a | 155 | 8,600 | 7,377,954 | 10,806 | 7,397,515 | $4.01 | 0.4% |
| _unattributed branch: claude/vigilant-poitras-81ddab_ | 23,416 | 54,592 | 2,648,795 | 115,820 | 2,842,623 | $3.96 | 0.4% |
| _unattributed branch: claude/focused-noyce-8d3046_ | 23,222 | 32,799 | 3,144,935 | 109,854 | 3,310,810 | $3.61 | 0.3% |
| _unattributed (main/HEAD/none)_ | 23,530 | 21,959 | 2,302,801 | 150,493 | 2,498,783 | $3.32 | 0.3% |
| _unattributed branch: claude/funny-turing-7a47c5_ | 24,301 | 35,472 | 1,732,348 | 58,438 | 1,850,559 | $2.46 | 0.2% |
| _unattributed branch: claude/frosty-panini-598db8_ | 18,600 | 7,843 | 190,197 | 41,521 | 258,161 | $1.60 | 0.1% |
| _unattributed branch: claude/heuristic-kapitsa-364ba4_ | 24,154 | 17,219 | 726,552 | 60,291 | 828,216 | $1.52 | 0.1% |
| [PR #263] MERGED — design(changelog): round 2-3 layout explorations — b | 20 | 15,420 | 2,735,059 | 22,899 | 2,773,398 | $1.19 | 0.1% |
| _unattributed branch: claude/awesome-lovelace-148138_ | 23,965 | 12,891 | 336,602 | 57,531 | 430,989 | $1.19 | 0.1% |
| _unattributed branch: claude/opchain-skills-sync-prompt-391f3f_ | 22,760 | 12,409 | 213,308 | 42,432 | 290,909 | $0.95 | 0.1% |
| _unattributed branch: claude/competent-chaplygin-679357_ | 23,741 | 503 | 63,060 | 40,700 | 128,004 | $0.57 | 0.1% |
| _unattributed branch: claude/nostalgic-wiles-a1b9a8_ | 22,750 | 1,390 | 19,748 | 12,325 | 56,213 | $0.28 | 0.0% |

## By PR — session-dominant attribution

_Each session's entire tokens bucketed to the branch appearing in the majority of its entries._

| PR / bucket | input | output | cache-read | cache-write | total | est. cost | % cost |
|---|--:|--:|--:|--:|--:|--:|--:|
| [PR #376] MERGED — fix(skills): make checkpoint writing + shared protoc | 3,873,451 | 1,048,721 | 76,594,230 | 9,055,681 | 90,572,083 | $265.83 | 25.5% |
| [PR #384] MERGED — fix(architecture): resolve 61 layout + formatting de | 542,929 | 1,154,203 | 165,108,193 | 4,950,224 | 171,755,549 | $151.63 | 14.6% |
| [PR #372] MERGED — feat(blog): backfill launch-window posts, stage next | 32,701 | 228,767 | 41,275,196 | 2,097,400 | 43,634,064 | $94.99 | 9.1% |
| [PR #387] MERGED — docs(skills): wire the v1.8 quality-gate rail (oc-do | 1,117,921 | 318,568 | 23,357,681 | 2,635,257 | 27,429,427 | $85.35 | 8.2% |
| _unattributed branch: claude/opchain-self-improving-skills-57efac_ | 791,205 | 533,643 | 19,229,694 | 3,520,681 | 24,075,223 | $72.75 | 7.0% |
| [PR #389] MERGED — release: v1.8.0 "Documentation & repo hygiene" | 46,947 | 131,048 | 36,555,808 | 784,278 | 37,518,081 | $58.30 | 5.6% |
| _unattributed (main/HEAD/none)_ | 58,082 | 241,421 | 12,090,728 | 3,121,133 | 15,511,364 | $42.90 | 4.1% |
| [PR #399] MERGED — feat(install): update-check hook + catalogVersion in | 25,806 | 65,545 | 18,239,913 | 531,401 | 18,862,665 | $32.40 | 3.1% |
| [PR #392] MERGED — fix(worker): serve /api/health with Cache-Control: n | 27,934 | 127,274 | 11,137,502 | 553,928 | 11,846,638 | $26.61 | 2.5% |
| [PR #393] MERGED — fix(api): make /api/health uncacheable, cache-bust d | 29,972 | 69,722 | 9,835,838 | 551,174 | 10,486,706 | $20.38 | 2.0% |
| [PR #364] MERGED — docs(reports): regenerate token report — per-message | 100,323 | 143,028 | 15,568,679 | 453,631 | 16,265,661 | $15.64 | 1.5% |
| [PR #382] CLOSED — docs(reports): token+cost audit 2026-07-06 (per-mess | 24,734 | 98,972 | 8,465,005 | 567,268 | 9,155,979 | $12.50 | 1.2% |
| [PR #388] MERGED — fix(roadmap): re-pin distribution play to v1.9 — v1. | 27,605 | 28,939 | 6,441,890 | 216,145 | 6,714,579 | $12.49 | 1.2% |
| _unattributed branch: claude/reverent-ramanujan-26c26e_ | 24,292 | 119,812 | 11,292,322 | 227,506 | 11,663,932 | $11.04 | 1.1% |
| _unattributed branch: claude/friendly-elgamal-575049_ | 25,576 | 100,295 | 11,513,957 | 199,571 | 11,839,399 | $10.39 | 1.0% |
| _unattributed branch: claude/unruffled-kare-fbabf7_ | 24,711 | 68,839 | 10,372,678 | 324,518 | 10,790,746 | $10.28 | 1.0% |
| [PR #245] MERGED — feat(changelog): v1.5/v1.6/v1.7 roadmap + curated st | 975 | 83,712 | 8,294,535 | 378,692 | 8,757,914 | $10.03 | 1.0% |
| _unattributed branch: claude/funny-bun-28f4f4_ | 29,609 | 93,166 | 10,125,324 | 190,096 | 10,438,195 | $9.44 | 0.9% |
| [PR #371] MERGED — Sync skills to released checkpoint-protocol upgrade  | 25,447 | 93,475 | 9,453,150 | 203,941 | 9,776,013 | $9.23 | 0.9% |
| _unattributed branch: claude/distracted-morse-689db5_ | 25,376 | 101,143 | 8,824,310 | 176,081 | 9,126,910 | $8.83 | 0.8% |
| [PR #397] MERGED — docs(changelog): surface the v1.8.1 patch on /change | 24,265 | 64,469 | 6,451,951 | 355,918 | 6,896,603 | $8.52 | 0.8% |
| _unattributed branch: claude/eager-dhawan-38def8_ | 19,327 | 76,439 | 1,253,169 | 142,838 | 1,491,773 | $8.13 | 0.8% |
| _unattributed branch: claude/fervent-euler-f378ef_ | 23,982 | 103,354 | 7,114,501 | 178,922 | 7,420,759 | $8.05 | 0.8% |
| _unattributed branch: claude/theopchain-skill-updates-92616b_ | 24,540 | 46,446 | 2,558,536 | 98,340 | 2,727,862 | $7.09 | 0.7% |
| [PR #398] MERGED — fix(tests): flags-skills fixture resolves node_modul | 23,290 | 21,170 | 2,326,774 | 82,197 | 2,453,431 | $5.26 | 0.5% |
| [PR #257] MERGED — design: 4 changelog side-by-side layout options | 78 | 104,138 | 6,487,950 | 286,502 | 6,878,668 | $5.23 | 0.5% |
| _unattributed branch: claude/zen-lewin-0d3126_ | 24,234 | 58,933 | 4,686,721 | 121,690 | 4,891,578 | $5.15 | 0.5% |
| _unattributed branch: claude/nifty-northcutt-4f1f9c_ | 25,024 | 62,763 | 4,085,088 | 123,882 | 4,296,757 | $4.98 | 0.5% |
| _unattributed branch: claude/strange-gagarin-93fd80_ | 24,671 | 50,142 | 4,233,053 | 147,547 | 4,455,413 | $4.97 | 0.5% |
| [PR #362] MERGED — docs(reports): regenerate token report from full loc | 23,515 | 65,118 | 3,683,989 | 130,678 | 3,903,300 | $4.89 | 0.5% |
| _unattributed branch: claude/vigilant-poitras-81ddab_ | 23,416 | 54,592 | 2,648,795 | 115,820 | 2,842,623 | $3.96 | 0.4% |
| _unattributed branch: claude/focused-noyce-8d3046_ | 23,222 | 32,799 | 3,144,935 | 109,854 | 3,310,810 | $3.61 | 0.3% |
| _unattributed branch: claude/funny-turing-7a47c5_ | 24,301 | 35,472 | 1,732,348 | 58,438 | 1,850,559 | $2.46 | 0.2% |
| _unattributed branch: claude/frosty-panini-598db8_ | 18,600 | 7,843 | 190,197 | 41,521 | 258,161 | $1.60 | 0.1% |
| _unattributed branch: claude/heuristic-kapitsa-364ba4_ | 24,154 | 17,219 | 726,552 | 60,291 | 828,216 | $1.52 | 0.1% |
| [PR #263] MERGED — design(changelog): round 2-3 layout explorations — b | 20 | 15,420 | 2,735,059 | 22,899 | 2,773,398 | $1.19 | 0.1% |
| _unattributed branch: claude/awesome-lovelace-148138_ | 23,965 | 12,891 | 336,602 | 57,531 | 430,989 | $1.19 | 0.1% |
| _unattributed branch: codex/1-7-release_ | 46,794 | 2,147 | 183,536 | 75,826 | 308,303 | $1.14 | 0.1% |
| _unattributed branch: claude/opchain-skills-sync-prompt-391f3f_ | 22,760 | 12,409 | 213,308 | 42,432 | 290,909 | $0.95 | 0.1% |
| _unattributed branch: claude/competent-chaplygin-679357_ | 23,741 | 503 | 63,060 | 40,700 | 128,004 | $0.57 | 0.1% |
| _unattributed branch: claude/nostalgic-wiles-a1b9a8_ | 22,750 | 1,390 | 19,748 | 12,325 | 56,213 | $0.28 | 0.0% |

### Attribution divergence (>20% between the two modes)

_PRs whose per-message vs session-dominant cost differ >20% of the larger — sessions that sprawled across branches, so their PR attribution is genuinely ambiguous._

| PR | title | per-message | session-dominant | Δ | Δ% |
|---|---|--:|--:|--:|--:|
| PR #384 | fix(architecture): resolve 61 layout + formatt | $98.01 | $151.63 | $53.61 | 35.4% |
| PR #372 | feat(blog): backfill launch-window posts, stag | $43.29 | $94.99 | $51.70 | 54.4% |
| PR #245 | feat(changelog): v1.5/v1.6/v1.7 roadmap + cura | $51.26 | $10.03 | $41.22 | 80.4% |
| PR #389 | release: v1.8.0 "Documentation & repo hygiene" | $27.22 | $58.30 | $31.08 | 53.3% |
| PR #383 | feat(architecture): v1.8 quality-gate rail (do | $29.18 | $0.00 | $29.18 | 100.0% |
| PR #374 | chore(blog): drop the Jul 3 post to the drawer | $28.32 | $0.00 | $28.32 | 100.0% |
| PR #373 | feat(blog): pre-write Jul 6 + Jul 8 posts as s | $23.37 | $0.00 | $23.37 | 100.0% |
| PR #390 | docs(audits): land the 2026-06-29 checkpoint-s | $4.74 | $0.00 | $4.74 | 100.0% |
| PR #386 | fix(architecture): remove auto-cycle to elimin | $4.01 | $0.00 | $4.01 | 100.0% |

_Δ%=100% means the branch was never any session's **dominant** branch — its cost lands on other PRs under session-dominant mode (minority-branch work absorbed by the session's main PR)._

## Methodology & caveats

- **Dedup:** by message.id, max per token bucket (collapses streaming-snapshot lines). Streaming writes each `message.id` 2–3× with growing `output_tokens`; counting raw lines overstates output ~2.1×.
- **Append-safe merge:** merged on message_id with the prior fact table; fresh rows win, prior-only rows (rotated-off transcripts) preserved verbatim at their original pricing epoch. Preserved 214 rows (2026-05-26→06-06) whose transcripts have rotated off disk; re-runs key on `message_id`.
- **Mixed pricing epochs:** {"oc-claude-api@2026-07-14": 4317, "anthropic-list-2026-06-28": 214}. Historical rows keep their original epoch (incl. `claude-opus-4-7`/`claude-sonnet-4-6`, absent from the current rate table — their cost is carried, not re-derived).
- **Pricing (USD/Mtok):** `claude-fable-5` 10.0/50.0, `claude-opus-4-8` 5.0/25.0, `claude-sonnet-4-6` 3.0/15.0, `claude-haiku-4-5` 1.0/5.0. Cache read ×0.1, write ×1.25 (5m) / ×2.0 (1h). No batch discount (interactive traffic).
- **1-hour cache writes matter:** ~42% of fresh cache-write tokens are 1h-TTL and priced at 2× (not the flat 1.25× in the task snapshot); pricing them flat would understate cost.
- **Attribution — PR:** exact gitBranch->PR head match; PR-less named branches and main/HEAD left unattributed (no timestamp guessing; inferred=false).
- **Attribution — release:** timestamp bucketed into [tag_i, tag_i+1), labeled by the tag OPENING the window; pre-first-tag=unreleased.
- **Unattributed** (per-message) covers PR-less named branches (squash-merged/cherry-picked/exploratory) and `main`/`HEAD` work — broken out by branch in the per-message table, not hidden.
- All timestamps UTC. `gh` authenticated; PR states resolved live.

_Machine-readable layer alongside this report: `fact_token_usage.csv` (one row per billable `message.id`), `aggregates.json`, `meta.json`, `dashboard_export.json`. Checkpoint: `.checkpoints/oc-cost-ops.checkpoint.json`._
