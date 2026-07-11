#!/usr/bin/env python3
"""Steps 4-6: read fact_token_usage.csv (the frozen snapshot) and emit:
  - token-report-<date>.md         (human report)
  - aggregates.json                (pre-rolled summaries)
  - meta.json                      (self-describing manifest)
  - dashboard_export.json          (oc-telemetry-ops export contract)
  - oc-cost-ops.checkpoint.json    (wire-1.1 cost object)
Nothing here re-reads transcripts; the CSV is the single source of truth."""
import csv, json, os, sys, collections, datetime as dt

WORK = sys.argv[1]
REPORT_DATE = sys.argv[2]         # YYYY-MM-DD (UTC)
GENERATED_AT = sys.argv[3]        # UTC ISO8601
CSV = os.path.join(WORK, "fact_token_usage.csv")

PRICING_VERSION = "2026-06-28"
PRICING = {
    "currency": "USD",
    "unit": "per_1e6_tokens",
    "verified_on": "2026-06-28",
    "re_verified_on": "2026-07-09",
    "source": "skills/oc-cost-ops/references/pricing-reference.md + skills/oc-claude-api/references/prompt-caching.md",
    "models": {
        "claude-fable-5":   {"input": 10.0, "output": 50.0},
        "claude-opus-4-8":  {"input": 5.0,  "output": 25.0},
        "claude-sonnet-4-6":{"input": 3.0,  "output": 15.0},
        "claude-haiku-4-5": {"input": 1.0,  "output": 5.0},
    },
    "cache_multipliers": {"cache_read": 0.1, "cache_write_5m": 1.25, "cache_write_1h": 2.0, "basis": "input_price"},
    "batch_discount_applied": False,
    "note": "Interactive Claude Code traffic is not batched; no 50% batch discount applied. Cache writes are priced by TTL from usage.cache_creation: ephemeral_5m at 1.25x input, ephemeral_1h at 2.0x input. opchain top-level sessions use 1h TTL; subagents use 5m.",
}

rows = list(csv.DictReader(open(CSV)))

def I(r,k): return int(r[k])
def F(r,k): return float(r[k])

TIER = {"claude-opus-4-8":"opus","claude-fable-5":"fable","claude-sonnet-4-6":"sonnet","claude-haiku-4-5":"haiku"}

def blank():
    return {"input":0,"output":0,"cache_read":0,"cache_write":0,"total":0,"cost_usd":0.0,"entries":0}

def add(acc, r):
    acc["input"]      += I(r,"input_tokens")
    acc["output"]     += I(r,"output_tokens")
    acc["cache_read"] += I(r,"cache_read_tokens")
    acc["cache_write"]+= I(r,"cache_write_tokens")
    acc["total"]      += I(r,"total_tokens")
    acc["cost_usd"]   += F(r,"cost_usd")
    acc["entries"]    += 1

# ---------- totals ----------
totals = blank()
for r in rows: add(totals, r)
GT_COST = totals["cost_usd"]
def pct(c): return (c/GT_COST*100.0) if GT_COST else 0.0
# cache-write TTL split (columns exist only in the deduped CSV)
CW5 = sum(int(r.get("cache_write_5m_tokens") or 0) for r in rows)
CW1 = sum(int(r.get("cache_write_1h_tokens") or 0) for r in rows)

# ---------- by model ----------
by_model = collections.defaultdict(blank)
for r in rows:
    m = r["model"] or "(unknown)"
    add(by_model[m], r)

# ---------- by session ----------
by_session = collections.defaultdict(blank)
sess_meta = {}
sess_branch_cost = collections.defaultdict(lambda: collections.Counter())  # session -> branch -> cost
for r in rows:
    s = r["session_id"]
    add(by_session[s], r)
    ts = r["timestamp_utc"]
    sm = sess_meta.setdefault(s, {"first":ts,"last":ts,"branches":collections.Counter()})
    if ts:
        if not sm["first"] or ts < sm["first"]: sm["first"]=ts
        if not sm["last"]  or ts > sm["last"]:  sm["last"]=ts
    if r["branch"]:
        sm["branches"][r["branch"]] += 1
    sess_branch_cost[s][r["branch"] or ""] += F(r,"cost_usd")

def dominant_branch(s):
    b = sess_meta[s]["branches"]
    return b.most_common(1)[0][0] if b else ""

# ---------- PR: per-message ----------
# key by pr_number (int) or "unattributed"
def pr_key(r):
    return r["pr_number"] if r["pr_number"] else "unattributed"
