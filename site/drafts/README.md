# The drawer

Posts that were written, staged, and then deliberately **not** published.
This directory is outside the blog content collection's glob
(`site/src/blog/*.md`), so nothing here can render, feed RSS, or be flipped
live by the scheduled publish bot — moving a file here is the permanent
form of `draft: true`.

To resurrect one: move it back to `site/src/blog/`, re-check its
frontmatter against the calendar runbook (`docs/blog-content-calendar.md`
§4), and give it a fresh date — drawer posts don't keep their original
slot.

| File | Drawered | Why |
|---|---|---|
| `2026-07-03-we-deleted-our-deploy-pipeline-on-purpose.md` | 2026-07-04 | Owner call: the "we deleted CI/CD" take stays unpublished. Slot marked slipped in the calendar. |
