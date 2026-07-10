# Design scratch space

Four directories hold design/mockup HTML at the repo root; this is a map of
what's where and why they're separate, not a plan to merge them (moving files
would break at least one path referenced from `.checkpoints/oc-ux-engineer.checkpoint.json`,
which is session-state history and isn't edited retroactively).

| Dir | What's in it | Status |
|---|---|---|
| `design/` (this dir) | `architecture-v1.6-*` and `architecture-v1.7-proposals.html` — the most recent architecture-diagram design rounds, plus a punchlist | **Current.** Reflects the live site's architecture page. |
| `design-previews/` | HTML mockups from the v1.4–v1.5 era (changelog options, brand/dark/light mode explorations, coverage/compare-table options) | **Archived.** Superseded by what shipped; kept for design-history reference. |
| `mockups/` | `packs-desktop-mockups.html`, `packs-mobile-mockups.html` | **Archived.** Pre-dates the current stack-packs UI. |
| `previews/` | `PROPOSAL.md` (nav-proposal doc) + `preview.html` (iteration sandbox, gitignored from the build) | **Archived / scratch.** Referenced by `.checkpoints/oc-ux-engineer.checkpoint.json` — don't move or delete. |

If you're starting new design work, add it to `design/`. If a file in one of
the other three stops being useful even for history, flag it for deletion
explicitly rather than silently removing it — some of these are still linked
from checkpoint history.
