import { describe, expect, it } from "vitest";
import { matchesFigure, normalizeFigure } from "./figureText.js";

describe("normalizeFigure", () => {
  it("drops whitespace, dollar sign and thousands commas", () => {
    expect(normalizeFigure("$ 1,234.56")).toBe("1234.56");
    expect(normalizeFigure("500.001 NLS")).toBe("500.001NLS");
  });
});

describe("matchesFigure", () => {
  it("accepts exact normalized equality", () => {
    expect(matchesFigure("1234.56", "1234.56")).toBe(true);
  });
  it("accepts a trailing unit ticker after the exact number", () => {
    expect(matchesFigure("500.001NLS", "500.001")).toBe(true);
  });
  it("rejects a longer number sharing the prefix", () => {
    expect(matchesFigure("500.0011", "500.001")).toBe(false);
    expect(matchesFigure("5000", "500")).toBe(false);
  });
  it("rejects a different value", () => {
    expect(matchesFigure("499.999NLS", "500.001")).toBe(false);
  });
});
