export type RunStatus = "passed" | "failed" | "skipped";

export interface RunAnnotation {
  type: string;
  description: string;
}

/**
 * One test outcome flattened out of a Playwright JSON report, narrowed to just the fields the
 * reporting tier consumes. `title` is the spec title; `annotations` merges the test-level and
 * every result-level annotation (runtime `testInfo.annotations.push` lands on the result), so a
 * t3-flow skip/leftover annotation is visible wherever Playwright recorded it. `errorText` joins
 * every result error message for classification and suite-suspect matching.
 */
export interface RunTest {
  tier: string;
  projectName: string;
  title: string;
  file: string;
  status: RunStatus;
  annotations: RunAnnotation[];
  errorText: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function annotationsOf(value: unknown): RunAnnotation[] {
  return asArray(value)
    .filter(isRecord)
    .map((entry) => ({ type: asString(entry.type), description: asString(entry.description) }))
    .filter((entry) => entry.type.length > 0 || entry.description.length > 0);
}

function statusFrom(raw: string): RunStatus {
  if (raw === "skipped") {
    return "skipped";
  }
  return raw === "unexpected" ? "failed" : "passed";
}

function resultsText(results: unknown[]): string {
  const messages: string[] = [];
  for (const result of results) {
    if (!isRecord(result)) {
      continue;
    }
    if (isRecord(result.error)) {
      messages.push(asString(result.error.message));
    }
    for (const error of asArray(result.errors)) {
      if (isRecord(error)) {
        messages.push(asString(error.message));
      }
    }
  }
  return messages.filter((message) => message.length > 0).join("\n");
}

function resultsAnnotations(results: unknown[]): RunAnnotation[] {
  return results.flatMap((result) => (isRecord(result) ? annotationsOf(result.annotations) : []));
}

function testsOf(spec: Record<string, unknown>, file: string, tier: string): RunTest[] {
  const title = asString(spec.title);
  return asArray(spec.tests)
    .filter(isRecord)
    .map((test) => {
      const results = asArray(test.results);
      return {
        tier,
        projectName: asString(test.projectName),
        title,
        file,
        status: statusFrom(asString(test.status)),
        annotations: [...annotationsOf(test.annotations), ...resultsAnnotations(results)],
        errorText: resultsText(results)
      };
    });
}

function walkSuite(suite: unknown, tier: string, parentFile: string): RunTest[] {
  if (!isRecord(suite)) {
    return [];
  }
  const file = asString(suite.file) || parentFile;
  const specTests = asArray(suite.specs)
    .filter(isRecord)
    .flatMap((spec) => testsOf(spec, asString(spec.file) || file, tier));
  const childTests = asArray(suite.suites).flatMap((child) => walkSuite(child, tier, file));
  return [...specTests, ...childTests];
}

/** Flatten a parsed Playwright JSON report into the per-test rows the reporting tier classifies. */
export function extractRunTests(report: unknown, tier: string): RunTest[] {
  if (!isRecord(report)) {
    return [];
  }
  return asArray(report.suites).flatMap((suite) => walkSuite(suite, tier, ""));
}
