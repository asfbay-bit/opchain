import { describe, expect, it } from "vitest";
import worker, {
  generateNonce,
  buildCspHtml,
  NONCE_PLACEHOLDER,
} from "../src/index.js";

function makeEnv(htmlBody) {
  return {
    LINEAR_API_KEY: "test",
    ASSETS: {
      async fetch() {
        return new Response(htmlBody, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    },
  };
}

describe("CSP nonce — generator", () => {
  it("returns a base64url string of at least 22 chars (16 bytes)", () => {
    const n = generateNonce();
    expect(n).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(n.length).toBeGreaterThanOrEqual(22);
  });

  it("returns a different value on each call", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });
});

describe("CSP nonce — header builder", () => {
  it("embeds the nonce in script-src and uses strict-dynamic", () => {
    const csp = buildCspHtml("test-nonce-xyz");
    expect(csp).toMatch(/script-src [^;]*'nonce-test-nonce-xyz'/);
    expect(csp).toMatch(/script-src [^;]*'strict-dynamic'/);
    expect(csp).not.toMatch(/script-src [^;]*'unsafe-inline'/);
  });
});

describe("CSP nonce — body substitution", () => {
  it("replaces every placeholder occurrence with the nonce in the CSP header", async () => {
    const html =
      `<!doctype html><html><head>` +
      `<script nonce="${NONCE_PLACEHOLDER}">a</script>` +
      `<script nonce="${NONCE_PLACEHOLDER}" type="module" src="/x.js"></script>` +
      `</head><body></body></html>`;
    const res = await worker.fetch(new Request("https://opchain.dev/"), makeEnv(html));
    const csp = res.headers.get("Content-Security-Policy");
    const m = csp.match(/'nonce-([A-Za-z0-9_-]+)'/);
    expect(m).not.toBeNull();
    const nonce = m[1];

    const body = await res.text();
    expect(body).not.toContain(NONCE_PLACEHOLDER);
    // Both inline + external script tags carry the same nonce as the header.
    const matches = [...body.matchAll(/nonce="([^"]+)"/g)].map((x) => x[1]);
    expect(matches.length).toBe(2);
    for (const stamped of matches) expect(stamped).toBe(nonce);
  });

  it("strips Content-Length so the platform recomputes it after substitution", async () => {
    const html =
      `<!doctype html><html><head><script nonce="${NONCE_PLACEHOLDER}">x</script></head><body></body></html>`;
    const env = makeEnv(html);
    // Pre-set a stale Content-Length on the asset response to prove we drop it.
    env.ASSETS.fetch = async () =>
      new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html",
          "Content-Length": String(html.length),
        },
      });
    const res = await worker.fetch(new Request("https://opchain.dev/"), env);
    expect(res.headers.get("Content-Length")).toBeNull();
  });
});
