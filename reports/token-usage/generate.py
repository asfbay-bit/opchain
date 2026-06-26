#!/usr/bin/env python3
"""
Claude Code token + cost report generator.

Parses session transcripts under ~/.claude/projects/<dir>/*.jsonl for THIS repo,
computes a token + cost report broken down by model / chat / PR / release, and
emits a human-readable Markdown report plus a machine-readable data layer
(fact_token_usage.csv, aggregates.json, meta.json).

Pricing basis chosen by the user: CURRENT Anthropic list pricing.
Cache tokens are kept in four separate buckets everywhere; 1h vs 5m cache
writes are priced distinctly (1.25x vs 2.0x input).
"""
import json, os, sys, hashlib, subprocess, collections, datetime as dt

# ----------------------------------------------------------------------------
# Pricing config (per MILLION tokens). USER CHOICE: current Anthropic list price.
# ----------------------------------------------------------------------------
PRICING_VERSION = "anthropic-list-current-2026-06-26"
PRICING = {
    # family -> {input, output} USD per 1M tokens
    "claude-opus-4-x":   {"input": 5.00,  "output": 25.00},
    "claude-sonnet-4-x": {"input": 3.00,  "output": 15.00},
    "claude-haiku-4-x":  {"input": 1.00,  "output": 5.00},
    # included for completeness / future runs (not present in this dataset):
    "claude-fable-5":    {"input": 10.00, "output": 50.00},
}
# Derived multipliers on the model's INPUT rate.
CACHE_READ_MULT     = 0.10   # cache read = 0.10 x input
CACHE_WRITE_5M_MULT = 1.25   # 5-minute ephemeral cache write
CACHE_WRITE_1H_MULT = 2.00   # 1-hour  ephemeral cache write

SCHEMA_VERSION = "1.0"

# Branch -> PR resolution, supplied by the caller after querying the GitHub MCP
# server (no `gh` CLI in this environment). Empty value => branch has no PR.
# Each value: {"number": int, "title": str, "state": str, "mergedAt": str|None}
BRANCH_PR = {
    # The development branch for this task has no PR at report time.
    "claude/token-analysis-prompt-xis8j8": None,
}
GH_RESOLVED_VIA = "github-mcp (gh CLI unavailable)"

MAIN_BRANCHES = {"main", "master", None, ""}


def model_family(model: str):
    if not model:
        return None
    m = model.lower()
    if m == "claude-fable-5" or m.startswith("claude-fable"):
        return "claude-fable-5"
    if "opus-4" in m:
        return "claude-opus-4-x"
    if "sonnet-4" in m:
        return "claude-sonnet-4-x"
    if "haiku-4" in m:
        return "claude-haiku-4-x"
    return None  # unknown -> flagged, not estimated


def entry_cost(fam, u_in, u_out, u_cread, cw_5m, cw_1h):
    """Cost in USD for one entry, given its model family and token buckets."""
    if fam is None or fam not in PRICING:
        return None  # unpriced -> flagged
    ir = PRICING[fam]["input"] / 1e6
    orr = PRICING[fam]["output"] / 1e6
    cost = (
        u_in * ir
        + u_out * orr
        + u_cread * CACHE_READ_MULT * ir
        + cw_5m * CACHE_WRITE_5M_MULT * ir
        + cw_1h * CACHE_WRITE_1H_MULT * ir
    )
    return cost


