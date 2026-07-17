import { describe, expect, it } from "vitest";
import { extractRunTests } from "./playwright.js";

describe("extractRunTests", () => {
  it("flattens nested suites and merges test- and result-level annotations", () => {
    const report = {
      suites: [
        {
          file: "src/t3/flows/lease.spec.ts",
          specs: [],
          suites: [
            {
              specs: [
                {
                  title: "lease opens",
                  file: "src/t3/flows/lease.spec.ts",
                  tests: [
                    {
                      projectName: "t3-flows",
                      status: "skipped",
                      annotations: [{ type: "t3-flow-skip", description: "environment: node-unavailable" }],
                      results: [
                        {
                          status: "skipped",
                          error: undefined,
                          errors: [],
                          annotations: [{ type: "t3-flow-leftover", description: "terminal=app-failure" }]
                        }
                      ]
                    }
                  ]
                }
              ],
              suites: []
            }
          ]
        }
      ]
    };
    const tests = extractRunTests(report, "t3-flows");
    expect(tests).toHaveLength(1);
    const test = tests[0];
    expect(test?.tier).toBe("t3-flows");
    expect(test?.status).toBe("skipped");
    expect(test?.title).toBe("lease opens");
    expect(test?.annotations.map((a) => a.type)).toEqual(["t3-flow-skip", "t3-flow-leftover"]);
  });

  it("joins result error messages and maps an unexpected status to failed", () => {
    const report = {
      suites: [
        {
          specs: [
            {
              title: "swap routes",
              file: "src/t3/flows/swap.spec.ts",
              tests: [
                {
                  projectName: "t3-flows",
                  status: "unexpected",
                  annotations: [],
                  results: [
                    { status: "failed", error: { message: "boom" }, errors: [{ message: "boom" }], annotations: [] }
                  ]
                }
              ]
            }
          ],
          suites: []
        }
      ]
    };
    const tests = extractRunTests(report, "t3-flows");
    expect(tests[0]?.status).toBe("failed");
    expect(tests[0]?.errorText).toContain("boom");
  });

  it("returns nothing for a non-object or shapeless report", () => {
    expect(extractRunTests(null, "t1")).toEqual([]);
    expect(extractRunTests({}, "t1")).toEqual([]);
  });
});