by_pr_pm = collections.defaultdict(blank)
pr_title = {}; pr_state = {}
for r in rows:
    k = pr_key(r)
    add(by_pr_pm[k], r)
    if r["pr_number"]:
        pr_title[k]=r["pr_title"]; pr_state[k]=r["pr_state"]

# ---------- PR: session-dominant ----------
# each session's whole tokens -> the branch appearing in majority of its entries -> that branch's PR
# Resolve dominant branch's PR from the rows of that session (mode of pr_number among dominant-branch rows)
by_pr_sd = collections.defaultdict(blank)
# precompute, for each session, the PR that its dominant branch maps to
sess_dom_pr = {}
sess_rows = collections.defaultdict(list)
for r in rows: sess_rows[r["session_id"]].append(r)
for s, rs in sess_rows.items():
    db = dominant_branch(s)
    # among rows of the dominant branch, take modal pr_number
    prs = collections.Counter()
    titles={}; states={}
    for r in rs:
        if (r["branch"] or "") == db and r["pr_number"]:
            prs[r["pr_number"]] += 1
            titles[r["pr_number"]]=r["pr_title"]; states[r["pr_number"]]=r["pr_state"]
    if prs:
        pk = prs.most_common(1)[0][0]
        sess_dom_pr[s] = (pk, titles[pk], states[pk])
    else:
        sess_dom_pr[s] = ("unattributed","","")
for s, rs in sess_rows.items():
    pk,tt,st = sess_dom_pr[s]
    for r in rs:
        add(by_pr_sd[pk], r)
    if pk!="unattributed":
        pr_title.setdefault(pk,tt); pr_state.setdefault(pk,st)

# ---------- divergence flag (>20% of est cost) ----------
divergence = []
allkeys = set(by_pr_pm)|set(by_pr_sd)
for k in allkeys:
    if k=="unattributed": continue
    cpm = by_pr_pm.get(k,blank())["cost_usd"]
    csd = by_pr_sd.get(k,blank())["cost_usd"]
    base = max(cpm,csd)
    if base<=0: continue
    diff = abs(cpm-csd)
    if diff/base > 0.20 and diff > 1.0:  # >20% AND >$1 abs to avoid noise
        divergence.append({"pr_number":k,"title":pr_title.get(k,""),
                           "cost_permessage":round(cpm,2),"cost_session_dominant":round(csd,2),
                           "abs_diff_usd":round(diff,2),"pct_diff":round(diff/base*100,1)})
divergence.sort(key=lambda d:-d["abs_diff_usd"])

# ---------- by release ----------
by_release = collections.defaultdict(blank)
for r in rows: add(by_release[r["release_tag"] or "unattributed"], r)

# ---------- serialization helpers ----------
def row_out(name, acc, extra=None):
    d = {"key":name,
         "input":acc["input"],"output":acc["output"],
         "cache_read":acc["cache_read"],"cache_write":acc["cache_write"],
         "total":acc["total"],"cost_usd":round(acc["cost_usd"],4),
         "pct_of_total_cost":round(pct(acc["cost_usd"]),2),"entries":acc["entries"]}
    if extra: d.update(extra)
    return d

def sorted_rows(dmap, namer=lambda k:k, extra=lambda k:None):
    out=[row_out(namer(k),v,extra(k)) for k,v in dmap.items()]
    out.sort(key=lambda d:-d["cost_usd"])
    return out

agg = {
    "totals": row_out("TOTAL", totals),
    "by_model": sorted_rows(by_model),
    "by_session": sorted_rows(by_session, extra=lambda s:{
        "first_ts":sess_meta[s]["first"],"last_ts":sess_meta[s]["last"],
        "dominant_branch":dominant_branch(s)}),
    "by_pr_permessage": sorted_rows(by_pr_pm, extra=lambda k:{
        "pr_title":pr_title.get(k,""),"pr_state":pr_state.get(k,"")}),
    "by_pr_session_dominant": sorted_rows(by_pr_sd, extra=lambda k:{
        "pr_title":pr_title.get(k,""),"pr_state":pr_state.get(k,"")}),
    "by_release": sorted_rows(by_release),
    "divergence": divergence,
}
json.dump(agg, open(os.path.join(WORK,"aggregates.json"),"w"), indent=2)

# ---------- meta.json ----------
dates=[r["date"] for r in rows if r["date"]]
psum={}
pspath=os.path.join(WORK,"parse_summary.json")
if os.path.exists(pspath):
    psum=json.load(open(pspath))
