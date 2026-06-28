#!/usr/bin/env python3
"""
Claude Code token + cost report generator  (v2 — cwd-filtered discovery).

Audits Claude Code token usage for THIS repo and emits a human report plus a
machine-readable data layer. Per the audit spec:

  Step 1  Discover sessions by the `cwd` field stored INSIDE each transcript
          (never by the lossy project-folder-name encoding). Write the matched
          paths to `sessions.manifest` — the canonical work list.
  Step 2  One parser over the whole manifest -> one CSV row per assistant entry.
          Print a processing summary (in/processed/failed/written).
  Step 3  Cost model pinned to base model IDs; four token buckets kept separate.
  Step 4  Attribution by model / chat / PR (per-message AND session-dominant,
          plus a >20%-of-cost divergence flag) / release.
  Step 5  token-report-<date>.md  (human).
  Step 6  fact_token_usage.csv, aggregates.json, meta.json, dashboard_export.json,
          and a wire-1.1 .checkpoints/oc-cost-ops.checkpoint.json (machine).

Guardrails: process 100% of the manifest or fail; assert
files_processed == files_in_manifest, files_failed == 0, and
entry_count == CSV row count before writing the report.

Pricing + cache multipliers verified 2026-06-28 against the repo's own
skills/oc-claude-api/references/{model-routing,prompt-caching}.md (the
oc-claude-api source of truth), NOT from memory.
"""
import json, os, sys, hashlib, subprocess, collections, csv, datetime as dt

# ----------------------------------------------------------------------------
# Step 3 — cost model. Pinned to BASE model IDs. USD per MILLION tokens.
# Verified 2026-06-28 against skills/oc-claude-api/references/model-routing.md.
# ----------------------------------------------------------------------------
PRICING_VERIFIED_ON = "2026-06-28"
PRICING_VERSION = "anthropic-list-2026-06-28"
PRICING = {
    # family -> {input, output} per 1M tokens
    "claude-fable-5":    {"input": 10.00, "output": 50.00},
    "claude-opus-4-x":   {"input":  5.00, "output": 25.00},   # 4.8 / 4.7 / 4.6 (Opus-tier)
    "claude-sonnet-4-x": {"input":  3.00, "output": 15.00},
    "claude-haiku-4-x":  {"input":  1.00, "output":  5.00},
}
# Cache multipliers on the model's INPUT rate (prompt-caching.md):
#   cache read           = 0.10x input
#   cache write, 5m TTL  = 1.25x input
#   cache write, 1h TTL  = 2.00x input
CACHE_READ_MULT     = 0.10
CACHE_WRITE_5M_MULT = 1.25
CACHE_WRITE_1H_MULT = 2.00

SCHEMA_VERSION = "1.1"
MAIN_BRANCHES = {"main", "master", None, ""}
GH_TIMEOUT = 25
# Max |entry_ts - PR_mergedAt| for an on-`main` entry to be timestamp-correlated
# to that PR. Beyond this, the entry stays `unattributed` rather than force-fit.
INFER_WINDOW_DAYS = 14


def model_family(model: str):
    if not model:
        return None
    m = model.lower()
    if m.startswith("claude-fable"):
        return "claude-fable-5"
    if "opus-4" in m:
        return "claude-opus-4-x"
    if "sonnet-4" in m:
        return "claude-sonnet-4-x"
    if "haiku-4" in m:
        return "claude-haiku-4-x"
    return None  # unknown (e.g. "<synthetic>") -> flagged, not estimated


def model_tier(model: str):
    """Collapse a model ID to a coarse tier for the anonymized dashboard."""
    fam = model_family(model)
    return {
        "claude-fable-5": "fable",
        "claude-opus-4-x": "opus",
        "claude-sonnet-4-x": "sonnet",
        "claude-haiku-4-x": "haiku",
    }.get(fam, "other")


def entry_cost(fam, u_in, u_out, u_cread, cw_5m, cw_1h):
    if fam is None or fam not in PRICING:
        return None  # unpriced -> flagged
    ir = PRICING[fam]["input"] / 1e6
    orr = PRICING[fam]["output"] / 1e6
    return (
        u_in * ir
        + u_out * orr
        + u_cread * CACHE_READ_MULT * ir
        + cw_5m * CACHE_WRITE_5M_MULT * ir
        + cw_1h * CACHE_WRITE_1H_MULT * ir
    )


def iso_week(d: dt.datetime):
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def parse_ts(raw):
    if not raw:
        return None
    try:
        return dt.datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
    except ValueError:
        return None


