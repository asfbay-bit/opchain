#!/usr/bin/env python3
"""Emit token-report-<date>.md, dashboard_export.json, and the cost checkpoint."""
import os, json, csv, collections

SP = os.path.dirname(os.path.abspath(__file__))
RS = json.load(open(os.path.join(SP, "run_stats.json")))
RUN_DATE = "2026-07-19"
agg = json.load(open(os.path.join(SP, "aggregates.json")))
meta = json.load(open(os.path.join(SP, "meta.json")))
rows = list(csv.DictReader(open(os.path.join(SP, "fact_token_usage.csv"))))
prs = {p["number"]: p for p in json.load(open(os.path.join(SP, "prs.json")))}

T = agg["totals"]


def n(x):
    return f"{int(x):,}"


def money(x):
    return f"${x:,.2f}"


def table(rows_, label, extra=None):
    hdr = f"| {label} | input | output | cache-read | cache-write | total tokens | est. cost | % cost |"
    sep = "|---|---:|---:|---:|---:|---:|---:|---:|"
    if extra:
        hdr = hdr.replace(f"| {label} |", f"| {label} | {' | '.join(extra[0])} |")
        sep = "|---|" + "---|" * len(extra[0]) + "---:|" * 7
    out = [hdr, sep]
    for r in rows_:
        pre = ""
        if extra:
            pre = " " + " | ".join(extra[1](r)) + " |"
        out.append(
            f"| {r['key']} |{pre} {n(r['input_tokens'])} | {n(r['output_tokens'])} | "
            f"{n(r['cache_read_tokens'])} | {n(r['cache_write_tokens'])} | "
            f"{n(r['total_tokens'])} | {money(r['cost_usd'])} | {r['pct_of_total_cost']}% |")
    return "\n".join(out)


def pr_label(key):
    if key == "unattributed":
        return "unattributed"
    num = int(key.lstrip("#"))
    p = prs.get(num)
    if not p:
        return key
    title = p["title"][:52]
    state = p["state"].lower()
    return f"[{key}](https://github.com/asfbay-bit/opchain/pull/{num}) {title} _{state}_"


fresh = [r for r in rows if r["pricing_version"] == meta["pricing"]["version"]]
prior = [r for r in rows if r["pricing_version"] != meta["pricing"]["version"]]
fresh_cost = sum(float(r["cost_usd"] or 0) for r in fresh)
prior_cost = sum(float(r["cost_usd"] or 0) for r in prior)
w5 = sum(int(r["cache_write_5m_tokens"] or 0) for r in fresh)
w1 = sum(int(r["cache_write_1h_tokens"] or 0) for r in fresh)

md = []
A = md.append
A(f"# Claude Code token + cost report — {RUN_DATE}")
A("")
A(f"**Repo:** `opchain` · **Window:** {meta['date_range']['start']} → {meta['date_range']['end']} · "
  f"**Sessions:** {meta['session_count']} · **Messages:** {n(meta['entry_count'])}")