def iso_week(d: dt.datetime):
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def main():
    repo = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
    proj_dir_name = repo.replace("/", "-").replace(".", "-")
    home = os.path.expanduser("~")
    proj_dir = os.path.join(home, ".claude", "projects", proj_dir_name)
    if not os.path.isdir(proj_dir):
        print(f"FATAL: projects dir not found: {proj_dir}", file=sys.stderr)
        sys.exit(2)

    jsonls = sorted(
        os.path.join(proj_dir, f) for f in os.listdir(proj_dir) if f.endswith(".jsonl")
    )
    if not jsonls:
        print(f"FATAL: no .jsonl session files under {proj_dir}", file=sys.stderr)
        sys.exit(2)

    # ---- git tags (release windows) ----
    tag_raw = subprocess.run(
        ["git", "tag", "--sort=creatordate", "--format=%(refname:short)\t%(creatordate:iso-strict)"],
        cwd=repo, text=True, capture_output=True,
    ).stdout.strip()
    tags = []  # list of (name, datetime_utc)
    for line in tag_raw.splitlines():
        if not line.strip():
            continue
        name, _, iso = line.partition("\t")
        try:
            tdt = dt.datetime.fromisoformat(iso.strip()).astimezone(dt.timezone.utc)
        except ValueError:
            continue
        tags.append((name.strip(), tdt))
    tags.sort(key=lambda t: t[1])

    def release_for(ts: dt.datetime):
        """Bucket a UTC timestamp into the window between consecutive tags.
        Pre-first-tag => 'unreleased'. Otherwise the tag that opens the window
        the timestamp falls into (>= tag_i and < tag_{i+1})."""
        if not tags:
            return "unreleased"
        if ts < tags[0][1]:
            return "unreleased"
        rel = tags[0][0]
        for name, tdt in tags:
            if ts >= tdt:
                rel = name
            else:
                break
        return rel

    # ---- parse all assistant entries ----
    entries = []
    unpriced_models = set()
    for path in jsonls:
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
                msg = o.get("message", {}) or {}
                u = msg.get("usage", {}) or {}
                model = msg.get("model") or "unknown"
                fam = model_family(model)
                if fam is None:
                    unpriced_models.add(model)

                u_in = u.get("input_tokens", 0) or 0
                u_out = u.get("output_tokens", 0) or 0
                u_cread = u.get("cache_read_input_tokens", 0) or 0
                cw_total = u.get("cache_creation_input_tokens", 0) or 0
                cc = u.get("cache_creation", {}) or {}
                cw_5m = cc.get("ephemeral_5m_input_tokens", None)
                cw_1h = cc.get("ephemeral_1h_input_tokens", None)
                if cw_5m is None and cw_1h is None:
                    # No breakdown -> default TTL is 5m.
                    cw_5m, cw_1h = cw_total, 0
                else:
                    cw_5m = cw_5m or 0
                    cw_1h = cw_1h or 0
                cw_bucket = cw_5m + cw_1h  # == cache_creation_input_tokens

                ts_raw = o.get("timestamp")
                tsdt = None
                if ts_raw:
                    try:
                        tsdt = dt.datetime.fromisoformat(ts_raw.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
                    except ValueError:
                        tsdt = None

                session_id = o.get("sessionId") or os.path.basename(path).replace(".jsonl", "")
                branch = o.get("gitBranch")
                entry_id = hashlib.sha256(f"{session_id}:{idx}".encode()).hexdigest()[:16]

                cost = entry_cost(fam, u_in, u_out, u_cread, cw_5m, cw_1h)

                entries.append({
                    "entry_id": entry_id,
                    "session_id": session_id,
                    "ts": tsdt,
                    "ts_raw": ts_raw,
                    "model": model,
                    "family": fam,
                    "branch": branch,
                    "input": u_in,
                    "output": u_out,
                    "cache_read": u_cread,
                    "cache_write": cw_bucket,
                    "cache_write_5m": cw_5m,
                    "cache_write_1h": cw_1h,
                    "total": u_in + u_out + u_cread + cw_bucket,
                    "cost": cost,
                    "is_sidechain": bool(o.get("isSidechain", False)),
                })

    if not entries:
        print("FATAL: no assistant entries found.", file=sys.stderr)
        sys.exit(2)

    generated_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    GEN_ISO = generated_at.isoformat()

    # ---- session -> dominant branch ----
    sess_branches = collections.defaultdict(collections.Counter)
    for e in entries:
        sess_branches[e["session_id"]][e["branch"]] += 1
    dominant_branch = {s: c.most_common(1)[0][0] for s, c in sess_branches.items()}

    # ---- PR resolution ----
    def resolve_pr(branch):
        """Return (pr_number, pr_title, pr_state, inferred:bool)."""
        if branch in MAIN_BRANCHES:
            return (None, None, "unattributed", False)
        pr = BRANCH_PR.get(branch, "MISSING")
        if pr == "MISSING":
            # branch we never resolved -> unresolved
            return (None, None, "unresolved", False)
        if pr is None:
            return (None, None, "no_pr", False)
        return (pr.get("number"), pr.get("title"), pr.get("state", "unknown"), False)

    def pr_label(branch):
        num, title, state, inferred = resolve_pr(branch)
        if state == "unattributed":
            return "unattributed (main/no-branch)"
        if state == "unresolved":
            return f"{branch} [unresolved]"
        if state == "no_pr":
            return f"{branch} [no PR]"
        tag = f"#{num}"
        return f"{tag} {title}" if title else tag

    # ---- aggregation helper ----
    BUCKETS = ["input", "output", "cache_read", "cache_write"]

    def agg(rows):
        a = {b: 0 for b in BUCKETS}
        a["total"] = 0
        a["cost"] = 0.0
        a["cost_flagged"] = False
        for r in rows:
            for b in BUCKETS:
                a[b] += r[b]
            a["total"] += r["total"]
            if r["cost"] is None:
                a["cost_flagged"] = True
            else:
                a["cost"] += r["cost"]
        return a

    grand = agg(entries)
    grand_cost = grand["cost"] or 0.0

    def pct(cost):
        return round(100.0 * cost / grand_cost, 2) if grand_cost else 0.0

    # ---- BY MODEL ----
    by_model_groups = collections.defaultdict(list)
    for e in entries:
        by_model_groups[e["model"]].append(e)
    by_model = []
    for model, rows in by_model_groups.items():
        a = agg(rows)
        by_model.append({"model": model, **a, "pct_of_total_cost": pct(a["cost"])})
    by_model.sort(key=lambda r: r["cost"], reverse=True)

    # ---- BY SESSION (chat) ----
    by_sess_groups = collections.defaultdict(list)
    for e in entries:
        by_sess_groups[e["session_id"]].append(e)
    by_session = []
    for sid, rows in by_sess_groups.items():
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
    pm_groups = collections.defaultdict(list)
    for e in entries:
        pm_groups[pr_label(e["branch"])].append(e)
    by_pr_pm = []
    for label, rows in pm_groups.items():
        a = agg(rows)
        by_pr_pm.append({"pr": label, **a, "pct_of_total_cost": pct(a["cost"])})
    by_pr_pm.sort(key=lambda r: r["cost"], reverse=True)

    # ---- BY PR: session-dominant ----
    sd_groups = collections.defaultdict(list)
    for e in entries:
        sd_groups[pr_label(dominant_branch[e["session_id"]])].append(e)
    by_pr_sd = []
    for label, rows in sd_groups.items():
        a = agg(rows)
        by_pr_sd.append({"pr": label, **a, "pct_of_total_cost": pct(a["cost"])})
    by_pr_sd.sort(key=lambda r: r["cost"], reverse=True)

    # ---- divergence: PRs where the two modes differ by >20% of est cost ----
    pm_cost = {r["pr"]: r["cost"] for r in by_pr_pm}
    sd_cost = {r["pr"]: r["cost"] for r in by_pr_sd}
    divergence = []
    for label in set(pm_cost) | set(sd_cost):
        c_pm = pm_cost.get(label, 0.0)
        c_sd = sd_cost.get(label, 0.0)
        base = max(c_pm, c_sd)
        if base > 0 and abs(c_pm - c_sd) / base > 0.20:
            divergence.append({
                "pr": label,
                "permessage_cost_usd": round(c_pm, 6),
                "session_dominant_cost_usd": round(c_sd, 6),
                "abs_pct_diff": round(100.0 * abs(c_pm - c_sd) / base, 1),
            })
    divergence.sort(key=lambda d: d["abs_pct_diff"], reverse=True)

    # ---- BY RELEASE ----
    rel_groups = collections.defaultdict(list)
    for e in entries:
        rel_groups[release_for(e["ts"]) if e["ts"] else "unreleased"].append(e)
    by_release = []
    for rel, rows in rel_groups.items():
        a = agg(rows)
        by_release.append({"release": rel, **a, "pct_of_total_cost": pct(a["cost"])})
    by_release.sort(key=lambda r: r["cost"], reverse=True)

    # ------------------------------------------------------------------
    # OUTPUT FILES
    # ------------------------------------------------------------------
    out_dir = os.path.join(repo, "reports", "token-usage")
    os.makedirs(out_dir, exist_ok=True)
    report_date = generated_at.strftime("%Y-%m-%d")

    def fmt_int(n):
        return f"{n:,}"

    def fmt_usd(c, flagged=False):
        s = f"${c:,.4f}"
        return s + " *" if flagged else s

    def table(rows, key, keyhead):
        lines = [
            f"| {keyhead} | input | output | cache-read | cache-write | total tokens | est. cost | % of total cost |",
            "|---|--:|--:|--:|--:|--:|--:|--:|",
        ]
        for r in rows:
            lines.append(
                f"| {r[key]} | {fmt_int(r['input'])} | {fmt_int(r['output'])} | "
                f"{fmt_int(r['cache_read'])} | {fmt_int(r['cache_write'])} | "
                f"{fmt_int(r['total'])} | {fmt_usd(r['cost'], r.get('cost_flagged'))} | "
                f"{r['pct_of_total_cost']:.2f}% |"
            )
        return "\n".join(lines)

    times_all = [e["ts"] for e in entries if e["ts"]]
    date_start = min(times_all).isoformat() if times_all else None
    date_end = max(times_all).isoformat() if times_all else None

    md = []
    md.append(f"# Claude Code Token & Cost Report — {report_date}")
    md.append("")
    md.append(f"_Generated {GEN_ISO} · pricing `{PRICING_VERSION}` · schema `{SCHEMA_VERSION}`_")
    md.append("")
    md.append("## Totals")
    md.append("")
    md.append(f"- **Sessions (chats):** {len(by_session)}")
    md.append(f"- **Assistant entries:** {len(entries)}")
    md.append(f"- **Date range (UTC):** {date_start} → {date_end}")
    md.append("")
    md.append("| bucket | tokens |")
    md.append("|---|--:|")
    md.append(f"| input (fresh) | {fmt_int(grand['input'])} |")
    md.append(f"| output | {fmt_int(grand['output'])} |")
    md.append(f"| cache-read | {fmt_int(grand['cache_read'])} |")
    md.append(f"| cache-write | {fmt_int(grand['cache_write'])} |")
    md.append(f"| **total** | **{fmt_int(grand['total'])}** |")
    md.append("")
    md.append(f"**Grand-total est. cost: {fmt_usd(grand_cost, grand['cost_flagged'])}**")
    md.append("")
    md.append(
        "> Cache-write is 100% 1-hour ephemeral here "
        f"({fmt_int(sum(e['cache_write_1h'] for e in entries))} of "
        f"{fmt_int(grand['cache_write'])} tokens), priced at 2.0× input. "
        "The four token buckets are kept separate everywhere; cache-read is "
        "**not** merged into fresh input."
    )
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
        span = f"{r['first_ts']} → {r['last_ts']}"
        md.append(
            f"| `{r['session_id'][:8]}…` | {span} | `{r['dominant_branch']}` | "
            f"{fmt_int(r['input'])} | {fmt_int(r['output'])} | {fmt_int(r['cache_read'])} | "
            f"{fmt_int(r['cache_write'])} | {fmt_int(r['total'])} | "
            f"{fmt_usd(r['cost'], r.get('cost_flagged'))} | {r['pct_of_total_cost']:.2f}% |"
        )
    md.append("")
    md.append("## By PR")
    md.append("")
    md.append(f"PR resolution: {GH_RESOLVED_VIA}.")
    md.append("")
    md.append("### Per-message attribution")
    md.append("")
    md.append("_Each entry's tokens bucketed to the PR matching its own `gitBranch`._")
    md.append("")
    md.append(table(by_pr_pm, "pr", "PR"))
    md.append("")
    md.append("### Session-dominant attribution")
    md.append("")
    md.append("_Each session's entire tokens bucketed to the branch appearing in the majority of its entries._")
    md.append("")
    md.append(table(by_pr_sd, "pr", "PR"))
    md.append("")
    md.append("### Divergence flags (modes differ by >20% of est. cost)")
    md.append("")
    if divergence:
        md.append("| PR | per-message cost | session-dominant cost | abs % diff |")
        md.append("|---|--:|--:|--:|")
        for d in divergence:
            md.append(f"| {d['pr']} | ${d['permessage_cost_usd']:,.4f} | ${d['session_dominant_cost_usd']:,.4f} | {d['abs_pct_diff']:.1f}% |")
    else:
        md.append("_None — the two attribution modes agree (single session on a single branch; no sessions sprawl across PRs)._")
    md.append("")
    md.append("## By release")
    md.append("")
    md.append(table(by_release, "release", "release"))
    md.append("")
    md.append("## Notes & caveats")
    md.append("")
    md.append(f"- **Pricing basis:** current Anthropic list pricing ({PRICING_VERSION}). `claude-opus-4-8` → `claude-opus-4-x` family at $5.00 input / $25.00 output per MTok. (The prompt's pasted block had the stale Opus-3-era $15/$75 rate; the user selected current rates.)")
    md.append("- **Cache pricing:** cache-read = 0.10× input; cache-write = 1.25× input for 5-minute TTL, 2.0× input for 1-hour TTL. All cache writes in this dataset are 1-hour.")
    md.append("- **No git tags exist**, so every entry falls in the `unreleased` window.")
    md.append("- **Live-session caveat:** the only transcript is the session that produced this report. It necessarily measures itself up to the moment of generation; assistant turns spent generating/committing the report afterward are not captured.")
    if unpriced_models:
        md.append(f"- **Unpriced models (flagged, cost shown as `$… *`):** {', '.join(sorted(unpriced_models))} — not in the pricing table; tokens counted, cost not estimated.")
    md.append("- All timestamps UTC. Costs are estimates from list prices, not a billing statement.")
    md.append("")

    report_path = os.path.join(out_dir, f"token-report-{report_date}.md")
    with open(report_path, "w") as f:
        f.write("\n".join(md))

    # ---- fact_token_usage.csv ----
    import csv
    csv_path = os.path.join(out_dir, "fact_token_usage.csv")
    cols = [
        "entry_id", "session_id", "timestamp_utc", "date", "iso_week", "model",
        "branch", "pr_number", "pr_title", "pr_state", "release_tag",
        "attribution_inferred", "input_tokens", "output_tokens",
        "cache_read_tokens", "cache_write_tokens", "total_tokens", "cost_usd",
        "generated_at", "pricing_version",
        # extra audit columns (preserve the 1h/5m cache-write split):
        "cache_write_5m_tokens", "cache_write_1h_tokens", "is_sidechain",
    ]
    with open(csv_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for e in sorted(entries, key=lambda x: (x["ts_raw"] or "", x["entry_id"])):
            num, title, state, inferred = resolve_pr(e["branch"])
            d = e["ts"].strftime("%Y-%m-%d") if e["ts"] else ""
            wk = iso_week(e["ts"]) if e["ts"] else ""
            rel = release_for(e["ts"]) if e["ts"] else "unreleased"
            w.writerow([
                e["entry_id"], e["session_id"], e["ts"].isoformat() if e["ts"] else "",
                d, wk, e["model"], e["branch"] or "",
                num if num is not None else "", title or "", state, rel,
                str(inferred).lower(),
                e["input"], e["output"], e["cache_read"], e["cache_write"],
                e["total"],
                "" if e["cost"] is None else f"{e['cost']:.6f}",
                GEN_ISO, PRICING_VERSION,
                e["cache_write_5m"], e["cache_write_1h"], str(e["is_sidechain"]).lower(),
            ])

    # ---- aggregates.json ----
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

    aggregates = {
        "by_model": clean([dict(r) for r in by_model]),
        "by_session": clean([dict(r) for r in by_session]),
        "by_pr_permessage": clean([dict(r) for r in by_pr_pm]),
        "by_pr_session_dominant": clean([dict(r) for r in by_pr_sd]),
        "by_release": clean([dict(r) for r in by_release]),
        "totals": {
            "input_tokens": grand["input"],
            "output_tokens": grand["output"],
            "cache_read_tokens": grand["cache_read"],
            "cache_write_tokens": grand["cache_write"],
            "total_tokens": grand["total"],
            "cost_usd": round(grand_cost, 6),
        },
    }
    with open(os.path.join(out_dir, "aggregates.json"), "w") as f:
        json.dump(aggregates, f, indent=2)

    # ---- meta.json ----
    meta = {
        "generated_at": GEN_ISO,
        "schema_version": SCHEMA_VERSION,
        "repo": repo,
        "projects_dir": proj_dir,
        "session_count": len(by_session),
        "entry_count": len(entries),
        "date_range": {"start": date_start, "end": date_end},
        "pricing_version": PRICING_VERSION,
        "pricing": {
            "basis": "current Anthropic list pricing (user-selected over the stale pasted block)",
            "per_million_tokens": PRICING,
            "cache_read_multiplier_on_input": CACHE_READ_MULT,
            "cache_write_5m_multiplier_on_input": CACHE_WRITE_5M_MULT,
            "cache_write_1h_multiplier_on_input": CACHE_WRITE_1H_MULT,
        },
        "model_family_mapping": {m: model_family(m) for m in sorted({e["model"] for e in entries})},
        "unpriced_models": sorted(unpriced_models),
        "pr_resolution": {
            "method": GH_RESOLVED_VIA,
            "branch_to_pr": {k: (v if v else None) for k, v in BRANCH_PR.items()},
        },
        "git_tags": [{"name": n, "created": d.isoformat()} for n, d in tags],
        "divergence": divergence,
        "cache_write_split": {
            "ephemeral_1h_tokens": sum(e["cache_write_1h"] for e in entries),
            "ephemeral_5m_tokens": sum(e["cache_write_5m"] for e in entries),
        },
        "caveats": [
            "Single transcript = the live session generating this report; it measures itself up to generation time.",
            "No git tags exist; all entries bucket to 'unreleased'.",
            "Development branch has no PR at report time; per-message and session-dominant PR modes are identical.",
            "All cache writes are 1-hour ephemeral, priced at 2.0x input.",
        ],
    }
    with open(os.path.join(out_dir, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print("WROTE:")
    for p in ("token-report-%s.md" % report_date, "fact_token_usage.csv", "aggregates.json", "meta.json"):
        full = os.path.join(out_dir, p)
        print(f"  {full}  ({os.path.getsize(full)} bytes)")
    print()
    print(f"entries={len(entries)} sessions={len(by_session)} grand_cost=${grand_cost:,.4f}")
    print(f"buckets: input={grand['input']} output={grand['output']} cache_read={grand['cache_read']} cache_write={grand['cache_write']} total={grand['total']}")


if __name__ == "__main__":
    main()
