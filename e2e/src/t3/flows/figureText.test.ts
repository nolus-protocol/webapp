import { describe, expect, it } from "vitest";
import { figuresEqual, normalizeFigure } from "./figureText.js";

describe("normalizeFigure", () => {
  it("drops whitespace, dollar sign and thousands commas", () => {
    expect(normalizeFigure("$ 1,234.56")).toBe("1234.56");
    expect(normalizeFigure("500.001 NLS")).toBe("500.001NLS");
  });
});

describe("figuresEqual", () => {
  it("matches an aria-label figure against the oracle string across formatting noise", () => {
    expect(figuresEqual("$1,234.56", "1234.56")).toBe(true);
    expect(figuresEqual("0.05", "$0.05")).toBe(true);
    expect(figuresEqual("0.05", "0.06")).toBe(false);
  });
});