A("")
A("## Totals")
A("")
A("| bucket | tokens |")
A("|---|---:|")
A(f"| input | {n(T['input_tokens'])} |")
A(f"| output | {n(T['output_tokens'])} |")
A(f"| cache read | {n(T['cache_read_tokens'])} |")
A(f"| cache write | {n(T['cache_write_tokens'])} |")
A(f"| **total** | **{n(T['total_tokens'])}** |")
A("")
A(f"### Estimated cost: **{money(T['cost_usd'])}**")
A("")
A(f"- **This run's window** (2026-06-28 → {meta['date_range']['end']}, {n(len(fresh))} messages): **{money(fresh_cost)}**")
A(f"- **Preserved history** (2026-05-26 → 2026-06-06, {n(len(prior))} rows whose transcripts have rotated off disk): {money(prior_cost)}, carried at their original pricing epoch (`{prior[0]['pricing_version']}`).")
A(f"- **Prior ledger** — merged append-safe against the {RS['prior_ledger']['source']}: {n(RS['prior_ledger']['rows'])} rows / {money(RS['prior_ledger']['total_usd'])}. This run adds **{money(T['cost_usd'] - RS['prior_ledger']['total_usd'])}**. Against the latest *committed* report (`{RS['latest_committed_ledger']['commit']}`, {RS['latest_committed_ledger']['date']}, {money(RS['latest_committed_ledger']['total_usd'])}) the delta is **{money(T['cost_usd'] - RS['latest_committed_ledger']['total_usd'])}**.")
A("")
A("## Method notes (why these numbers differ from a naive parse)")
A("")
A(f"- **Per-message dedup.** Claude Code writes one transcript line per *content block*, each repeating the message's cumulative `usage`. Counted once per `(session_id, message.id)` taking the **max per field** — {n(RS['assistant_lines'])} assistant lines collapsed to {n(RS['message_ids'])} billable messages (**{RS['dedup_factor']}×**). Summing per line would report **{money(RS['naive_per_line_cost_usd'])}** — the 2026-06 reporting bug.")
A(f"- **Cache-write TTL is a split, not a flat rate.** Fresh writes: {n(w5)} × 1.25× (5m) + {n(w1)} × 2.0× (1h) — {100*w1/(w5+w1):.1f}% at the 1-hour rate. Pricing all writes flat-1.25× would understate this window by {money(RS['flat125_understatement_usd'])}.")
A(f"- **Subagent transcripts counted.** {n(RS['files_nested_subagent'])} of the {n(RS['files_matched'])} matched files are nested `subagents/**/agent-*.jsonl` — separate API conversations that bill for real and never appear in the parent transcript.")
A(f"- **Discovery scans every line for `cwd`, not just line 1.** Sessions that open with a `queue-operation` record (scheduled tasks, notably this one) carry `cwd` on lines 2–4; a `head -1` filter silently drops them — {n(RS['files_matched'])} files matched ({n(RS['files_top_level'])} top-level + {n(RS['files_nested_subagent'])} nested) vs {n(RS['files_head1_would_match'])} with the line-1 filter, out of {n(RS['files_scanned'])} scanned ({RS['files_no_cwd_excluded']} had no `cwd` at all and carry zero assistant lines).")
A(f"- **{n(meta['merge']['excluded_zero_token_synthetic'])} zero-token `<synthetic>` rows excluded** (no API call, no spend).")
A("- **No Batch discount applied** — `service_tier` is `standard` on every fresh entry.")
A("")
A("## By model")
A("")
A(table(agg["by_model"], "model"))
A("")
A("`claude-sonnet-4-6` and `claude-opus-4-7` are **preserved-history only** (zero fresh entries). `claude-opus-4-7` has no rate in `model-routing.md` — it is **[unpriced]** for any new usage; the figure above is carried from its original epoch, not re-estimated.")
A("")
A("## By chat (session)")
A("")
top_sessions = agg["by_session"][:25]
A(table(top_sessions, "session",
        (["first seen", "branch"],
         lambda r: [r["first_ts"][:16].replace("T", " "), f"`{r['dominant_branch'][:34] or '—'}`"])))
A("")
A(f"_Top 25 of {len(agg['by_session'])} sessions by cost._")
A("")
A("## By PR — per-message attribution")
A("")
A("Each message's tokens bucket to the PR matching its own `gitBranch`.")
A("")
A(table([{**r, "key": pr_label(r["key"])} for r in agg["by_pr_permessage"][:20]], "PR"))
A("")
A("## By PR — session-dominant attribution")
A("")
A("Each session's *entire* spend buckets to the branch appearing in the majority of its messages.")
A("")
A(table([{**r, "key": pr_label(r["key"])} for r in agg["by_pr_session_dominant"][:20]], "PR"))
A("")
A("### Divergence flags (>20% cost difference between the two modes)")
A("")
A("| PR | per-message | session-dominant | Δ |")
A("|---|---:|---:|---:|")
for d in agg["divergence"]:
    A(f"| {d['pr']} | {money(d['per_message_usd'])} | {money(d['session_dominant_usd'])} | {d['delta_pct']:+.1f}% |")
A("")
A(f"{len(agg['divergence'])} PRs diverge. These are sessions that sprawled across branches — their attribution is genuinely ambiguous, and the per-message table is the more honest of the two. PRs showing `-100%` (#245, #383, #374 …) were touched mid-session but never dominated one, so session-dominant hands their spend to `unattributed`.")
A("")
A("> **Note:** PRs whose `headRefName` is literally `main` (here, #33) are excluded from the session-dominant branch→PR map. Without that guard every main-dominant session force-maps onto one unrelated April PR, inventing ~$50 of phantom attribution.")
A("")
A("## By release")
A("")
A(table(agg["by_release"], "release window"))
A("")
A("Windows are cut on tag creation dates. `unreleased` is the preserved pre-first-tag history; `post-v1.8.1` is everything since the v1.8.1 tag (2026-07-12) — i.e. work in flight toward the next release.")
A("")
A("## Attribution caveats")
A("")
A(f"- **{money(agg['by_pr_permessage'][1]['cost_usd'] if agg['by_pr_permessage'][1]['key']=='unattributed' else 0)} ({[r for r in agg['by_pr_permessage'] if r['key']=='unattributed'][0]['pct_of_total_cost']}%) is `unattributed`** — exploratory work, on-`main` debugging, reverts, and scheduled tasks that never landed on a PR branch. Shown as its own bucket rather than force-fit.")
A("- Timestamp-window inference runs **only against merged PRs' [created, merged] windows**. Open PRs are unbounded catch-all windows that swallow everything.")
A("- All timestamps UTC.")
A("")

open(os.path.join(SP, f"token-report-{RUN_DATE}.md"), "w").write("\n".join(md) + "\n")
print("wrote report,", len(md), "lines")

