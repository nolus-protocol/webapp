import { describe, expect, it } from "vitest";
import { parseHostResolver } from "./resolver.js";

describe("parseHostResolver", () => {
  it("returns no overrides for an undefined value", () => {
    const result = parseHostResolver(undefined);
    expect(result.overrides.size).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("parses a single host=target pair", () => {
    const result = parseHostResolver("example.com=198.51.100.7");
    expect(result.errors).toEqual([]);
    expect(result.overrides.get("example.com")).toBe("198.51.100.7");
  });

  it("parses multiple comma-separated pairs", () => {
    const result = parseHostResolver("a.example=198.51.100.1,b.example=b.internal");
    expect(result.errors).toEqual([]);
    expect(result.overrides.size).toBe(2);
    expect(result.overrides.get("b.example")).toBe("b.internal");
  });

  it("flags a pair missing the '=' separator without echoing its content", () => {
    const result = parseHostResolver("nodelimiter");
    expect(result.overrides.size).toBe(0);
    expect(result.errors).toEqual([`pair 1 is missing "=" (expected host=target)`]);
  });

  it("flags an empty target", () => {
    const result = parseHostResolver("example.com=");
    expect(result.overrides.size).toBe(0);
    expect(result.errors).toEqual(["pair 1 has an empty target"]);
  });

  it("flags an empty host", () => {
    const result = parseHostResolver("=198.51.100.7");
    expect(result.overrides.size).toBe(0);
    expect(result.errors).toEqual(["pair 1 has an empty host"]);
  });
});
