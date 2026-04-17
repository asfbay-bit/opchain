import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
} from "../src/opchain-try.js";

const SECRET = "test-secret-do-not-use-in-prod";

describe("session token HMAC", () => {
  it("round-trips a signed email", async () => {
    const token = await createSessionToken("alice@example.com", SECRET);
    const parts = token.split(":");
    expect(parts.length).toBeGreaterThanOrEqual(3);
    const email = await verifySessionToken(token, SECRET);
    expect(email).toBe("alice@example.com");
  });

  it("returns null for tokens signed with a different secret", async () => {
    const token = await createSessionToken("alice@example.com", SECRET);
    const email = await verifySessionToken(token, "different-secret");
    expect(email).toBeNull();
  });

  it("returns null when the payload is tampered with", async () => {
    const token = await createSessionToken("alice@example.com", SECRET);
    const tampered = token.replace("alice", "eve");
    const email = await verifySessionToken(tampered, SECRET);
    expect(email).toBeNull();
  });

  it("returns null when the signature is tampered with", async () => {
    const token = await createSessionToken("alice@example.com", SECRET);
    // Flip the final character of the HMAC.
    const flipped = token.slice(0, -1) + (token.slice(-1) === "A" ? "B" : "A");
    const email = await verifySessionToken(flipped, SECRET);
    expect(email).toBeNull();
  });

  it("returns null for malformed input", async () => {
    expect(await verifySessionToken(undefined, SECRET)).toBeNull();
    expect(await verifySessionToken("", SECRET)).toBeNull();
    expect(await verifySessionToken("no-colons", SECRET)).toBeNull();
    expect(await verifySessionToken("one:two", SECRET)).toBeNull();
  });

  it("issues distinct tokens per call (uuid salt)", async () => {
    const a = await createSessionToken("alice@example.com", SECRET);
    const b = await createSessionToken("alice@example.com", SECRET);
    expect(a).not.toBe(b);
  });

  it("handles emails that contain a colon", async () => {
    // The token format is `uuid:email:hmac`. The email is joined back from
    // `parts.slice(1, -1)` in verify, so embedded colons must round-trip.
    const weird = "alice:weird@example.com";
    const token = await createSessionToken(weird, SECRET);
    expect(await verifySessionToken(token, SECRET)).toBe(weird);
  });
});
