#!/usr/bin/env python3
"""Step 2 parser: read every path in sessions.manifest, extract assistant usage,
attribute (branch->PR, timestamp->release), price, and write fact_token_usage.csv.
Prints a processing summary only. Rows go to disk, never into model context."""
import json, sys, os, csv, hashlib, datetime as dt

WORK = sys.argv[1]
MANIFEST = os.path.join(WORK, "sessions.manifest")
PRS = os.path.join(WORK, "prs.json")
TAGS = os.path.join(WORK, "tags.txt")
OUT_CSV = os.path.join(WORK, "fact_token_usage.csv")

PRICING_VERSION = "2026-06-28"
GENERATED_AT = os.environ.get("GENERATED_AT")  # UTC ISO, injected (Date.now blocked in some envs; use shell)

# --- pricing (verified against skills/oc-cost-ops + oc-claude-api references, 2026-07-09) ---
# USD per 1e6 tokens: (input, output)
PRICE = {
    "claude-fable-5":   (10.0, 50.0),
    "claude-opus-4-8":  (5.0, 25.0),
    "claude-sonnet-4-6":(3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
}
CACHE_READ_MULT = 0.1        # x input price
CACHE_WRITE_5M_MULT = 1.25   # x input price (ephemeral 5-min TTL)
CACHE_WRITE_1H_MULT = 2.0    # x input price (ephemeral 1-hour TTL)
# opchain Claude Code sessions write a mix of 1h (top-level) and 5m (subagent) cache.
# Price each TTL separately from usage.cache_creation.{ephemeral_5m,ephemeral_1h}_input_tokens.

def norm_model(m):
    """Pin to base model id (strip trailing -YYYYMMDD date suffix)."""
    if not m:
        return m
    parts = m.rsplit("-", 1)
    if len(parts) == 2 and parts[1].isdigit() and len(parts[1]) == 8:
        return parts[0]
    return m

def to_utc(ts):
    if not ts:
        return None
    try:
        s = ts.replace("Z", "+00:00")
        d = dt.datetime.fromisoformat(s)
        if d.tzinfo is None:
            d = d.replace(tzinfo=dt.timezone.utc)
        return d.astimezone(dt.timezone.utc)
    except Exception:
        return None

# --- load PRs ---
prs = json.load(open(PRS))
def parse_dt(x):
    return to_utc(x) if x else None
# branch -> list of PRs (with parsed windows)
branch_prs = {}
for p in prs:
    b = p.get("headRefName")
    rec = {
        "number": p.get("number"),
        "title": p.get("title") or "",
        "state": p.get("state") or "",
        "created": parse_dt(p.get("createdAt")),
        "merged": parse_dt(p.get("mergedAt")),
        "closed": parse_dt(p.get("closedAt")),
    }
    branch_prs.setdefault(b, []).append(rec)

def pr_window_end(rec):
    return rec["merged"] or rec["closed"]  # None => still open

def pick_pr_for_branch(branch, ts):
    """Resolve a feature branch to a PR; when >1, pick the one whose window contains ts,
    else the most recently created."""
    recs = branch_prs.get(branch)
    if not recs:
        return None
    if len(recs) == 1:
        return recs[0]
    # prefer window-containing
    cands = []
    for r in recs:
        start = r["created"]
        end = pr_window_end(r)
        if ts and start and start <= ts and (end is None or ts <= end):
            cands.append(r)
    if cands:
        cands.sort(key=lambda r: r["created"] or dt.datetime.min.replace(tzinfo=dt.timezone.utc), reverse=True)
        return cands[0]
    recs2 = sorted(recs, key=lambda r: r["created"] or dt.datetime.min.replace(tzinfo=dt.timezone.utc), reverse=True)
    return recs2[0]

def infer_pr_by_time(ts):
    """For main/master/missing branch: find PR whose [created, end] window contains ts.
    Returns (rec, ok). If multiple, pick most-recently-created-before ts."""
    if not ts:
        return None
    cands = []
    for b, recs in branch_prs.items():
        for r in recs:
            start = r["created"]
            end = pr_window_end(r)
            if start and start <= ts and (end is None or ts <= end):
                cands.append(r)
    if not cands:
        return None
    cands.sort(key=lambda r: r["created"], reverse=True)
    return cands[0]

# --- load tags (releases) ---
tags = []
if os.path.exists(TAGS):
    for line in open(TAGS):
        line = line.strip()
        if not line or "|" not in line:
            continue
        name, iso = line.split("|", 1)
        d = to_utc(iso)
        if d:
            tags.append((name, d))
tags.sort(key=lambda t: t[1])

def release_for(ts):
    if not ts:
        return "unattributed"
    if not tags:
        return "unreleased"
    if ts < tags[0][1]:
        return "unreleased"
    label = tags[0][0]
    for name, d in tags:
        if ts >= d:
            label = name
        else:
            break
    return label

def cost_for(model, i, o, cr, cw5, cw1):
    price = PRICE.get(model)
    if not price:
        return None  # unpriced
    ip, op = price
    return ((i/1e6)*ip + (o/1e6)*op + (cr/1e6)*ip*CACHE_READ_MULT
            + (cw5/1e6)*ip*CACHE_WRITE_5M_MULT + (cw1/1e6)*ip*CACHE_WRITE_1H_MULT)

paths = [l.strip() for l in open(MANIFEST) if l.strip()]
files_in_manifest = len(paths)
files_processed = 0
files_failed = 0
failed_files = []
raw_assistant_lines = 0

cols = ["entry_id","session_id","message_id","timestamp_utc","date","iso_week","model","model_raw",
        "branch","pr_number","pr_title","pr_state","release_tag","attribution_inferred",
        "input_tokens","output_tokens","cache_read_tokens","cache_write_tokens",
        "cache_write_5m_tokens","cache_write_1h_tokens","total_tokens",
        "cost_usd","unpriced","source_lines","generated_at","pricing_version"]

# ---- PASS 1: read all assistant lines, dedup by (sessionId, message.id) ----
# A single assistant message (one API call / requestId) is logged across multiple JSONL
# lines, one per content block (thinking/tool_use/text). usage.input & cache are constant
# across those lines; output_tokens grows to its final value on the last block. Summing
# lines double-counts. Correct billing grain = one row per message.id, taking the usage
# from the line with MAX output_tokens (the complete, final usage record).
# (Documented correction: prior per-line reports inflated the totals. See memory: token-report-dedup.)
groups = {}   # (sid, mid) -> best record dict
for p in paths:
    try:
        with open(p, encoding="utf-8") as fh:
            for line in fh:
                if '"assistant"' not in line:
                    continue
                try:
                    o = json.loads(line)
                except Exception:
                    continue
                if o.get("type") != "assistant":
                    continue
                raw_assistant_lines += 1
                msg = o.get("message") or {}
                usage = msg.get("usage") or {}
                model_raw = msg.get("model")
                model = norm_model(model_raw)
                i = int(usage.get("input_tokens") or 0)
                out = int(usage.get("output_tokens") or 0)
                cr = int(usage.get("cache_read_input_tokens") or 0)
                cw = int(usage.get("cache_creation_input_tokens") or 0)
                cc = usage.get("cache_creation") or {}
                cw5 = int(cc.get("ephemeral_5m_input_tokens") or 0)
                cw1 = int(cc.get("ephemeral_1h_input_tokens") or 0)
                # if breakdown missing but flat present, treat flat as 5m (task's default assumption)
                if cw and (cw5 + cw1) == 0:
                    cw5 = cw
                if model is None and (i+out+cr+cw) == 0:
                    continue
                sid = o.get("sessionId") or os.path.splitext(os.path.basename(p))[0]
                mid = msg.get("id") or f"__noid__:{p}:{raw_assistant_lines}"  # fallback: treat as unique
                key = (sid, mid)
                tsd = to_utc(o.get("timestamp"))
                branch = o.get("gitBranch")
                prev = groups.get(key)
                if prev is None:
                    groups[key] = {
                        "sid": sid, "mid": mid, "tsd": tsd, "branch": branch,
                        "model": model, "model_raw": model_raw,
                        "i": i, "out": out, "cr": cr, "cw5": cw5, "cw1": cw1, "lines": 1,
                    }
                else:
                    prev["lines"] += 1
                    # keep the representative (complete) usage: line with max output_tokens.
                    # input/cache are constant across a group; take max defensively.
                    if out > prev["out"]:
                        prev["out"] = out
                    prev["i"] = max(prev["i"], i)
                    prev["cr"] = max(prev["cr"], cr)
                    prev["cw5"] = max(prev["cw5"], cw5)
                    prev["cw1"] = max(prev["cw1"], cw1)
                    # earliest timestamp / stable attribution from first-seen
                    if tsd and (prev["tsd"] is None or tsd < prev["tsd"]):
                        prev["tsd"] = tsd
        files_processed += 1
    except FileNotFoundError:
        files_failed += 1
        failed_files.append(p)
    except Exception as e:
        files_failed += 1
        failed_files.append(f"{p} :: {e}")

# ---- PASS 2: attribute + price + write one row per message.id ----
entries_written = 0
with open(OUT_CSV, "w", newline="") as fcsv:
    w = csv.writer(fcsv)
    w.writerow(cols)
    for (sid, mid), g in groups.items():
        tsd = g["tsd"]; branch = g["branch"]
        model = g["model"]; model_raw = g["model_raw"]
        i, out, cr = g["i"], g["out"], g["cr"]
        cw5, cw1 = g["cw5"], g["cw1"]
        cw = cw5 + cw1
        inferred = False
        rec = None
        if branch and branch not in ("main", "master"):
            rec = pick_pr_for_branch(branch, tsd)
            if rec is None:
                rec = infer_pr_by_time(tsd)
                if rec is not None:
                    inferred = True
        else:
            rec = infer_pr_by_time(tsd)
            if rec is not None:
                inferred = True
        pr_number = rec["number"] if rec else ""
        pr_title = rec["title"] if rec else ""
        pr_state = rec["state"] if rec else ""
        rel = release_for(tsd)
        c = cost_for(model, i, out, cr, cw5, cw1)
        unpriced = c is None
        cost = 0.0 if c is None else c
        total = i + out + cr + cw
        eid = hashlib.sha1(f"{sid}:{mid}".encode()).hexdigest()[:16]
        date = tsd.strftime("%Y-%m-%d") if tsd else ""
        if tsd:
            iy, iw, _ = tsd.isocalendar()
            isow = f"{iy}-W{iw:02d}"
        else:
            isow = ""
        ts_out = tsd.strftime("%Y-%m-%dT%H:%M:%SZ") if tsd else ""
        w.writerow([eid, sid, mid, ts_out, date, isow, model or "", model_raw or "",
                    branch or "", pr_number, pr_title, pr_state, rel, inferred,
                    i, out, cr, cw, cw5, cw1, total, f"{cost:.6f}", unpriced, g["lines"],
                    GENERATED_AT or "", PRICING_VERSION])
        entries_written += 1

summary = {
    "files_in_manifest": files_in_manifest,
    "files_processed": files_processed,
    "files_failed": files_failed,
    "raw_assistant_lines": raw_assistant_lines,
    "deduped_messages_written": entries_written,
    "dedup_ratio": round(raw_assistant_lines/entries_written, 3) if entries_written else None,
    "failed_files": failed_files[:20],
}
json.dump(summary, open(os.path.join(WORK, "parse_summary.json"), "w"), indent=2)
print(json.dumps(summary, indent=2))
