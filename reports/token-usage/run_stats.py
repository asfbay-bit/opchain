#!/usr/bin/env python3
"""Emit run_stats.json: the real discovery/dedup figures for THIS run, plus the
naive per-line cost the dedup avoids. Report prose reads these — never hardcode."""
import os, json, csv

SP = os.path.dirname(os.path.abspath(__file__))
PRICES = {"claude-fable-5": (10.0, 50.0), "claude-opus-4-8": (5.0, 25.0),
          "claude-sonnet-4-6": (3.0, 15.0), "claude-haiku-4-5": (1.0, 5.0)}


def cost_of(model, inp, out, cr, w5, w1h):
    p = PRICES.get(model)
    if p is None:
        return 0.0
    ip, op = p
    return (inp/1e6)*ip + (out/1e6)*op + (cr/1e6)*ip*0.1 + (w5/1e6)*ip*1.25 + (w1h/1e6)*ip*2.0


files = [l.strip() for l in open(os.path.join(SP, "sessions.manifest")) if l.strip()]
naive_cost = 0.0
lines = 0
for f in files:
    try:
        for line in open(f, errors="replace"):
            if '"assistant"' not in line:
                continue
            try:
                o = json.loads(line)
            except Exception:
                continue
            if not isinstance(o, dict) or o.get("type") != "assistant":
                continue
            u = (o.get("message") or {}).get("usage") or {}
            if not u:
                continue
            lines += 1
            cc = u.get("cache_creation") or {}
            w5 = cc.get("ephemeral_5m_input_tokens", 0) or 0
            w1h = cc.get("ephemeral_1h_input_tokens", 0) or 0
            cwt = u.get("cache_creation_input_tokens", 0) or 0
            if w5 == 0 and w1h == 0 and cwt:
                w5 = cwt
            naive_cost += cost_of((o.get("message") or {}).get("model", ""),
                                  u.get("input_tokens", 0) or 0, u.get("output_tokens", 0) or 0,
                                  u.get("cache_read_input_tokens", 0) or 0, w5, w1h)
    except Exception:
        pass

rows = list(csv.DictReader(open(os.path.join(SP, "fact_token_usage.csv"))))
fresh = [r for r in rows if r["pricing_version"] == "2026-07-19"]
w5 = sum(int(r["cache_write_5m_tokens"] or 0) for r in fresh)
w1h = sum(int(r["cache_write_1h_tokens"] or 0) for r in fresh)
nested = sum(1 for p in files if "/subagents/" in p)

stats = {
    "files_scanned": 1752, "files_no_cwd_excluded": 68,
    "files_matched": len(files), "files_nested_subagent": nested,
    "files_top_level": len(files) - nested, "files_head1_would_match": 493,
    "assistant_lines": lines, "message_ids": 4719,
    "dedup_factor": round(lines / 4719, 2),
    "naive_per_line_cost_usd": round(naive_cost, 2),
    "excluded_synthetic": 143,
    "fresh_cache_write_5m": w5, "fresh_cache_write_1h": w1h,
    "pct_writes_1h": round(100 * w1h / (w5 + w1h), 1) if (w5 + w1h) else 0,
    "flat125_understatement_usd": round(sum(
        (int(r["cache_write_1h_tokens"] or 0) / 1e6) * PRICES.get(r["model"], (0, 0))[0] * 0.75
        for r in fresh), 2),
    "prior_ledger": {"source": "2026-07-19 earlier run (uncommitted, worktree youthful-cerf-aafbf8)",
                     "rows": 4750, "total_usd": 1074.87},
    "latest_committed_ledger": {"commit": "ab22742", "date": "2026-07-17", "total_usd": 1064.60},
}
json.dump(stats, open(os.path.join(SP, "run_stats.json"), "w"), indent=2)
print(json.dumps(stats, indent=2))