# ---------- checkpoint (wire 1.1) ----------
# NOTE: this emits the reconciled `cost` block ONLY, into this directory — it is not the
# file that ships. The committed .checkpoints/oc-cost-ops.checkpoint.json wraps this in the
# full protocol envelope (protocol_version/project/project_dir/created_at/progress_summary/
# next_actions/skill_state/context_primer); `npm run checkpoint:validate` rejects it without
# those. Copy the `cost` object across by hand, or the validator will fail the run.
by_model_cost = {r["key"]: round(r["cost_usd"], 2) for r in agg["by_model"]}
total = round(T["cost_usd"], 2)
# reconcile: Σ by_phase == Σ by_model == total
drift = round(sum(by_model_cost.values()) - total, 2)
if abs(drift) > 0.05:
    raise SystemExit(f"reconciliation failed: by_model {sum(by_model_cost.values())} vs total {total}")
# absorb sub-cent rounding into the largest bucket so Σ by_model == total_usd exactly
by_model_cost_adj = dict(by_model_cost)
if drift:
    biggest = max(by_model_cost_adj, key=by_model_cost_adj.get)
    by_model_cost_adj[biggest] = round(by_model_cost_adj[biggest] - drift, 2)
assert round(sum(by_model_cost_adj.values()), 2) == total, "by_model must sum to total_usd"
ck = {
    "skill": "oc-cost-ops", "wire_version": "1.1", "status": "complete",
    "phase": "report", "step": "retro-analysis",
    "updated_at": "2026-07-19T00:00:00Z",
    "cost": {
        "currency": "USD",
        "total_usd": total,
        # budget_usd intentionally OMITTED — validator rejects null for a retro run
        "by_phase": {"interactive": total},
        "by_model": by_model_cost_adj,
        "tokens": {"input": int(T["input_tokens"]), "output": int(T["output_tokens"])},
        "updated_at": "2026-07-19T00:00:00Z",
    },
}
json.dump(ck, open(os.path.join(SP, "oc-cost-ops.checkpoint.json"), "w"), indent=2)
print("checkpoint reconciled: by_model", sum(by_model_cost.values()), "== total", total)

# ---------- dashboard export ----------
TIER = {"claude-fable-5": "fable", "claude-opus-4-8": "opus", "claude-opus-4-7": "opus",
        "claude-sonnet-4-6": "sonnet", "claude-haiku-4-5": "haiku"}
tier_cost = collections.defaultdict(float)
tier_n = collections.Counter()
for r in rows:
    t = TIER.get(r["model"], "other")
    tier_cost[t] += float(r["cost_usd"] or 0)
    tier_n[t] += 1
weekly = collections.defaultdict(lambda: {"cost_usd": 0.0, "entries": 0})
for r in rows:
    wk = weekly[r["iso_week"]]
    wk["cost_usd"] += float(r["cost_usd"] or 0)
    wk["entries"] += 1
# k-anonymity: <5 entries folds into "other"
weekly_k, other = {}, {"cost_usd": 0.0, "entries": 0}
for k, v in weekly.items():
    if v["entries"] < 5:
        other["cost_usd"] += v["cost_usd"]; other["entries"] += v["entries"]
    else:
        weekly_k[k] = {"cost_usd": round(v["cost_usd"], 2), "entries": v["entries"]}
if other["entries"]:
    weekly_k["other"] = {"cost_usd": round(other["cost_usd"], 2), "entries": other["entries"]}

merged_prs = {r["pr_number"] for r in rows if r["pr_number"] and r["pr_state"] == "MERGED"}
dash = {
    "_note": ("NOT telemetry from .checkpoints/usage.sqlite (opt-in, content-free, cannot be "
              "backfilled). This is a one-shot retro export shaped to the oc-telemetry-ops "
              "contract so it renders on the same /dashboard surface."),
    "generated_at": meta["generated_at"], "schema_version": meta["schema_version"],
    "model_tier_distribution": {
        k: {"cost_usd": round(v, 2), "pct": round(100 * v / total, 1)}
        for k, v in sorted(tier_cost.items(), key=lambda x: -x[1])},
    "avg_cost_per_feature_usd": round(total / len(merged_prs), 2) if merged_prs else None,
    "_avg_cost_per_feature_definition": f"feature = merged PR; {len(merged_prs)} merged PRs carry spend",
    "weekly_cost": dict(sorted(weekly_k.items())),
    "k_anonymity_threshold": 5,
    "pipelines_run": None,
    "by_skill": None,
    "eval_score_trend": None,
    "_null_fields_note": ("pipelines_run / by_skill / eval_score_trend are N/A: interactive "
                          "Claude Code sessions are not skill-pipeline runs, and faking skill "
                          "semantics would corrupt the dashboard's meaning."),
}
json.dump(dash, open(os.path.join(SP, "dashboard_export.json"), "w"), indent=2)
print("wrote dashboard_export.json; avg cost/merged-PR", dash["avg_cost_per_feature_usd"])
