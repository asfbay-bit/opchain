#!/usr/bin/env python3
"""Parse Claude Code transcripts -> per-message usage rows. Writes raw_usage.csv."""
import os, json, csv, sys

SP = os.path.dirname(os.path.abspath(__file__))
MANIFEST = os.path.join(SP, "sessions.manifest")

files = [l.strip() for l in open(MANIFEST) if l.strip()]
processed = failed = 0
failed_files = []
lines_seen = 0

# key: (session_id, message_id) -> per-field MAX across streamed lines
agg = {}

for f in files:
    try:
        with open(f, errors="replace") as fh:
            for ln, line in enumerate(fh):
                line = line.strip()
                if not line or '"assistant"' not in line:
                    continue
                try:
                    o = json.loads(line)
                except Exception:
                    continue
                if not isinstance(o, dict) or o.get("type") != "assistant":
                    continue
                msg = o.get("message") or {}
                u = msg.get("usage") or {}
                if not u:
                    continue
                lines_seen += 1
                mid = msg.get("id") or f"noid:{f}:{ln}"
                sid = o.get("sessionId") or "unknown"
                key = (sid, mid)
                cc = u.get("cache_creation") or {}
                w5 = cc.get("ephemeral_5m_input_tokens", 0) or 0
                w1h = cc.get("ephemeral_1h_input_tokens", 0) or 0
                cw_total = u.get("cache_creation_input_tokens", 0) or 0
                # if the breakdown is absent, treat whole write as 5m (conservative)
                if w5 == 0 and w1h == 0 and cw_total:
                    w5 = cw_total
                rec = {
                    "input": u.get("input_tokens", 0) or 0,
                    "output": u.get("output_tokens", 0) or 0,
                    "cache_read": u.get("cache_read_input_tokens", 0) or 0,
                    "cw_5m": w5,
                    "cw_1h": w1h,
                }
                prev = agg.get(key)
                if prev is None:
                    agg[key] = {
                        **rec,
                        "timestamp": o.get("timestamp", ""),
                        "model": msg.get("model", "unknown"),
                        "branch": o.get("gitBranch", "") or "",
                        "sidechain": bool(o.get("isSidechain", False)),
                        "tier": u.get("service_tier", ""),
                    }
                else:
                    for k in ("input", "output", "cache_read", "cw_5m", "cw_1h"):
                        if rec[k] > prev[k]:
                            prev[k] = rec[k]
                    if not prev["branch"] and o.get("gitBranch"):
                        prev["branch"] = o["gitBranch"]
        processed += 1
    except Exception as e:
        failed += 1
        failed_files.append((f, str(e)))

out = os.path.join(SP, "raw_usage.csv")
with open(out, "w", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["session_id", "message_id", "timestamp_utc", "model", "branch",
                "is_sidechain", "service_tier", "input_tokens", "output_tokens",
                "cache_read_tokens", "cache_write_5m_tokens", "cache_write_1h_tokens"])
    for (sid, mid), v in agg.items():
        w.writerow([sid, mid, v["timestamp"], v["model"], v["branch"],
                    str(v["sidechain"]).lower(), v["tier"], v["input"], v["output"],
                    v["cache_read"], v["cw_5m"], v["cw_1h"]])

print(json.dumps({
    "files_in_manifest": len(files),
    "files_processed": processed,
    "files_failed": failed,
    "assistant_lines_seen": lines_seen,
    "entries_written": len(agg),
    "dedup_factor": round(lines_seen / max(len(agg), 1), 2),
}, indent=2))
if failed_files:
    print("FAILED:", failed_files[:10], file=sys.stderr)