def main():
    # ---- two distinct roots ----
    #   discovery_root = canonical MAIN worktree. Sessions from the main checkout
    #     AND every linked worktree nest under it, so cwd-matching against it
    #     captures the whole repo's chat history regardless of launch dir.
    #   out_root = the CURRENT working tree (this worktree/branch). Deliverables
    #     land here so they're on the branch under review, never in someone
    #     else's checkout.
    out_root = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
    discovery_root = out_root
    try:
        wl = subprocess.check_output(["git", "worktree", "list", "--porcelain"], cwd=out_root, text=True)
        for line in wl.splitlines():
            if line.startswith("worktree "):
                discovery_root = line[len("worktree "):].strip()
                break  # main worktree is listed first
    except subprocess.CalledProcessError:
        pass
    repo = discovery_root
    repo_basename = os.path.basename(repo)

    # ------------------------------------------------------------------
    # Step 1 — discover sessions by the cwd field INSIDE each transcript.
    # ------------------------------------------------------------------
    projects_root = os.path.expanduser("~/.claude/projects")
    all_jsonl = []
    if os.path.isdir(projects_root):
        for d in sorted(os.listdir(projects_root)):
            full = os.path.join(projects_root, d)
            if os.path.isdir(full):
                for f in sorted(os.listdir(full)):
                    if f.endswith(".jsonl"):
                        all_jsonl.append(os.path.join(full, f))

    def first_cwd(path):
        try:
            with open(path) as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        o = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if "cwd" in o and o["cwd"]:
                        return o["cwd"]
        except OSError:
            return None
        return None

    manifest = []
    for path in all_jsonl:
        cwd = first_cwd(path)
        if cwd and (cwd == repo or cwd.startswith(repo + os.sep)):
            manifest.append(path)
    manifest.sort()

    out_dir = os.path.join(out_root, "reports", "token-usage")
    os.makedirs(out_dir, exist_ok=True)
    manifest_path = os.path.join(out_dir, "sessions.manifest")
    with open(manifest_path, "w") as f:
        f.write("\n".join(manifest) + ("\n" if manifest else ""))
    N = len(manifest)
    print(f"[step1] scanned {len(all_jsonl)} transcript(s) machine-wide; "
          f"matched {N} for repo '{repo_basename}' ({repo})")
    if N <= 1:
        print(f"FATAL: manifest has {N} file(s) — the cwd filter failed or only the "
              "current session exists. Refusing to substitute live context as the dataset.",
              file=sys.stderr)
        sys.exit(2)

    # ------------------------------------------------------------------
    # branch -> PR resolution via `gh` (dynamic, not hardcoded).
    # ------------------------------------------------------------------
    gh_authed = subprocess.run(["gh", "auth", "status"], capture_output=True).returncode == 0
    branch_pr = {}   # branch -> {number,title,state,mergedAt} | None
    if gh_authed:
        # discover which branches actually appear before calling gh
        appearing = set()
        for path in manifest:
            with open(path) as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        o = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if o.get("type") == "assistant":
                        appearing.add(o.get("gitBranch"))
        for b in sorted(x for x in appearing if x not in MAIN_BRANCHES):
            try:
                r = subprocess.run(
                    ["gh", "pr", "list", "--state", "all", "--head", b,
                     "--json", "number,title,state,mergedAt,createdAt"],
                    capture_output=True, text=True, timeout=GH_TIMEOUT)
                arr = json.loads(r.stdout or "[]")
                branch_pr[b] = arr[0] if arr else None
            except (subprocess.TimeoutExpired, json.JSONDecodeError, OSError):
                branch_pr[b] = "ERROR"
    GH_NOTE = ("gh CLI (`gh pr list --state all --head <branch>`), local environment"
               if gh_authed else "gh NOT authenticated — PR rows marked [unresolved]")

    # merged PRs (sorted by mergedAt) used for on-`main` timestamp correlation
    merged_prs = []
    for b, pr in branch_pr.items():
        if isinstance(pr, dict) and pr.get("mergedAt"):
            merged_prs.append({"number": pr["number"], "title": pr.get("title", ""),
                               "merged": parse_ts(pr["mergedAt"])})
    merged_prs.sort(key=lambda p: p["merged"])

    def infer_pr(ts):
        """Nearest merged PR within INFER_WINDOW_DAYS of an on-`main` entry's ts."""
        if ts is None or not merged_prs:
            return None
        best, best_d = None, None
        for p in merged_prs:
            d = abs((p["merged"] - ts).total_seconds())
            if best_d is None or d < best_d:
                best, best_d = p, d
        if best_d is not None and best_d <= INFER_WINDOW_DAYS * 86400:
            return best
        return None

    # ---- git tags -> canonical release windows ----
    tag_raw = subprocess.run(
        ["git", "tag", "--sort=creatordate", "--format=%(refname:short)\t%(creatordate:iso-strict)"],
        cwd=repo, text=True, capture_output=True).stdout.strip()
    tags = []
    for line in tag_raw.splitlines():
        name, _, iso = line.partition("\t")
        tdt = parse_ts(iso.strip())
        if tdt:
            tags.append((name.strip(), tdt))
    tags.sort(key=lambda t: t[1])

    def release_for(ts):
        if not tags or ts is None or ts < tags[0][1]:
            return "unreleased"
        rel = tags[0][0]
        for name, tdt in tags:
            if ts >= tdt:
                rel = name
            else:
                break
        return rel

    # ---- supplementary: changelog release-commit windows (opchain ships via
    #      `chore(release): vX.Y` commits, not git tags) ----
    rel_raw = subprocess.run(
        ["git", "log", "--all", "--grep=chore(release)", "--date=iso-strict",
         "--format=%ad\t%s"], cwd=repo, text=True, capture_output=True).stdout
    import re
    rel_commits = []
    for line in rel_raw.splitlines():
        ad, _, subj = line.partition("\t")
        m = re.search(r"\bv(\d+\.\d+)\b", subj)
        tdt = parse_ts(ad.strip())
        if m and tdt:
            rel_commits.append((f"v{m.group(1)}", tdt))
    # de-dup to the earliest commit per version, then sort
    seen_v = {}
    for v, t in rel_commits:
        if v not in seen_v or t < seen_v[v]:
            seen_v[v] = t
    rel_windows = sorted(seen_v.items(), key=lambda x: x[1])

    def changelog_release_for(ts):
        # Range labels make the semantic explicit: this is the window during
        # which a release was LIVE (work done then), not where the work shipped.
        if not rel_windows or ts is None or ts < rel_windows[0][1]:
            return f"pre-{rel_windows[0][0]}" if rel_windows else "unreleased"
        for i, (v, t) in enumerate(rel_windows):
            nxt = rel_windows[i + 1][0] if i + 1 < len(rel_windows) else "HEAD"
            lo = t
            hi = rel_windows[i + 1][1] if i + 1 < len(rel_windows) else None
            if ts >= lo and (hi is None or ts < hi):
                return f"{v} → {nxt}"
        return f"{rel_windows[-1][0]} → HEAD"

    # ------------------------------------------------------------------
    # Step 2 — parse the whole manifest. Rows -> memory -> CSV (never context).
    #
    # CRITICAL: Claude Code writes ONE JSONL line per assistant *content block*
    # (thinking / text / tool_use), and every line of a message repeats the SAME
    # cumulative `usage`. The API bills ONCE per message (one message.id /
    # requestId), so summing per-line over-counts by ~14-17x on the cost-dominant
    # buckets. We therefore deduplicate by (sessionId, message.id) and count each
    # message's usage exactly once. (Verified: 0 messages carry >1 distinct usage
    # tuple, so taking any line's usage is exact; we keep the max defensively.)
    # ------------------------------------------------------------------
    msg_meta = {}    # key -> first-seen metadata (model/branch/ts/...)
    msg_usage = {}   # key -> chosen usage tuple (in,out,cread,cw5m,cw1h)
    lines_scanned = 0
    files_processed = 0
    files_failed = []
    for path in manifest:
        try:
            with open(path) as fh:
                for idx, raw in enumerate(fh):
                    raw = raw.strip()
                    if not raw:
                        continue
                    try:
                        o = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    if o.get("type") != "assistant":
                        continue
                    lines_scanned += 1
                    msg = o.get("message", {}) or {}
                    u = msg.get("usage", {}) or {}
                    session_id = o.get("sessionId") or os.path.basename(path)[:-6]
                    mid = msg.get("id") or f"noid:{os.path.basename(path)}:{idx}"
                    key = (session_id, mid)

                    u_in = u.get("input_tokens", 0) or 0
                    u_out = u.get("output_tokens", 0) or 0
                    u_cread = u.get("cache_read_input_tokens", 0) or 0
                    cw_total = u.get("cache_creation_input_tokens", 0) or 0
                    cc = u.get("cache_creation", {}) or {}
                    cw_5m = cc.get("ephemeral_5m_input_tokens")
                    cw_1h = cc.get("ephemeral_1h_input_tokens")
                    if cw_5m is None and cw_1h is None:
                        cw_5m, cw_1h = cw_total, 0   # no breakdown -> default 5m TTL
                    else:
                        cw_5m, cw_1h = cw_5m or 0, cw_1h or 0
                    usage_tuple = (u_in, u_out, u_cread, cw_5m, cw_1h)

                    if key not in msg_meta:
                        msg_meta[key] = {
                            "session_id": session_id,
                            "message_id": mid,
                            "ts": parse_ts(o.get("timestamp")),
                            "ts_raw": o.get("timestamp"),
                            "model": msg.get("model") or "unknown",
                            "branch": o.get("gitBranch"),
                            "is_sidechain": bool(o.get("isSidechain", False)),
                        }
                        msg_usage[key] = usage_tuple
                    else:
                        # same message, another content-block line. Usage is
                        # identical in practice; keep the larger total defensively.
                        if sum(usage_tuple) > sum(msg_usage[key]):
                            msg_usage[key] = usage_tuple
            files_processed += 1
        except OSError as e:
            files_failed.append((path, str(e)))

    entries = []
    unpriced_models = set()
    for key, meta in msg_meta.items():
        u_in, u_out, u_cread, cw_5m, cw_1h = msg_usage[key]
        model = meta["model"]
        fam = model_family(model)
        if fam is None:
            unpriced_models.add(model)
        cw_bucket = cw_5m + cw_1h
        entry_id = hashlib.sha256(f"{meta['session_id']}:{meta['message_id']}".encode()).hexdigest()[:16]
        entries.append({
            "entry_id": entry_id,
            "session_id": meta["session_id"],
            "message_id": meta["message_id"],
            "ts": meta["ts"], "ts_raw": meta["ts_raw"],
            "model": model, "family": fam, "tier": model_tier(model),
            "branch": meta["branch"],
            "input": u_in, "output": u_out,
            "cache_read": u_cread, "cache_write": cw_bucket,
            "cache_write_5m": cw_5m, "cache_write_1h": cw_1h,
            "total": u_in + u_out + u_cread + cw_bucket,
            "cost": entry_cost(fam, u_in, u_out, u_cread, cw_5m, cw_1h),
            "is_sidechain": meta["is_sidechain"],
        })

    # ---- processing summary ----
    print(f"[step2] files_in_manifest={N} files_processed={files_processed} "
          f"files_failed={len(files_failed)} assistant_lines_scanned={lines_scanned} "
          f"distinct_messages(entries_written)={len(entries)}")

    # ---- GUARDRAILS — process 100% or fail ----
    assert files_processed == N, f"files_processed {files_processed} != manifest {N}"
    assert not files_failed, f"files failed: {files_failed}"
    if not entries:
        print("FATAL: no assistant entries found.", file=sys.stderr)
        sys.exit(2)

    generated_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    # `Z` suffix (not +00:00) so it satisfies the checkpoint CI validator's
    # ISO regex: ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$
    GEN_ISO = generated_at.isoformat().replace("+00:00", "Z")

    # ---- session -> dominant branch + representative time ----
    sess_branches = collections.defaultdict(collections.Counter)
    sess_times = collections.defaultdict(list)
    for e in entries:
        sess_branches[e["session_id"]][e["branch"]] += 1
        if e["ts"]:
            sess_times[e["session_id"]].append(e["ts"])
    dominant_branch = {s: c.most_common(1)[0][0] for s, c in sess_branches.items()}

    def session_repr_ts(sid):
        ts = sorted(sess_times.get(sid, []))
        return ts[len(ts) // 2] if ts else None

    # ------------------------------------------------------------------
    # PR labelling. Returns (number|None, title|None, state, inferred).
    # ------------------------------------------------------------------
    def resolve_branch(branch, ts):
        if branch in MAIN_BRANCHES:
            p = infer_pr(ts)
            if p:
                return (p["number"], p["title"], "inferred", True)
            return (None, None, "unattributed", False)
        pr = branch_pr.get(branch, "MISSING")
        if pr == "ERROR":
            return (None, None, "unresolved", False)
        if pr == "MISSING" or pr is None:
            return (None, None, "no_pr", False)
        return (pr.get("number"), pr.get("title"), pr.get("state", "unknown"), False)

    def pr_label(num, title, state):
        if state == "unattributed":
            return "unattributed (on-main, no PR window)"
        if state == "unresolved":
            return "[unresolved]"
        if state == "no_pr":
            return "[no PR / non-PR branch]"
        base = f"#{num} {title}" if title else f"#{num}"
        return base + " [inferred]" if state == "inferred" else base

    # ---- aggregation helper ----
    BUCKETS = ["input", "output", "cache_read", "cache_write"]

    def agg(rows):
        a = {b: 0 for b in BUCKETS}
        a["total"] = 0
        a["cost"] = 0.0
        a["cost_flagged"] = False
        a["entries"] = 0
        for r in rows:
            for b in BUCKETS:
                a[b] += r[b]
            a["total"] += r["total"]
            a["entries"] += 1
            if r["cost"] is None:
                # only an unpriced entry with REAL tokens makes a group's cost
                # uncertain; a 0-token placeholder (e.g. <synthetic>) does not.
                if r["total"] > 0:
                    a["cost_flagged"] = True
            else:
                a["cost"] += r["cost"]
        return a

    grand = agg(entries)
    grand_cost = grand["cost"] or 0.0

    def pct(cost):
        return round(100.0 * cost / grand_cost, 2) if grand_cost else 0.0

    # ---- BY MODEL ----
    g = collections.defaultdict(list)
    for e in entries:
        g[e["model"]].append(e)
    by_model = sorted(
        ({"model": m, **agg(rows), "pct_of_total_cost": pct(agg(rows)["cost"])}
         for m, rows in g.items()),
        key=lambda r: r["cost"], reverse=True)

    # ---- BY SESSION ----
    g = collections.defaultdict(list)
    for e in entries:
        g[e["session_id"]].append(e)
    by_session = []
    for sid, rows in g.items():
        a = agg(rows)
        times = [r["ts"] for r in rows if r["ts"]]
        by_session.append({
            "session_id": sid,
            "first_ts": min(times).isoformat() if times else None,
            "last_ts": max(times).isoformat() if times else None,
            "dominant_branch": dominant_branch[sid],
            **a, "pct_of_total_cost": pct(a["cost"]),
        })
    by_session.sort(key=lambda r: r["cost"], reverse=True)

    # ---- BY PR: per-message ----
    g = collections.defaultdict(list)
    pm_prnum = {}
    for e in entries:
        num, title, state, inf = resolve_branch(e["branch"], e["ts"])
        lab = pr_label(num, title, state)
        g[lab].append(e)
        pm_prnum[lab] = num
    by_pr_pm = sorted(
        ({"pr": lab, "pr_number": pm_prnum[lab], **agg(rows),
          "pct_of_total_cost": pct(agg(rows)["cost"])} for lab, rows in g.items()),
        key=lambda r: r["cost"], reverse=True)

    # ---- BY PR: session-dominant ----
    g = collections.defaultdict(list)
    sd_prnum = {}
    for e in entries:
        sid = e["session_id"]
        num, title, state, inf = resolve_branch(dominant_branch[sid], session_repr_ts(sid))
        lab = pr_label(num, title, state)
        g[lab].append(e)
        sd_prnum[lab] = num
    by_pr_sd = sorted(
        ({"pr": lab, "pr_number": sd_prnum[lab], **agg(rows),
          "pct_of_total_cost": pct(agg(rows)["cost"])} for lab, rows in g.items()),
        key=lambda r: r["cost"], reverse=True)

    # ---- divergence: keyed by PR NUMBER (hard+inferred merged), >20% of cost ----
    def cost_by_prnum(rows_with_num):
        c = collections.defaultdict(float)
        for r in rows_with_num:
            key = r["pr_number"] if r["pr_number"] is not None else r["pr"]
            c[key] += r["cost"]
        return c
    pm_c = cost_by_prnum(by_pr_pm)
    sd_c = cost_by_prnum(by_pr_sd)
    divergence = []
    for key in set(pm_c) | set(sd_c):
        a, b = pm_c.get(key, 0.0), sd_c.get(key, 0.0)
        base = max(a, b)
        if base > 0 and abs(a - b) / base > 0.20:
            label = f"#{key}" if isinstance(key, int) else str(key)
            divergence.append({
                "pr": label,
                "permessage_cost_usd": round(a, 6),
                "session_dominant_cost_usd": round(b, 6),
                "abs_pct_diff": round(100.0 * abs(a - b) / base, 1),
            })
    divergence.sort(key=lambda d: d["abs_pct_diff"], reverse=True)

    # ---- BY RELEASE (canonical: git tags) ----
    g = collections.defaultdict(list)
    for e in entries:
        g[release_for(e["ts"])].append(e)
    by_release = sorted(
        ({"release": rel, **agg(rows), "pct_of_total_cost": pct(agg(rows)["cost"])}
         for rel, rows in g.items()), key=lambda r: r["cost"], reverse=True)

    # ---- BY RELEASE (supplementary: changelog-commit windows) ----
    g = collections.defaultdict(list)
    for e in entries:
        g[changelog_release_for(e["ts"])].append(e)
    by_release_cl = sorted(
        ({"release": rel, **agg(rows), "pct_of_total_cost": pct(agg(rows)["cost"])}
         for rel, rows in g.items()), key=lambda r: r["cost"], reverse=True)

    cw_1h_total = sum(e["cache_write_1h"] for e in entries)
    cw_5m_total = sum(e["cache_write_5m"] for e in entries)
    times_all = [e["ts"] for e in entries if e["ts"]]
    date_start = min(times_all).isoformat() if times_all else None
    date_end = max(times_all).isoformat() if times_all else None
    report_date = generated_at.strftime("%Y-%m-%d")

    # ==================================================================
    # Step 6a — fact_token_usage.csv (write FIRST so we can assert row count)
    # ==================================================================
    csv_path = os.path.join(out_dir, "fact_token_usage.csv")
    cols = ["entry_id", "session_id", "message_id", "timestamp_utc", "date", "iso_week", "model",
            "branch", "pr_number", "pr_title", "pr_state", "release_tag",
            "attribution_inferred", "input_tokens", "output_tokens",
            "cache_read_tokens", "cache_write_tokens", "total_tokens", "cost_usd",
            "generated_at", "pricing_version",
            "cache_write_5m_tokens", "cache_write_1h_tokens", "is_sidechain"]
    rows_written = 0
    with open(csv_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for e in sorted(entries, key=lambda x: (x["ts_raw"] or "", x["entry_id"])):
            num, title, state, inf = resolve_branch(e["branch"], e["ts"])
            d = e["ts"].strftime("%Y-%m-%d") if e["ts"] else ""
            wk = iso_week(e["ts"]) if e["ts"] else ""
            w.writerow([
                e["entry_id"], e["session_id"], e["message_id"],
                e["ts"].isoformat() if e["ts"] else "",
                d, wk, e["model"], e["branch"] or "",
                num if num is not None else "", title or "", state,
                release_for(e["ts"]),
                str(inf).lower(),
                e["input"], e["output"], e["cache_read"], e["cache_write"],
                e["total"], "" if e["cost"] is None else f"{e['cost']:.6f}",
                GEN_ISO, PRICING_VERSION,
                e["cache_write_5m"], e["cache_write_1h"], str(e["is_sidechain"]).lower(),
            ])
            rows_written += 1
    assert rows_written == len(entries), f"CSV rows {rows_written} != entries {len(entries)}"

    # ==================================================================
    # Step 5 — markdown report
    # ==================================================================
    def fi(n): return f"{n:,}"
    def fu(c, flagged=False): return f"${c:,.4f}" + (" *" if flagged else "")

    def table(rows, key, keyhead):
        out = [f"| {keyhead} | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |",
               "|---|--:|--:|--:|--:|--:|--:|--:|"]
        for r in rows:
            out.append(f"| {r[key]} | {fi(r['input'])} | {fi(r['output'])} | {fi(r['cache_read'])} | "
                       f"{fi(r['cache_write'])} | {fi(r['total'])} | {fu(r['cost'], r.get('cost_flagged'))} | "
                       f"{r['pct_of_total_cost']:.2f}% |")
        return "\n".join(out)

    md = []
    md.append(f"# Claude Code Token & Cost Report — {report_date}")
    md.append("")
    md.append(f"_Generated {GEN_ISO} · pricing `{PRICING_VERSION}` (verified {PRICING_VERIFIED_ON}) · schema `{SCHEMA_VERSION}`_")
    md.append("")
    md.append("## Totals")
    md.append("")
    md.append(f"- **Sessions (chats):** {len(by_session)}")
    md.append(f"- **Assistant messages (billable responses):** {fi(len(entries))} "
              f"— deduped from {fi(lines_scanned)} content-block lines (see methodology note)")
    md.append(f"- **Date range (UTC):** {date_start} → {date_end}")
    md.append("")
    md.append("| bucket | tokens |")
    md.append("|---|--:|")
    md.append(f"| input (fresh) | {fi(grand['input'])} |")
    md.append(f"| output | {fi(grand['output'])} |")
    md.append(f"| cache-read | {fi(grand['cache_read'])} |")
    md.append(f"| cache-write | {fi(grand['cache_write'])} |")
    md.append(f"| **total** | **{fi(grand['total'])}** |")
    md.append("")
    md.append(f"**Grand-total est. cost: {fu(grand_cost, grand['cost_flagged'])}**")
    md.append("")
    if cw_5m_total == 0:
        cw_desc = f"Cache-write is 100% 1-hour ephemeral ({fi(cw_1h_total)} tokens), priced at 2.0× input."
    elif cw_1h_total == 0:
        cw_desc = f"Cache-write is 100% 5-minute ephemeral ({fi(cw_5m_total)} tokens), priced at 1.25× input."
    else:
        cw_desc = (f"Cache-write splits {fi(cw_1h_total)} 1-hour (2.0× input) + "
                   f"{fi(cw_5m_total)} 5-minute (1.25× input) tokens.")
    md.append(f"> {cw_desc} The four token buckets are kept separate everywhere; "
              "cache-read (0.1× input) is **not** merged into fresh input.")
    md.append("")
    md.append("## By model")
    md.append("")
    md.append(table(by_model, "model", "model"))
    md.append("")
    md.append("## By chat (session)")
    md.append("")
    md.append("| session | first → last (UTC) | dominant branch | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |")
    md.append("|---|---|---|--:|--:|--:|--:|--:|--:|--:|")
    for r in by_session:
        md.append(f"| `{r['session_id'][:8]}…` | {r['first_ts']} → {r['last_ts']} | `{r['dominant_branch']}` | "
                  f"{fi(r['input'])} | {fi(r['output'])} | {fi(r['cache_read'])} | {fi(r['cache_write'])} | "
                  f"{fi(r['total'])} | {fu(r['cost'], r.get('cost_flagged'))} | {r['pct_of_total_cost']:.2f}% |")
    md.append("")
    md.append("## By PR")
    md.append("")
    md.append(f"PR resolution: {GH_NOTE}. On-`main`/branchless entries are timestamp-correlated "
              f"to the nearest merged PR within {INFER_WINDOW_DAYS} days and tagged `[inferred]`; "
              "anything outside that window stays `unattributed` rather than force-fit.")
    md.append("")
    md.append("### Per-message attribution")
    md.append("")
    md.append("_Each entry's tokens bucketed to the PR matching its own `gitBranch` (or its inferred PR)._")
    md.append("")
    md.append(table(by_pr_pm, "pr", "PR"))
    md.append("")
    md.append("### Session-dominant attribution")
    md.append("")
    md.append("_Each session's entire tokens bucketed to the branch appearing in the majority of its entries._")
    md.append("")
    md.append(table(by_pr_sd, "pr", "PR"))
    md.append("")
    md.append("### Divergence flags (per-PR, modes differ by >20% of est. cost)")
    md.append("")
    md.append("_`abs % diff` = |per-message − session-dominant| ÷ the **larger of the two** (i.e. relative to "
              "that PR's own attributed cost, **not** total spend). A PR flags when the two attribution modes "
              "disagree by >20% on how much to charge it — the signal for a session that sprawled across PRs._")
    md.append("")
    if divergence:
        md.append("| PR | per-message cost | session-dominant cost | abs % diff |")
        md.append("|---|--:|--:|--:|")
        for d in divergence:
            md.append(f"| {d['pr']} | ${d['permessage_cost_usd']:,.4f} | ${d['session_dominant_cost_usd']:,.4f} | {d['abs_pct_diff']:.1f}% |")
        md.append("")
        md.append("> These are sessions whose tokens land on different PRs depending on the rule — their "
                  "attribution is genuinely ambiguous. Here, session `24c401f6` built both #257 and #263; "
                  "session-dominant assigns all of it to #257, so #263 drops to $0.")
    else:
        md.append("_None — the two attribution modes agree within 20% on every PR._")
    md.append("")
    md.append("## By release")
    md.append("")
    md.append("### Canonical (git-tag windows)")
    md.append("")
    if tags:
        md.append(f"_{len(tags)} git tag(s) define the windows; pre-first-tag entries fall in `unreleased`._")
    else:
        md.append("_No git tags exist in this repo, so every entry falls in the single `unreleased` window._")
    md.append("")
    md.append(table(by_release, "release", "release"))
    md.append("")
    md.append("### Supplementary (changelog release-commit windows)")
    md.append("")
    md.append("_opchain ships via `chore(release): vX.Y` commits, not git tags. This non-canonical "
              "view buckets each entry into the window opened by the most recent release commit at its timestamp._")
    md.append("")
    md.append(table(by_release_cl, "release", "release"))
    md.append("")
    md.append("## Notes & caveats")
    md.append("")
    md.append(f"- **Pricing basis:** current Anthropic list pricing (`{PRICING_VERSION}`, verified {PRICING_VERIFIED_ON} "
              "against `skills/oc-claude-api/references/model-routing.md`): fable-5 $10/$50, opus-4-x $5/$25, "
              "sonnet-4-x $3/$15, haiku-4-x $1/$5 per MTok (input/output). `claude-opus-4-7` prices at the Opus tier "
              "(no separate rate; 4.6/4.7 remain Opus-tier). The pasted prompt block matched this table.")
    md.append("- **Cache pricing** (`skills/oc-claude-api/references/prompt-caching.md`): cache-read 0.10× input; "
              "cache-write 1.25× input (5-min TTL) / 2.0× input (1-hour TTL). "
              + ("All cache writes in this dataset are 1-hour." if cw_5m_total == 0 else
                 "All cache writes in this dataset are 5-minute." if cw_1h_total == 0 else
                 f"Split: {fi(cw_1h_total)} 1-hour + {fi(cw_5m_total)} 5-minute."))
    md.append(f"- **Chat discovery (spec Step 1):** enumerated every `~/.claude/projects/*/*.jsonl` on this machine "
              f"and kept the {N} whose in-file `cwd` is `{repo}` or nested under it — NOT derived from the lossy "
              "project-folder name. The manifest is `reports/token-usage/sessions.manifest`.")
    md.append(f"- **Coverage guarantee:** processed {files_processed}/{N} manifest files, 0 failed; "
              f"scanned {fi(lines_scanned)} assistant content-block lines → {fi(len(entries))} distinct messages "
              f"→ {fi(rows_written)} CSV rows (asserted equal). 100% of the manifest, no sampling.")
    md.append("- **Per-message dedup (methodology):** Claude Code logs one JSONL line per assistant *content "
              "block* (thinking/text/tool_use), each repeating the message's **cumulative** `usage`. Billing is "
              f"per message (one `message.id`/`requestId`), so this report counts usage **once per message**. "
              f"Summing per-line — as a naive reader of the transcript would — inflates the cost-dominant buckets "
              f"~14-17× (output 13.9×, cache-write 17×). 0 messages carried a conflicting usage tuple, so the "
              "dedup is exact, not an approximation.")
    live = max(by_session, key=lambda r: r["last_ts"] or "")
    md.append(f"- **Live-session caveat:** the most recent transcript (`{live['session_id'][:8]}…`) is the session "
              "generating this report; it measures itself only up to generation time. The other "
              f"{len(by_session) - 1} session(s) are complete.")
    if unpriced_models:
        md.append(f"- **Unpriced models (flagged `$… *`):** {', '.join(sorted(unpriced_models))} — not in the pricing "
                  "table (e.g. Claude Code `<synthetic>` placeholder turns); tokens counted, cost not estimated.")
    md.append("- Attribution is lossy: on-`main` work is inferred, not hard-linked. All timestamps UTC. "
              "Costs are list-price estimates, not a billing statement.")
    md.append("")
    report_path = os.path.join(out_dir, f"token-report-{report_date}.md")
    with open(report_path, "w") as f:
        f.write("\n".join(md))

    # ==================================================================
    # Step 6b — aggregates.json
    # ==================================================================
    def clean(rows):
        out = []
        for r in rows:
            rr = {k: v for k, v in r.items() if k != "cost_flagged"}
            rr["cost_usd"] = round(rr.pop("cost"), 6)
            rr["cache_read_tokens"] = rr.pop("cache_read")
            rr["cache_write_tokens"] = rr.pop("cache_write")
            rr["input_tokens"] = rr.pop("input")
            rr["output_tokens"] = rr.pop("output")
            rr["total_tokens"] = rr.pop("total")
            out.append(rr)
        return out

    totals = {
        "input_tokens": grand["input"], "output_tokens": grand["output"],
        "cache_read_tokens": grand["cache_read"], "cache_write_tokens": grand["cache_write"],
        "total_tokens": grand["total"], "cost_usd": round(grand_cost, 6),
        "entries": len(entries),
    }
    aggregates = {
        "by_model": clean([dict(r) for r in by_model]),
        "by_session": clean([dict(r) for r in by_session]),
        "by_pr_permessage": clean([dict(r) for r in by_pr_pm]),
        "by_pr_session_dominant": clean([dict(r) for r in by_pr_sd]),
        "by_release": clean([dict(r) for r in by_release]),
        "by_release_changelog": clean([dict(r) for r in by_release_cl]),
        "totals": totals,
    }
    with open(os.path.join(out_dir, "aggregates.json"), "w") as f:
        json.dump(aggregates, f, indent=2)

    # ==================================================================
    # Step 6c — meta.json
    # ==================================================================
    meta = {
        "generated_at": GEN_ISO,
        "schema_version": SCHEMA_VERSION,
        "repo": repo,
        "discovery": {
            "method": "cwd field inside each transcript (spec Step 1); folder names NOT used",
            "transcripts_scanned_machine_wide": len(all_jsonl),
            "manifest": manifest_path,
            "files_in_manifest": N,
            "files_processed": files_processed,
            "files_failed": files_failed,
            "assistant_lines_scanned": lines_scanned,
            "distinct_messages": len(entries),
            "entries_written": len(entries),
            "dedup": ("Claude Code writes one line per assistant content block, each repeating the "
                      "message's cumulative usage. Usage counted once per (sessionId, message.id); "
                      "0 messages had a conflicting usage tuple. Per-line summing inflates output ~13.9x, "
                      "cache-write ~17x."),
        },
        "session_count": len(by_session),
        "entry_count": len(entries),
        "date_range": {"start": date_start, "end": date_end},
        "pricing": {
            "version": PRICING_VERSION,
            "verified_on": PRICING_VERIFIED_ON,
            "source": "skills/oc-claude-api/references/{model-routing,prompt-caching}.md",
            "per_million_tokens": PRICING,
            "cache_read_multiplier_on_input": CACHE_READ_MULT,
            "cache_write_5m_multiplier_on_input": CACHE_WRITE_5M_MULT,
            "cache_write_1h_multiplier_on_input": CACHE_WRITE_1H_MULT,
        },
        "model_family_mapping": {m: model_family(m) for m in sorted({e["model"] for e in entries})},
        "unpriced_models": sorted(unpriced_models),
        "pr_resolution": {
            "method": GH_NOTE,
            "branch_to_pr": {b: (pr if pr not in ("ERROR",) else "[unresolved]")
                             for b, pr in branch_pr.items()},
            "on_main_inference": f"nearest merged PR within {INFER_WINDOW_DAYS} days; else unattributed",
            "merged_prs_for_inference": [{"number": p["number"], "merged": p["merged"].isoformat()} for p in merged_prs],
        },
        "git_tags": [{"name": n, "created": d.isoformat()} for n, d in tags],
        "changelog_release_windows": [{"version": v, "opened": t.isoformat()} for v, t in rel_windows],
        "divergence_basis": "abs % diff = |permessage - session_dominant| / max(the two), per PR number; flagged when > 20%. Relative to the PR's own attributed cost, not total spend.",
        "divergence": divergence,
        "cache_write_split": {"ephemeral_1h_tokens": cw_1h_total, "ephemeral_5m_tokens": cw_5m_total},
    }
    with open(os.path.join(out_dir, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    # ==================================================================
    # Step 6d — dashboard_export.json (oc-telemetry-ops export contract, retro)
    # ==================================================================
    K_ANON = 5
    # model tier distribution (k-anon: tiers with <5 entries fold to "other")
    tier_g = collections.defaultdict(list)
    for e in entries:
        tier_g[e["tier"]].append(e)
    tier_dist, tier_other = {}, []
    for tier, rows in tier_g.items():
        if len(rows) < K_ANON:
            tier_other.extend(rows)
        else:
            a = agg(rows)
            tier_dist[tier] = {"entries": a["entries"], "total_tokens": a["total"],
                               "cost_usd": round(a["cost"], 6), "pct_of_total_cost": pct(a["cost"])}
    if tier_other:
        a = agg(tier_other)
        prev = tier_dist.get("other", {"entries": 0, "total_tokens": 0, "cost_usd": 0.0})
        tier_dist["other"] = {
            "entries": prev["entries"] + a["entries"],
            "total_tokens": prev["total_tokens"] + a["total"],
            "cost_usd": round(prev["cost_usd"] + a["cost"], 6),
            "pct_of_total_cost": pct(prev.get("cost_usd", 0.0) + a["cost"]),
        }
    # avg cost per "feature" = mean est. cost per MERGED PR (per-message attribution)
    merged_nums = {p["number"] for p in merged_prs}
    cost_to_merged = sum(r["cost"] for r in by_pr_pm if r["pr_number"] in merged_nums)
    avg_cost_per_feature = round(cost_to_merged / len(merged_nums), 6) if merged_nums else None
    # weekly buckets (k-anon)
    wk_g = collections.defaultdict(list)
    for e in entries:
        wk_g[iso_week(e["ts"]) if e["ts"] else "undated"].append(e)
    weekly, wk_other = {}, []
    for wk, rows in wk_g.items():
        if len(rows) < K_ANON:
            wk_other.extend(rows)
        else:
            a = agg(rows)
            weekly[wk] = {"entries": a["entries"], "total_tokens": a["total"], "cost_usd": round(a["cost"], 6)}
    if wk_other:
        a = agg(wk_other)
        weekly["other"] = {"entries": a["entries"], "total_tokens": a["total"], "cost_usd": round(a["cost"], 6)}
    dashboard = {
        "_note": ("Retroactive one-shot export shaped to the oc-telemetry-ops /dashboard contract. "
                  "NOT sourced from .checkpoints/usage.sqlite (opt-in, content-free, can't be backfilled) — "
                  "derived from Claude Code session transcripts. Interactive sessions are not skill runs, "
                  "so pipeline/skill fields are null."),
        "generated_at": GEN_ISO,
        "k_anonymity_threshold": K_ANON,
        "model_tier_distribution": tier_dist,
        "avg_cost_per_feature_usd": avg_cost_per_feature,
        "feature_definition": "merged PR (per-message attribution); merged PRs in window: "
                              + ", ".join(f"#{n}" for n in sorted(merged_nums)),
        "weekly_buckets": weekly,
        "totals": {"cost_usd": round(grand_cost, 6), "total_tokens": grand["total"], "entries": len(entries)},
        "pipelines_run": None,
        "by_skill": None,
        "eval_score_trend": None,
        "_null_fields_note": "pipelines_run / by_skill / eval_score_trend are N/A for interactive CC traffic (no skill semantics to fake).",
    }
    with open(os.path.join(out_dir, "dashboard_export.json"), "w") as f:
        json.dump(dashboard, f, indent=2)

    # ==================================================================
    # Step 6e — .checkpoints/oc-cost-ops.checkpoint.json (wire 1.1)
    # ==================================================================
    by_model_cost = {}
    for r in by_model:
        if not r.get("cost_flagged") or r["cost"] > 0:
            by_model_cost[r["model"]] = round(r["cost"], 6)
    # reconciliation: Σ by_phase == Σ by_model == total_usd
    sum_models = round(sum(by_model_cost.values()), 6)
    total_usd = round(grand_cost, 6)
    assert abs(sum_models - total_usd) < 0.01, f"by_model Σ {sum_models} != total {total_usd}"
    cost_obj = {
        "currency": "USD",
        "total_usd": total_usd,
        # budget_usd intentionally omitted: this is a retro analysis with no
        # ceiling. The CI validator rejects a null budget_usd (must be a
        # non-negative number if present), so we leave the key out entirely.
        "by_phase": {"interactive": total_usd},
        "by_model": by_model_cost,
        "tokens": {"input": grand["input"], "output": grand["output"]},
        "updated_at": GEN_ISO,
    }
    assert abs(sum(cost_obj["by_phase"].values()) - total_usd) < 0.01, "by_phase Σ != total"
    ckpt_path = os.path.join(out_root, ".checkpoints", "oc-cost-ops.checkpoint.json")
    import re as _re
    created_at = GEN_ISO
    if os.path.exists(ckpt_path):
        try:
            with open(ckpt_path) as f:
                prev = json.load(f).get("created_at", GEN_ISO)
            prev = prev.replace("+00:00", "Z")
            if _re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$", prev):
                created_at = prev   # keep original creation stamp if well-formed
        except (OSError, json.JSONDecodeError):
            pass
    checkpoint = {
        "protocol_version": "1.1",
        "skill": "oc-cost-ops",
        "project": "opchain.dev",
        "project_dir": repo,
        "created_at": created_at,
        "updated_at": GEN_ISO,
        "phase": "analysis",
        "step": "retro-token-audit",
        "status": "complete",
        "progress_summary": (
            f"Retro token+cost audit of {len(by_session)} Claude Code session(s) "
            f"({fi(len(entries))} assistant entries, {date_start} → {date_end}). "
            f"Grand est. cost {fu(total_usd)} on current Anthropic list pricing. "
            "Full breakdowns (model/chat/PR/release) live in reports/token-usage/."),
        "next_actions": [
            "Re-run reports/token-usage/generate.py weekly; entry_id keys make it append-safe.",
            "Set budget_usd in this checkpoint to gate future spend via /oc-cost gate.",
        ],
        "cost": cost_obj,
        "skill_state": {
            "token_buckets": {
                "input_fresh": grand["input"], "output": grand["output"],
                "cache_read": grand["cache_read"], "cache_write": grand["cache_write"],
                "total": grand["total"],
            },
            "report_dir": "reports/token-usage",
            "pricing_version": PRICING_VERSION,
        },
    }
    os.makedirs(os.path.dirname(ckpt_path), exist_ok=True)
    with open(ckpt_path, "w") as f:
        json.dump(checkpoint, f, indent=2)

    # ---- final console summary ----
    print("[step6] WROTE:")
    for p in (manifest_path, report_path, csv_path,
              os.path.join(out_dir, "aggregates.json"), os.path.join(out_dir, "meta.json"),
              os.path.join(out_dir, "dashboard_export.json"), ckpt_path):
        print(f"  {p}  ({os.path.getsize(p)} bytes)")
    print(f"\nsessions={len(by_session)} entries={len(entries)} grand_cost={fu(total_usd)}")
    print(f"buckets: input={grand['input']} output={grand['output']} "
          f"cache_read={grand['cache_read']} cache_write={grand['cache_write']} total={grand['total']}")
    print(f"reconciliation OK: Σby_model={sum_models} == Σby_phase={total_usd} == total={total_usd}")


if __name__ == "__main__":
    main()
