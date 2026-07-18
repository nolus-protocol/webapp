import { describe, it, expect } from "vitest";
import { checkMatrix, hasAssertionForLabel } from "./check.js";
import type { CoverageMatrix } from "./check.js";

const AXES = { routes: ["/x"], components: ["c"], states: ["populated"] };

function matrixWith(mapping: CoverageMatrix["cells"][number]["mapping"]): CoverageMatrix {
  return { ...AXES, cells: [{ route: "/x", component: "c", state: "populated", mapping }] };
}

const specWithAssertion = `test("does-a-thing", async () => { await expect(x).toBe(1); });`;
const gotoOnlySpec = `test("does-a-thing", async () => { await page.goto("/x"); });`;

describe("hasAssertionForLabel", () => {
  it("true when the enclosing test block asserts", () => {
    expect(hasAssertionForLabel(specWithAssertion, "does-a-thing")).toBe(true);
  });
  it("false for a goto-only test (no assertion in block)", () => {
    expect(hasAssertionForLabel(gotoOnlySpec, "does-a-thing")).toBe(false);
  });
  it("null when the label is absent", () => {
    expect(hasAssertionForLabel(specWithAssertion, "missing")).toBeNull();
  });
  it("counts an expect*-named assertion helper", () => {
    const helperSpec = `test("ws-case", async () => { await expectInteractive(page, "/x"); });`;
    expect(hasAssertionForLabel(helperSpec, "ws-case")).toBe(true);
  });
  it("ignores a docblock mention with no test block, using the real test occurrence", () => {
    const withDocblock = `/* labels: my-cell */\ntest("my-cell", async () => { expect(z).toBe(3); });`;
    expect(hasAssertionForLabel(withDocblock, "my-cell")).toBe(true);
  });
  it("scopes to the label's own test block, not a neighbor's assertion", () => {
    const twoTests = `test("first", async () => { await page.goto("/x"); });\ntest("second", async () => { expect(y).toBe(2); });`;
    expect(hasAssertionForLabel(twoTests, "first")).toBe(false);
  });

  it("does not attribute a label between two tests to the preceding asserting block", () => {
    const between = [
      `test("first", async () => { expect(a).toBe(1); });`,
      "// helper for stray-label",
      `test("second", async () => { await page.goto("/x"); });`
    ].join("\n");
    expect(hasAssertionForLabel(between, "stray-label")).toBe(false);
  });

  it("does not attribute a label in a trailing comment after the last test", () => {
    const trailing = `test("only", async () => { expect(a).toBe(1); });\n// tail-label lives here`;
    expect(hasAssertionForLabel(trailing, "tail-label")).toBe(false);
  });

  it("ignores a 'test(' occurrence inside a string when delimiting the block", () => {
    const embedded = `test("s-cell", async () => { const note = "calls test( internally"; await expect(x).toBe(1); });`;
    expect(hasAssertionForLabel(embedded, "s-cell")).toBe(true);
  });

  it("does not anchor a block at a regex '.test(' method call", () => {
    const spec = [
      "const ok = /^x$/.test(value);",
      "// mid-label sits here, outside any test block",
      'test("real", async () => { expect(a).toBe(1); });'
    ].join("\n");
    expect(hasAssertionForLabel(spec, "mid-label")).toBe(false);
  });

  it("keeps the boundary despite unbalanced parens in strings, templates, and regexes", () => {
    const tricky = [
      'test("tricky (case", async () => {',
      '  const s = "oops )(";',
      "  const t = `v ${JSON.stringify({ a: 1 })} )`;",
      "  const r = /confirm|submit|\\)/i;",
      "  await expect(x).toBe(1);",
      "});"
    ].join("\n");
    expect(hasAssertionForLabel(tricky, "tricky (case")).toBe(true);
  });
});

describe("checkMatrix", () => {
  const read = (): string => specWithAssertion;

  it("passes a valid assertion cell", () => {
    const result = checkMatrix(matrixWith({ type: "assertion", spec: "a.spec.ts", label: "does-a-thing" }), read);
    expect(result.ok).toBe(true);
    expect(result.mappedCells).toBe(1);
  });

  it("fails a goto-only mapping (the mutation the issue asks for)", () => {
    const result = checkMatrix(
      matrixWith({ type: "assertion", spec: "a.spec.ts", label: "does-a-thing" }),
      () => gotoOnlySpec
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/no assertion/);
  });

  it("fails a missing label", () => {
    const result = checkMatrix(matrixWith({ type: "assertion", spec: "a.spec.ts", label: "nope" }), read);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/not found/);
  });

  it("fails a missing spec file", () => {
    const result = checkMatrix(matrixWith({ type: "assertion", spec: "gone.spec.ts", label: "does-a-thing" }), () => {
      throw new Error("ENOENT");
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/not found/);
  });

  it("counts a valid gap and rejects an empty-reason gap", () => {
    const ok = checkMatrix(matrixWith({ type: "gap", category: "funded-gated", reason: "needs funds" }), read);
    expect(ok.ok).toBe(true);
    expect(ok.gapCells["funded-gated"]).toBe(1);
    const bad = checkMatrix(matrixWith({ type: "gap", category: "funded-gated", reason: "  " }), read);
    expect(bad.ok).toBe(false);
  });

  it("rejects a duplicate cell and an off-axis cell", () => {
    const dup: CoverageMatrix = {
      ...AXES,
      cells: [
        {
          route: "/x",
          component: "c",
          state: "populated",
          mapping: { type: "gap", category: "transient-state", reason: "r" }
        },
        {
          route: "/x",
          component: "c",
          state: "populated",
          mapping: { type: "gap", category: "transient-state", reason: "r" }
        }
      ]
    };
    expect(checkMatrix(dup, read).errors.join(" ")).toMatch(/duplicate/);
    const offAxis = {
      ...AXES,
      cells: [
        {
          route: "/zzz",
          component: "c",
          state: "populated",
          mapping: { type: "gap", category: "transient-state", reason: "r" } as const
        }
      ]
    };
    expect(checkMatrix(offAxis, read).errors.join(" ")).toMatch(/route not in axes/);
  });
});