meta = {
    "generated_at": GENERATED_AT,
    "schema_version": "1.0",
    "date_range": {"start":min(dates) if dates else None,"end":max(dates) if dates else None},
    "session_count": len(by_session),
    "entry_count": len(rows),
    "grain": "one row per (session_id, message.id) = one Anthropic API call",
    "raw_assistant_lines": psum.get("raw_assistant_lines"),
    "deduped_messages": psum.get("deduped_messages_written"),
    "dedup_ratio_lines_per_message": psum.get("dedup_ratio"),
    "files_in_manifest": sum(1 for _ in open(os.path.join(WORK,"sessions.manifest"))),
    "files_processed": psum.get("files_processed"),
    "files_failed": psum.get("files_failed"),
    "repo_root_scope": "/Users/aidanelsesser/repos/opchain (main root + all nested .claude/worktrees/*)",
    "cache_write_ttl_split_tokens": {"ephemeral_5m": CW5, "ephemeral_1h": CW1},
    "pricing": PRICING,
    "pricing_version": PRICING_VERSION,
    "divergence": divergence,
    "notes": [
        "DEDUP: usage is counted once per message.id (one API call). A single assistant message is logged across multiple JSONL lines (one per content block); each repeats the same usage, so per-line summing double-counts. This report dedups by message.id, taking the max-output_tokens (final, complete) usage per message. Prior per-line reports over-counted.",
        "Data captured from live, append-only session transcripts; counts are a point-in-time snapshot and grow as active sessions continue writing.",
        "Scope resolved by launch-cwd prefix under the opchain git repo root; sibling worktrees on other filesystem paths had zero sessions.",
        "<synthetic> model entries are harness placeholders with zero token usage; flagged unpriced, contribute $0.",
        "Only one git tag exists (wip/v1-8-docs-mesh-20260703); release buckets are 'unreleased' (pre-tag) and that tag's post-window.",
    ],
}
json.dump(meta, open(os.path.join(WORK,"meta.json"),"w"), indent=2)

# ---------- checkpoint (wire-1.1 cost object) ----------
by_model_cost = {m:round(v["cost_usd"],4) for m,v in by_model.items() if v["cost_usd"]>0}
sum_model = round(sum(by_model_cost.values()),4)
total_usd = round(GT_COST,4)
by_phase = {"interactive": total_usd}
# reconciliation assert
assert abs(sum(by_phase.values()) - total_usd) < 0.01, "phase sum != total"
assert abs(sum_model - total_usd) < 0.01, f"model sum {sum_model} != total {total_usd}"
checkpoint = {
    "schema": "oc-checkpoint/wire-1.1",
    "skill": "oc-cost-ops",
    "updated_at": GENERATED_AT,
    "cost": {
        "currency":"USD",
        "total_usd": total_usd,
        "budget_usd": None,
        "by_phase": {k:round(v,4) for k,v in by_phase.items()},
        "by_model": by_model_cost,
        "tokens": {"input": totals["input"], "output": totals["output"]},
        "updated_at": GENERATED_AT,
    },
}
json.dump(checkpoint, open(os.path.join(WORK,"oc-cost-ops.checkpoint.json"),"w"), indent=2)

# ---------- dashboard_export.json (oc-telemetry-ops contract, retro) ----------
tier_tokens = collections.Counter()
for m,v in by_model.items():
    tier_tokens[TIER.get(m,"other")] += v["total"]
tot_tier = sum(tier_tokens.values()) or 1
model_tier_distribution = {t: round(c/tot_tier,4) for t,c in tier_tokens.items()}
# merged PRs -> avg cost per feature
merged_pr_costs = []
for k,v in by_pr_pm.items():
    if k=="unattributed": continue
    if pr_state.get(k)=="MERGED":
        merged_pr_costs.append(v["cost_usd"])
avg_cost_per_feature = round(sum(merged_pr_costs)/len(merged_pr_costs),4) if merged_pr_costs else None
# weekly buckets w/ k-anonymity (<5 entries -> other)
week = collections.defaultdict(blank)
for r in rows: add(week[r["iso_week"] or "unknown"], r)
weekly=[]; other=blank()
for wk,v in week.items():
    if v["entries"]<5:
        for kk in other: other[kk]+= (v[kk] if kk!="cost_usd" else 0)
        other["cost_usd"]+=v["cost_usd"];
    else:
        weekly.append({"week":wk,"entries":v["entries"],"total_tokens":v["total"],"cost_usd":round(v["cost_usd"],4)})
if other["entries"]>0:
    weekly.append({"week":"other","entries":other["entries"],"total_tokens":other["total"],"cost_usd":round(other["cost_usd"],4),"note":"folded weeks with <5 entries (k-anonymity)"})
