#!/usr/bin/env python3
"""Price, attribute, merge append-safe, and emit the report + data layer."""
import os, json, csv, hashlib, collections, subprocess, datetime as dt

SP = os.path.dirname(os.path.abspath(__file__))
REPO = "/Users/aidanelsesser/repos/opchain"
RUN_DATE = "2026-07-19"
GENERATED_AT = "2026-07-19T14:09:49Z"  # UTC run stamp
PRICING_VERIFIED_ON = "2026-07-19"
PRICING_VERSION = "2026-07-19"
SCHEMA_VERSION = "1.2"

PRICES = {  # $/MTok (input, output)
    "claude-fable-5": (10.0, 50.0),
    "claude-opus-4-8": (5.0, 25.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
}
CACHE_READ_MULT = 0.1
CACHE_WRITE_5M_MULT = 1.25
CACHE_WRITE_1H_MULT = 2.0

NON_PR_BRANCHES = {"", "main", "master", "HEAD"}


def cost_of(model, inp, out, cr, w5, w1h):
    p = PRICES.get(model)
    if p is None:
        return None  # [unpriced]
    ip, op = p
    return (inp / 1e6) * ip + (out / 1e6) * op + (cr / 1e6) * ip * CACHE_READ_MULT \
        + (w5 / 1e6) * ip * CACHE_WRITE_5M_MULT + (w1h / 1e6) * ip * CACHE_WRITE_1H_MULT


# ---------- PR metadata ----------
prs = json.load(open(os.path.join(SP, "prs.json")))
branch_pr = {}          # per-message mode: head branch -> PR
branch_pr_dominant = {}  # session-dominant mode: excludes main/master/HEAD heads
for p in prs:
    h = p.get("headRefName") or ""
    branch_pr.setdefault(h, p)
    if h not in NON_PR_BRANCHES:
        branch_pr_dominant.setdefault(h, p)

merged = [p for p in prs if p.get("mergedAt")]
merged_windows = []
for p in merged:
    merged_windows.append((p["createdAt"], p["mergedAt"], p))
merged_windows.sort()


def infer_pr(ts):
    """Timestamp correlation, restricted to MERGED PRs' [created, merged] windows."""
    hits = [p for (c, m, p) in merged_windows if c <= ts <= m]
    if not hits:
        return None
    return min(hits, key=lambda p: (p["mergedAt"], p["number"]))


# ---------- releases ----------
tags = subprocess.run(
    ["git", "-C", REPO, "tag", "--sort=creatordate",
     "--format=%(refname:short)\t%(creatordate:iso-strict)"],
    capture_output=True, text=True).stdout.strip().split("\n")
rel = []
for line in tags:
    if not line.strip():
        continue
    name, date = line.split("\t")
    d = dt.datetime.fromisoformat(date).astimezone(dt.timezone.utc)
    rel.append((name, d.strftime("%Y-%m-%dT%H:%M:%SZ")))
rel.sort(key=lambda x: x[1])


def release_of(ts):
    prev = "unreleased"
    for name, tagts in rel:
        if ts <= tagts:
            return name
        prev = name
    return f"post-{prev}"


def isoweek(datestr):
    y, m, d = map(int, datestr.split("-"))
    iso = dt.date(y, m, d).isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


# ---------- build fresh rows ----------
raw = list(csv.DictReader(open(os.path.join(SP, "raw_usage.csv"))))
fresh = {}
excluded_synth = 0
for r in raw:
    inp = int(r["input_tokens"]); out = int(r["output_tokens"])
    cr = int(r["cache_read_tokens"])
    w5 = int(r["cache_write_5m_tokens"]); w1h = int(r["cache_write_1h_tokens"])
    if inp + out + cr + w5 + w1h == 0:
        excluded_synth += 1
        continue
    sid = r["session_id"]; mid = r["message_id"]
    eid = hashlib.sha1(f"{sid}:{mid}".encode()).hexdigest()[:16]
    ts = r["timestamp_utc"]
    date = ts[:10]
    branch = r["branch"]
    inferred = False
    if branch in NON_PR_BRANCHES:
        p = infer_pr(ts)
        inferred = p is not None
    else:
        p = branch_pr.get(branch)
        if p is None:
            p = infer_pr(ts)
            inferred = p is not None
    c = cost_of(r["model"], inp, out, cr, w5, w1h)
    fresh[eid] = {
        "entry_id": eid, "session_id": sid, "message_id": mid,
        "timestamp_utc": ts, "date": date, "iso_week": isoweek(date),
        "model": r["model"], "branch": branch,
        "pr_number": p["number"] if p else "",
        "pr_title": p["title"] if p else "",
        "pr_state": p["state"] if p else "",
        "release_tag": release_of(ts),
        "attribution_inferred": str(inferred).lower(),
        "input_tokens": inp, "output_tokens": out,
        "cache_read_tokens": cr, "cache_write_tokens": w5 + w1h,
        "total_tokens": inp + out + cr + w5 + w1h,
        "cost_usd": round(c, 6) if c is not None else "",
        "generated_at": GENERATED_AT, "pricing_version": PRICING_VERSION,
        "cache_write_5m_tokens": w5, "cache_write_1h_tokens": w1h,
        "is_sidechain": r["is_sidechain"],
    }

# ---------- append-safe merge vs latest prior ledger ----------
# Source: the 2026-07-19 earlier-run ledger staged (uncommitted) in worktree
# youthful-cerf-aafbf8 — strictly newer than the latest *committed* report
# (ab22742, 2026-07-17, $1,064.60), and itself already merged from it.
prior = {}
with open(os.path.join(SP, "prior_fact.csv")) as fh:
    for r in csv.DictReader(fh):
        prior[r["entry_id"]] = r

preserved = {k: v for k, v in prior.items() if k not in fresh}
overlap = len(set(prior) & set(fresh))
merged_rows = {**preserved, **fresh}

FIELDS = ["entry_id", "session_id", "message_id", "timestamp_utc", "date", "iso_week",
          "model", "branch", "pr_number", "pr_title", "pr_state", "release_tag",
          "attribution_inferred", "input_tokens", "output_tokens", "cache_read_tokens",
          "cache_write_tokens", "total_tokens", "cost_usd", "generated_at",
          "pricing_version", "cache_write_5m_tokens", "cache_write_1h_tokens",
          "is_sidechain"]

allrows = sorted(merged_rows.values(), key=lambda r: (r["timestamp_utc"], r["entry_id"]))
with open(os.path.join(SP, "fact_token_usage.csv"), "w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=FIELDS)
    w.writeheader()
    for r in allrows:
        w.writerow({k: r.get(k, "") for k in FIELDS})

print(json.dumps({
    "fresh_rows": len(fresh), "prior_rows": len(prior), "overlap": overlap,
    "preserved_prior_only": len(preserved), "merged_total": len(allrows),
    "excluded_synthetic": excluded_synth,
}, indent=2))

# ---------- aggregation helpers ----------
BUCKETS = ["input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens"]


def blank():
    d = {b: 0 for b in BUCKETS}
    d.update({"total_tokens": 0, "cost_usd": 0.0, "entries": 0, "unpriced": 0})
    return d


def add(acc, r):
    for b in BUCKETS:
        acc[b] += int(r[b] or 0)
    acc["total_tokens"] += int(r["total_tokens"] or 0)
    if r["cost_usd"] in ("", None):
        acc["unpriced"] += 1
    else:
        acc["cost_usd"] += float(r["cost_usd"])
    acc["entries"] += 1


def finish(groups, total_cost):
    out = []
    for k, v in groups.items():
        v = dict(v)
        v["key"] = k
        v["cost_usd"] = round(v["cost_usd"], 4)
        v["pct_of_total_cost"] = round(100 * v["cost_usd"] / total_cost, 2) if total_cost else 0
        out.append(v)
    return sorted(out, key=lambda x: -x["cost_usd"])


TOTAL = blank()
for r in allrows:
    add(TOTAL, r)
total_cost = TOTAL["cost_usd"]

by_model = collections.defaultdict(blank)
by_session = collections.defaultdict(blank)
by_release = collections.defaultdict(blank)
by_pr_pm = collections.defaultdict(blank)
sess_meta = collections.defaultdict(lambda: {"first": None, "last": None,
                                             "branches": collections.Counter()})
for r in allrows:
    add(by_model[r["model"]], r)
    add(by_session[r["session_id"]], r)
    add(by_release[r["release_tag"]], r)
    pr = f"#{r['pr_number']}" if r["pr_number"] else "unattributed"
    add(by_pr_pm[pr], r)
    m = sess_meta[r["session_id"]]
    ts = r["timestamp_utc"]
    if m["first"] is None or ts < m["first"]:
        m["first"] = ts
    if m["last"] is None or ts > m["last"]:
        m["last"] = ts
    if r["branch"]:
        m["branches"][r["branch"]] += 1

# session-dominant PR attribution
by_pr_sd = collections.defaultdict(blank)
for r in allrows:
    dom = sess_meta[r["session_id"]]["branches"]
    dominant = dom.most_common(1)[0][0] if dom else ""
    p = branch_pr_dominant.get(dominant)  # excludes main/master/HEAD heads
    key = f"#{p['number']}" if p else "unattributed"
    add(by_pr_sd[key], r)

pr_titles = {}
for r in allrows:
    if r["pr_number"]:
        pr_titles[f"#{r['pr_number']}"] = (r["pr_title"], r["pr_state"])

agg = {
    "totals": {**{b: TOTAL[b] for b in BUCKETS},
               "total_tokens": TOTAL["total_tokens"],
               "cost_usd": round(total_cost, 4),
               "entries": TOTAL["entries"], "unpriced_entries": TOTAL["unpriced"]},
    "by_model": finish(by_model, total_cost),
    "by_session": finish(by_session, total_cost),
    "by_pr_permessage": finish(by_pr_pm, total_cost),
    "by_pr_session_dominant": finish(by_pr_sd, total_cost),
    "by_release": finish(by_release, total_cost),
}
for row in agg["by_session"]:
    m = sess_meta[row["key"]]
    row["first_ts"] = m["first"]; row["last_ts"] = m["last"]
    row["dominant_branch"] = m["branches"].most_common(1)[0][0] if m["branches"] else ""

# divergence: PRs where the two modes differ >20% of est cost
pm = {r["key"]: r["cost_usd"] for r in agg["by_pr_permessage"]}
sd = {r["key"]: r["cost_usd"] for r in agg["by_pr_session_dominant"]}
divergence = []
for k in set(pm) | set(sd):
    a, b = pm.get(k, 0.0), sd.get(k, 0.0)
    base = max(a, b)
    if base > 0 and abs(a - b) / base > 0.20:
        divergence.append({"pr": k, "per_message_usd": round(a, 2),
                           "session_dominant_usd": round(b, 2),
                           "delta_pct": round(100 * (b - a) / base, 1)})
divergence.sort(key=lambda d: -max(d["per_message_usd"], d["session_dominant_usd"]))
agg["divergence"] = divergence

json.dump(agg, open(os.path.join(SP, "aggregates.json"), "w"), indent=2)

dates = sorted(r["date"] for r in allrows)
meta = {
    "generated_at": GENERATED_AT, "schema_version": SCHEMA_VERSION,
    "date_range": {"start": dates[0], "end": dates[-1]},
    "session_count": len(by_session), "entry_count": len(allrows),
    "pricing": {"verified_on": PRICING_VERIFIED_ON, "version": PRICING_VERSION,
                "source": "skills/oc-claude-api/references/{model-routing,prompt-caching}.md",
                "usd_per_mtok": {k: {"input": v[0], "output": v[1]} for k, v in PRICES.items()},
                "cache_read_multiplier": CACHE_READ_MULT,
                "cache_write_5m_multiplier": CACHE_WRITE_5M_MULT,
                "cache_write_1h_multiplier": CACHE_WRITE_1H_MULT,
                "batch_discount_applied": False,
                "note": "service_tier=standard on every fresh entry; no Batch discount."},
    "merge": {"prior_ledger_commit": "ab22742", "prior_rows": len(prior),
              "fresh_rows": len(fresh), "overlapping_entry_ids": overlap,
              "preserved_prior_only": len(preserved),
              "excluded_zero_token_synthetic": excluded_synth},
    "divergence": divergence,
}
json.dump(meta, open(os.path.join(SP, "meta.json"), "w"), indent=2)
print("total_cost", round(total_cost, 2), "rows", len(allrows), "sessions", len(by_session))
