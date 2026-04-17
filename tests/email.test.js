import { describe, expect, it } from "vitest";
import { isValidEmail } from "../src/opchain-try.js";

describe("isValidEmail", () => {
  it("accepts common addresses", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("user.name+tag@example.com")).toBe(true);
    expect(isValidEmail("x@y.z")).toBe(true);
  });

  it("rejects missing parts", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("no-at-sign")).toBe(false);
    expect(isValidEmail("missing@tld")).toBe(false);
    expect(isValidEmail("@no-local.com")).toBe(false);
    expect(isValidEmail("no-local@.com")).toBe(false);
  });

  it("rejects whitespace", () => {
    expect(isValidEmail("a b@c.co")).toBe(false);
    expect(isValidEmail(" a@b.co")).toBe(false);
    expect(isValidEmail("a@b.co ")).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(42)).toBe(false);
    expect(isValidEmail({})).toBe(false);
  });
});