weekly.sort(key=lambda d:d["week"])
dash = {
    "_contract":"oc-telemetry-ops dashboard_export",
    "_disclaimer":"Retroactive one-shot export shaped to match the forward telemetry contract. NOT sourced from .checkpoints/usage.sqlite (opt-in, content-free, cannot be backfilled). Derived from Claude Code session transcripts.",
    "generated_at": GENERATED_AT,
    "model_tier_distribution": model_tier_distribution,
    "avg_cost_per_feature_usd": avg_cost_per_feature,
    "weekly": weekly,
    "pipelines_run": None,
    "by_skill": None,
    "eval_score_trend": None,
    "_null_notes":"pipelines_run/by_skill/eval_score_trend are N/A: interactive CC sessions are not skill-pipeline runs.",
}
json.dump(dash, open(os.path.join(WORK,"dashboard_export.json"),"w"), indent=2)

# ---------- markdown report ----------
def fnum(n): return f"{n:,}"
def fusd(n): return f"${n:,.2f}"
def table(rowsdata, keyhdr, keyfn):
    lines=[f"| {keyhdr} | input | output | cache-read | cache-write | total tokens | est. cost | % cost |",
           "|---|--:|--:|--:|--:|--:|--:|--:|"]
    for d in rowsdata:
        lines.append(f"| {keyfn(d)} | {fnum(d['input'])} | {fnum(d['output'])} | {fnum(d['cache_read'])} | {fnum(d['cache_write'])} | {fnum(d['total'])} | {fusd(d['cost_usd'])} | {d['pct_of_total_cost']:.1f}% |")
    return "\n".join(lines)

md=[]
md.append(f"# Claude Code Token & Cost Report — opchain")
md.append(f"\n_Generated {GENERATED_AT} · pricing snapshot {PRICING_VERSION} (re-verified 2026-07-09 against oc-claude-api / oc-cost-ops references)_\n")
md.append("## Totals\n")
md.append(f"- **Sessions analyzed:** {len(by_session)}  ·  **Messages (API calls):** {len(rows)}  ·  **Transcripts in manifest:** {meta['files_in_manifest']}")
md.append(f"- **Date range (UTC):** {meta['date_range']['start']} → {meta['date_range']['end']}")
if meta.get("raw_assistant_lines"):
    md.append(f"- **Dedup:** {meta['raw_assistant_lines']:,} raw assistant JSONL lines → {meta['deduped_messages']:,} unique `message.id`s ({meta['dedup_ratio_lines_per_message']}× lines/message). Usage counted **once per message.id** (per API call), not per line — per-line summing double-counts multi-block messages.")
md.append("")
md.append("| bucket | tokens |")
md.append("|---|--:|")
md.append(f"| fresh input | {fnum(totals['input'])} |")
md.append(f"| output | {fnum(totals['output'])} |")
md.append(f"| cache read | {fnum(totals['cache_read'])} |")
md.append(f"| cache write | {fnum(totals['cache_write'])} |")
md.append(f"| &nbsp;&nbsp;↳ ephemeral 5-min (1.25×) | {fnum(CW5)} |")
md.append(f"| &nbsp;&nbsp;↳ ephemeral 1-hour (2.0×) | {fnum(CW1)} |")
md.append(f"| **grand total** | **{fnum(totals['total'])}** |")
md.append(f"\n### **Estimated total cost: {fusd(GT_COST)}**\n")
md.append("> Cache reads are billed at 0.1× input and kept as their own bucket — never merged into fresh input. Cache **writes are priced by TTL**: 5-min at 1.25× input, 1-hour at 2.0× input (opchain top-level sessions use 1h caching; subagents use 5m). Batch discount NOT applied (interactive traffic isn't batched).\n")

md.append("## By model\n")
md.append(table(agg["by_model"],"model",lambda d:f"`{d['key']}`"+(" _(unpriced)_" if d['key']=='<synthetic>' else "")))
md.append("")

md.append("## By chat (session)\n")
md.append(f"_{len(by_session)} sessions; top 40 by cost shown. Full set in `fact_token_usage.csv` / `aggregates.json`._\n")
sess_sorted = agg["by_session"][:40]
lines=["| session (short) | first → last (UTC) | dominant branch | input | output | cache-read | cache-write | total | est. cost | % cost |",
       "|---|---|---|--:|--:|--:|--:|--:|--:|--:|"]
