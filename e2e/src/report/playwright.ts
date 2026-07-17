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

/**
 * Canonical Playwright project → reporting tier. A single Playwright JSON file can carry tests from
 * more than one project — or the wrong tier's tests entirely, when a run's `PLAYWRIGHT_JSON_OUTPUT_NAME`
 * was not set and its json defaulted onto another tier's file — so a test's tier is derived from its
 * own project name, never from the file it was read out of. An unmapped project falls back to the
 * source-file tier the caller passed.
 */
const PROJECT_TIER: Record<string, string> = {
  fixture: "t1",
  "desktop-light": "t1",
  "desktop-dark": "t1",
  mobile: "t1",
  t2: "t2",
  ratelimit: "t2",
  receive: "t2",
  "t3-engine": "t3-engine",
  "t3-flows": "t3-flows",
  "visual-desktop-light": "visual",
  "visual-desktop-dark": "visual",
  "visual-mobile-light": "visual",
  "visual-mobile-dark": "visual"
};

export function tierForProject(projectName: string): string | undefined {
  return PROJECT_TIER[projectName];
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

function testsOf(spec: Record<string, unknown>, file: string, fallbackTier: string): RunTest[] {
  const title = asString(spec.title);
  return asArray(spec.tests)
    .filter(isRecord)
    .map((test) => {
      const results = asArray(test.results);
      const projectName = asString(test.projectName);
      return {
        tier: tierForProject(projectName) ?? fallbackTier,
        projectName,
        title,
        file,
        status: statusFrom(asString(test.status)),
        annotations: [...annotationsOf(test.annotations), ...resultsAnnotations(results)],
        errorText: resultsText(results)
      };
    });
}

function walkSuite(suite: unknown, fallbackTier: string, parentFile: string): RunTest[] {
  if (!isRecord(suite)) {
    return [];
  }
  const file = asString(suite.file) || parentFile;
  const specTests = asArray(suite.specs)
    .filter(isRecord)
    .flatMap((spec) => testsOf(spec, asString(spec.file) || file, fallbackTier));
  const childTests = asArray(suite.suites).flatMap((child) => walkSuite(child, fallbackTier, file));
  return [...specTests, ...childTests];
}

/**
 * Flatten a parsed Playwright JSON report into the per-test rows the reporting tier classifies.
 * `fallbackTier` is the tier of the source file; each test's own tier is resolved from its project
 * name first (see {@link tierForProject}) so a mis-filed project is still attributed correctly.
 */
export function extractRunTests(report: unknown, fallbackTier: string): RunTest[] {
  if (!isRecord(report)) {
    return [];
  }
  return asArray(report.suites).flatMap((suite) => walkSuite(suite, fallbackTier, ""));
}
