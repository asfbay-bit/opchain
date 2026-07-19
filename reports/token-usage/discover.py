#!/usr/bin/env python3
"""Discover opchain transcripts. Recursive glob + per-file FIRST-cwd scan.

Two traps this avoids (see memory/project_token_audit_pipeline.md):
  1. shallow 2-level glob drops nested subagents/**/agent-*.jsonl
  2. `head -1` cwd filter drops files whose first record is queue-operation/started
"""
import os, json, sys

REPO = "/Users/aidanelsesser/repos/opchain"
ROOT = os.path.expanduser("~/.claude/projects")
SP = os.path.dirname(os.path.abspath(__file__))

scanned = matched = no_cwd = 0
out = []
line1_only = 0

for dirpath, _dirs, files in os.walk(ROOT):
    for name in files:
        if not name.endswith(".jsonl"):
            continue
        p = os.path.join(dirpath, name)
        scanned += 1
        cwd = None
        first_line_cwd = None
        try:
            with open(p, errors="replace") as fh:
                for i, line in enumerate(fh):
                    if '"cwd"' not in line:
                        continue
                    try:
                        o = json.loads(line)
                    except Exception:
                        continue
                    c = o.get("cwd")
                    if c:
                        cwd = c
                        if i == 0:
                            first_line_cwd = c
                        break
        except Exception:
            pass
        if not cwd:
            no_cwd += 1
            continue
        if cwd == REPO or cwd.startswith(REPO + os.sep):
            matched += 1
            out.append(p)
            if first_line_cwd:
                line1_only += 1

out.sort()
with open(os.path.join(SP, "sessions.manifest"), "w") as fh:
    fh.write("\n".join(out) + "\n")

nested = sum(1 for p in out if "/subagents/" in p)
print(f"scanned={scanned} no_cwd_excluded={no_cwd} matched={matched}")
print(f"  top_level={matched - nested} nested_subagent={nested}")
print(f"  head-1-filter would have matched={line1_only}  (delta={matched - line1_only})")
