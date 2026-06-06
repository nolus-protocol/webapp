import { describe, it, expect } from "vitest";
import { isEnumValue } from "./typeGuards";

enum Sample {
  A = "a",
  B = "b"
}

describe("isEnumValue", () => {
  it("returns true for a value that is a member of the enum", () => {
    expect(isEnumValue(Sample, "a")).toBe(true);
    expect(isEnumValue(Sample, "b")).toBe(true);
  });

  it("returns false for a string that is not a member", () => {
    expect(isEnumValue(Sample, "c")).toBe(false);
  });

  it("returns false for an enum key rather than its value", () => {
    expect(isEnumValue(Sample, "A")).toBe(false);
  });

  it("returns false for non-string inputs (route param array, undefined, number)", () => {
    expect(isEnumValue(Sample, ["a"])).toBe(false);
    expect(isEnumValue(Sample, undefined)).toBe(false);
    expect(isEnumValue(Sample, 1)).toBe(false);
  });
});
