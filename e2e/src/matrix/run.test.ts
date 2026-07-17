import { describe, it, expect } from "vitest";
import { runMatrixCheck, loadMatrix } from "./run.js";

// Integration guard: the committed coverage-matrix.json must resolve against the real spec
// files. This is the same check the CI guard runs; if a mapped assertion label is renamed
// or deleted, or a gap loses its reason, this reds — the "remove a cell's mapping and CI
// fails" behavior the issue asks for.
describe("committed coverage matrix", () => {
  it("every cell resolves to a real assertion or a categorized gap", () => {
    const result = runMatrixCheck();
    expect(result.ok, result.errors.join("\n")).toBe(true);
    expect(result.mappedCells).toBeGreaterThan(0);
  });

  it("declares all eight wallet-less routes", () => {
    const matrix = loadMatrix();
    for (const route of ["/", "/assets", "/earn", "/positions", "/stake", "/activities", "/vote", "/stats"]) {
      expect(matrix.routes).toContain(route);
    }
  });

  it("records gaps in every category the suite uses", () => {
    const { gapCells } = runMatrixCheck();
    expect(gapCells["funded-gated"]).toBeGreaterThan(0);
    expect(gapCells["visual-local-only"]).toBeGreaterThan(0);
    expect(gapCells["schemaless-unvalidated"]).toBeGreaterThan(0);
  });
});