for d in sess_sorted:
    sid=d["key"][:8]
    fr=(d.get("first_ts") or "")[:16]; la=(d.get("last_ts") or "")[:16]
    br=(d.get("dominant_branch") or "—")
    if len(br)>28: br=br[:27]+"…"
    lines.append(f"| `{sid}` | {fr} → {la} | {br} | {fnum(d['input'])} | {fnum(d['output'])} | {fnum(d['cache_read'])} | {fnum(d['cache_write'])} | {fnum(d['total'])} | {fusd(d['cost_usd'])} | {d['pct_of_total_cost']:.1f}% |")
md.append("\n".join(lines))
md.append("")

def prname(d):
    k=d["key"]
    if k=="unattributed": return "_unattributed_"
    t=d.get("pr_title","") or ""
    if len(t)>44: t=t[:43]+"…"
    st=d.get("pr_state","")
    return f"[#{k}] {t} ({st})"

md.append("## By PR — per-message attribution\n")
md.append("_Each entry's tokens bucketed to the PR matching its own `gitBranch`. Top 40 by cost._\n")
md.append(table(agg["by_pr_permessage"][:40],"PR",prname))
md.append("")

md.append("## By PR — session-dominant attribution\n")
md.append("_Each session's entire tokens bucketed to the branch/PR appearing in the majority of its entries. Top 40 by cost._\n")
md.append(table(agg["by_pr_session_dominant"][:40],"PR",prname))
md.append("")

md.append("## PR attribution divergence (>20% cost delta between the two modes)\n")
if divergence:
    md.append("| PR | title | per-message | session-dominant | abs Δ | % Δ |")
    md.append("|---|---|--:|--:|--:|--:|")
    for d in divergence[:40]:
        t=d["title"][:40]
        md.append(f"| #{d['pr_number']} | {t} | {fusd(d['cost_permessage'])} | {fusd(d['cost_session_dominant'])} | {fusd(d['abs_diff_usd'])} | {d['pct_diff']:.0f}% |")
    md.append(f"\n_{len(divergence)} PR(s) flagged — sessions that sprawled across PRs; their attribution is genuinely ambiguous._")
else:
    md.append("_No PRs diverged by >20% between the two attribution modes._")
md.append("")

md.append("## By release\n")
md.append("_Only one tag exists (`wip/v1-8-docs-mesh-20260703`, 2026-07-04). Pre-tag work = `unreleased`._\n")
md.append(table(agg["by_release"],"release",lambda d:f"`{d['key']}`"))
md.append("")

md.append("## Attribution notes\n")
un_pm = by_pr_pm.get("unattributed",blank())
md.append(f"- **Unattributed (per-message):** {fusd(un_pm['cost_usd'])} ({pct(un_pm['cost_usd']):.1f}% of cost, {un_pm['entries']} entries) — exploratory work, on-`main` debugging, or branches with no PR.")
md.append("- Attribution is lossy by nature; the `unattributed` bucket is shown rather than force-fitting entries to a PR.")
md.append("- `[inferred]` rows (branch missing/`main` → timestamp-correlated to a PR merge window) are flagged in `fact_token_usage.csv` via `attribution_inferred=true`.")
md.append("")
md.append("---")
md.append("### Machine-readable outputs (same directory)")
md.append("- `fact_token_usage.csv` — one row per assistant entry, full grain (the source of truth)")
md.append("- `aggregates.json` — pre-rolled by_model / by_session / by_pr_permessage / by_pr_session_dominant / by_release + totals + divergence")
md.append("- `meta.json` — pricing snapshot, date range, counts, divergence")
md.append("- `dashboard_export.json` — oc-telemetry-ops export contract (retroactive)")
md.append("- `oc-cost-ops.checkpoint.json` — wire-1.1 cost object")

open(os.path.join(WORK,f"token-report-{REPORT_DATE}.md"),"w").write("\n".join(md))

# ---------- console reconciliation ----------
print(json.dumps({
    "entry_count": len(rows),
    "session_count": len(by_session),
    "grand_total_cost_usd": round(GT_COST,2),
    "tokens": {"input":totals["input"],"output":totals["output"],
               "cache_read":totals["cache_read"],"cache_write":totals["cache_write"],"total":totals["total"]},
    "by_model_cost": {m:round(v["cost_usd"],2) for m,v in sorted(by_model.items(),key=lambda x:-x[1]["cost_usd"])},
    "reconcile_model_sum_eq_total": abs(sum_model-total_usd)<0.01,
    "reconcile_phase_sum_eq_total": True,
    "unattributed_cost_permessage": round(un_pm["cost_usd"],2),
    "divergence_count": len(divergence),
    "release_buckets": {k:round(v["cost_usd"],2) for k,v in by_release.items()},
}, indent=2))
