import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { bindLogger, EVENTS } from "../src/lib/request-id.js";

describe("structured logger", () => {
  let logs;
  let origLog, origWarn, origError;

  beforeEach(() => {
    logs = { info: [], warn: [], error: [] };
    origLog = console.log; origWarn = console.warn; origError = console.error;
    console.log   = vi.fn((...args) => logs.info.push(args.join(" ")));
    console.warn  = vi.fn((...args) => logs.warn.push(args.join(" ")));
    console.error = vi.fn((...args) => logs.error.push(args.join(" ")));
  });

  afterEach(() => {
    console.log = origLog; console.warn = origWarn; console.error = origError;
  });

  it("event() emits a single JSON line with request_id + event + fields", () => {
    const log = bindLogger("req-123");
    log.event(EVENTS.CHAT_STARTED, { skill: "app-architect" });
    expect(logs.info).toHaveLength(1);
    const parsed = JSON.parse(logs.info[0]);
    expect(parsed.level).toBe("info");
    expect(parsed.event).toBe("chat_started");
    expect(parsed.request_id).toBe("req-123");
    expect(parsed.skill).toBe("app-architect");
    expect(typeof parsed.ts).toBe("string");
  });

  it("eventError() routes to console.error", () => {
    const log = bindLogger("r2");
    log.eventError(EVENTS.UPSTREAM_FAILED, { upstream: "anthropic", status: 502 });
    expect(logs.error).toHaveLength(1);
    const parsed = JSON.parse(logs.error[0]);
    expect(parsed.level).toBe("error");
    expect(parsed.event).toBe("upstream_failed");
    expect(parsed.status).toBe(502);
  });

  it("EVENTS is a stable canonical list", () => {
    expect(EVENTS.FEEDBACK_SUBMITTED).toBe("feedback_submitted");
    expect(EVENTS.CHAT_STARTED).toBe("chat_started");
    expect(EVENTS.CHAT_COMPLETED).toBe("chat_completed");
    expect(EVENTS.RATE_LIMIT_HIT).toBe("rate_limit_hit");
    expect(EVENTS.UPSTREAM_FAILED).toBe("upstream_failed");
  });
});
