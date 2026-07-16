import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { assembleDocument, exitCodeFor, summarize, writeDocument } from "./report.js";
import type { CheckResult, T0Document } from "./types.js";

function check(id: string, status: CheckResult["status"]): CheckResult {
  return { id, title: id, status, durationMs: 1 };
}

function documentWith(checks: CheckResult[]): T0Document {
  return assembleDocument({
    startedAt: "2026-07-16T00:00:00.000Z",
    finishedAt: "2026-07-16T00:00:01.000Z",
    baseUrl: "https://app-dev.nolus.io",
    address: "nolus1abc",
    checks
  });
}

describe("summarize", () => {
  it("counts each status bucket", () => {
    expect(summarize([check("a", "pass"), check("b", "fail"), check("c", "skip"), check("d", "pass")])).toEqual({
      pass: 2,
      fail: 1,
      skip: 1
    });
  });
});

describe("assembleDocument", () => {
  it("wraps the checks with metadata and a summary", () => {
    const doc = documentWith([check("a", "pass"), check("b", "skip")]);
    expect(doc).toEqual({
      suite: "t0",
      startedAt: "2026-07-16T00:00:00.000Z",
      finishedAt: "2026-07-16T00:00:01.000Z",
      baseUrl: "https://app-dev.nolus.io",
      address: "nolus1abc",
      checks: [check("a", "pass"), check("b", "skip")],
      summary: { pass: 1, fail: 0, skip: 1 }
    });
  });
});

describe("exitCodeFor", () => {
  it("returns 1 when any check failed", () => {
    expect(exitCodeFor(documentWith([check("a", "pass"), check("b", "fail")]))).toBe(1);
  });

  it("returns 0 when every check passed", () => {
    expect(exitCodeFor(documentWith([check("a", "pass"), check("b", "pass")]))).toBe(0);
  });

  it("returns 0 when checks skip but none fail (a skip never fails the run)", () => {
    expect(exitCodeFor(documentWith([check("a", "pass"), check("b", "skip")]))).toBe(0);
  });
});

describe("writeDocument", () => {
  const dir = mkdtempSync(join(tmpdir(), "e2e-report-"));

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes t0.json and round-trips the document", () => {
    const doc = documentWith([check("a", "pass")]);
    const filePath = writeDocument(doc, dir);
    expect(filePath).toBe(join(dir, "t0.json"));
    const roundTripped = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    expect(roundTripped).toEqual(doc);
  });
});
