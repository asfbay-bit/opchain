import { describe, expect, it } from "vitest";
import { LABEL_MAP, PRIORITY_MAP, corsHeaders } from "../src/index.js";

describe("LABEL_MAP", () => {
  it("covers every feedback type the UI can submit", () => {
    expect(Object.keys(LABEL_MAP).sort()).toEqual([
      "bug",
      "feature",
      "general",
      "improvement",
    ]);
  });

  it("maps every type to a non-empty Linear label id", () => {
    for (const id of Object.values(LABEL_MAP)) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });
});

describe("PRIORITY_MAP", () => {
  it("maps opchain priority 0-4 to Linear priority", () => {
    expect(PRIORITY_MAP[0]).toBe(0);
    expect(PRIORITY_MAP[1]).toBe(4);
    expect(PRIORITY_MAP[2]).toBe(3);
    expect(PRIORITY_MAP[3]).toBe(2);
    expect(PRIORITY_MAP[4]).toBe(1);
  });
});

describe("corsHeaders", () => {
  it("sets the origin when it matches the allow list", () => {
    const headers = corsHeaders("https://opchain.dev");
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://opchain.dev");
    expect(headers["Access-Control-Allow-Methods"]).toBe("POST, GET, OPTIONS");
    expect(headers["Access-Control-Allow-Headers"]).toBe("Content-Type, X-Opchain-Request-Id");
  });

  it("omits the origin header when the request origin is not allowed", () => {
    const headers = corsHeaders("https://evil.example.com");
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    // Still sets the rest so preflight replies are well-formed.
    expect(headers["Access-Control-Allow-Methods"]).toBe("POST, GET, OPTIONS");
  });

  it("handles a missing origin header gracefully", () => {
    const headers = corsHeaders(null);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("allows localhost for development", () => {
    expect(corsHeaders("http://localhost:8787")["Access-Control-Allow-Origin"]).toBe(
      "http://localhost:8787",
    );
    expect(corsHeaders("http://localhost:3000")["Access-Control-Allow-Origin"]).toBe(
      "http://localhost:3000",
    );
  });
});
