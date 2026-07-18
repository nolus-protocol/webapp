/**
 * Coverage-matrix guard (pure logic, unit-tested). Every routes x components x states cell
 * either maps to a named assertion in a spec file or is an explicit, categorized gap. The
 * guard PARSES the spec — for an assertion cell it requires the label AND a real assertion
 * (`expect(` / `toHaveScreenshot(`) inside the same test block, so a goto-only test with a
 * matching title cannot satisfy a cell. A cell whose mapping no longer resolves fails CI.
 */

export type GapCategory = "funded-gated" | "schemaless-unvalidated" | "visual-local-only" | "transient-state";

export type CellMapping =
  { type: "assertion"; spec: string; label: string } | { type: "gap"; category: GapCategory; reason: string };

export interface Cell {
  route: string;
  component: string;
  state: string;
  mapping: CellMapping;
}

export interface CoverageMatrix {
  routes: string[];
  components: string[];
  states: string[];
  cells: Cell[];
}

export interface CheckResult {
  ok: boolean;
  errors: string[];
  mappedCells: number;
  gapCells: Record<GapCategory, number>;
}

const GAP_CATEGORIES: GapCategory[] = [
  "funded-gated",
  "schemaless-unvalidated",
  "visual-local-only",
  "transient-state"
];
// A real assertion is an `expect(...)` or an `expect*`-named assertion helper (e.g.
// `expectWhiteScreen(`, `expectInteractive(`), or a screenshot assertion. A goto-only test
// has none of these, so it still cannot satisfy a cell.
const ASSERTION = /\bexpect[A-Za-z]*\(|toHaveScreenshot\(/;

// A `/` in code position starts a regex literal (not division) when the last significant
// character is an operator/opener/separator or there is none. Keyword-preceded regexes
// (`return /x/`) end in a letter and are misread as division — acceptable: misreading a
// regex as division only risks treating `/.../` content as code, and test-relevant slash
// content (paren/brace imbalance inside a regex) is rarer still than keyword-led regexes.
// prettier-ignore
const REGEX_PRECEDERS = new Set([
  "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "~", "^", "<", ">"
]);

type CodeMode = { kind: "code"; braces: number; fromInterp: boolean };
type LexMode =
  | CodeMode
  | { kind: "single" }
  | { kind: "double" }
  | { kind: "template" }
  | { kind: "line" }
  | { kind: "block" }
  | { kind: "regex"; inClass: boolean };

interface LexState {
  modes: LexMode[];
  depth: number;
  last: string;
  skip: number;
}

/** Push a string/comment/regex-literal mode when `ch` opens one in code position. */
function lexOpenLiteral(state: LexState, ch: string, next: string | undefined): void {
  if (ch === "'") {
    state.modes.push({ kind: "single" });
  } else if (ch === '"') {
    state.modes.push({ kind: "double" });
  } else if (ch === "`") {
    state.modes.push({ kind: "template" });
  } else if (ch === "/" && (next === "/" || next === "*")) {
    state.modes.push({ kind: next === "/" ? "line" : "block" });
    state.skip = 1;
  } else if (ch === "/" && (state.last === "" || REGEX_PRECEDERS.has(state.last))) {
    state.modes.push({ kind: "regex", inClass: false });
  }
}

/** Advance one code-position character; true when the tracked call just closed. */
function lexCode(state: LexState, mode: CodeMode, ch: string, next: string | undefined): boolean {
  if (ch === "(") {
    state.depth += 1;
  } else if (ch === ")") {
    state.depth -= 1;
    if (state.depth === 0) {
      return true;
    }
  } else if (ch === "{") {
    mode.braces += 1;
  } else if (ch === "}" && mode.braces > 0) {
    mode.braces -= 1;
  } else if (ch === "}" && mode.fromInterp) {
    state.modes.pop();
  } else {
    lexOpenLiteral(state, ch, next);
  }
  if (!/\s/.test(ch)) {
    state.last = ch;
  }
  return false;
}

const QUOTE_CLOSERS = { single: "'", double: '"', template: "`" } as const;

/** Advance one character inside a quoted string, template literal, comment, or regex. */
function lexLiteral(state: LexState, mode: Exclude<LexMode, CodeMode>, ch: string, next: string | undefined): void {
  if (mode.kind === "line" || mode.kind === "block") {
    lexComment(state, mode.kind, ch, next);
    return;
  }
  if (ch === "\\") {
    state.skip = 1;
    return;
  }
  if (mode.kind === "regex") {
    lexRegex(state, mode, ch);
  } else if (ch === QUOTE_CLOSERS[mode.kind]) {
    state.modes.pop();
  } else if (mode.kind === "template" && ch === "$" && next === "{") {
    state.modes.push({ kind: "code", braces: 0, fromInterp: true });
    state.skip = 1;
  }
}

function lexComment(state: LexState, kind: "line" | "block", ch: string, next: string | undefined): void {
  if (kind === "line" && ch === "\n") {
    state.modes.pop();
  } else if (kind === "block" && ch === "*" && next === "/") {
    state.modes.pop();
    state.skip = 1;
  }
}

function lexRegex(state: LexState, mode: { inClass: boolean }, ch: string): void {
  if (ch === "[") {
    mode.inClass = true;
  } else if (ch === "]") {
    mode.inClass = false;
  } else if (ch === "/" && !mode.inClass) {
    state.modes.pop();
  }
}

/**
 * The index just past the closing parenthesis of the call starting at `callStart` (the
 * index of a `"test("` occurrence), lexing over strings, template literals (with nested
 * interpolations), comments, and regex literals so a parenthesis inside any of those never
 * shifts the boundary. Returns `source.length` when the call never closes (malformed
 * source — the generous fallback keeps a truncated file from hiding its own labels).
 */
export function testCallEnd(source: string, callStart: number): number {
  const open = source.indexOf("(", callStart);
  if (open < 0) {
    return source.length;
  }
  const state: LexState = { modes: [{ kind: "code", braces: 0, fromInterp: false }], depth: 0, last: "", skip: 0 };
  for (let i = open; i < source.length; i++) {
    if (state.skip > 0) {
      state.skip -= 1;
      continue;
    }
    const mode = state.modes[state.modes.length - 1];
    if (mode === undefined) {
      break;
    }
    const ch = source[i] as string;
    const next = source[i + 1];
    if (mode.kind === "code") {
      if (lexCode(state, mode, ch, next)) {
        return i + 1;
      }
    } else {
      lexLiteral(state, mode, ch, next);
    }
  }
  return source.length;
}

/**
 * Does a test block enclosing an occurrence of `label` contain a real assertion? Scans
 * every occurrence (labels are also listed in docblocks, which are not tests) and requires
 * the occurrence to sit INSIDE a `test(...)` call's real span (lexed via `testCallEnd`, so
 * a label in a comment or helper BETWEEN two tests is attributed to neither). Returns null
 * when the label appears nowhere, false when no occurrence sits in an asserting block.
 */
/**
 * The nearest `test(` CALL opener at or before `from` — skipping occurrences that are
 * member or suffixed calls (`/x/.test(v)`, `subtest(`), which anchored phantom "blocks"
 * under the old text-position scan. Returns -1 when none precedes `from`.
 */
function precedingTestCall(source: string, from: number): number {
  let at = source.lastIndexOf("test(", from);
  while (at > 0 && /[\w$.]/.test(source[at - 1] as string)) {
    at = source.lastIndexOf("test(", at - 1);
  }
  return at;
}

export function hasAssertionForLabel(source: string, label: string): boolean | null {
  let idx = source.indexOf(label);
  if (idx < 0) {
    return null;
  }
  while (idx >= 0) {
    const before = precedingTestCall(source, idx);
    if (before >= 0) {
      const end = testCallEnd(source, before);
      if (end > idx && ASSERTION.test(source.slice(before, end))) {
        return true;
      }
    }
    idx = source.indexOf(label, idx + label.length);
  }
  return false;
}

function cellKey(cell: Cell): string {
  return `${cell.route} | ${cell.component} | ${cell.state}`;
}

function checkAssertionCell(cell: Cell, spec: string, label: string, readSpec: (rel: string) => string): string | null {
  let source: string;
  try {
    source = readSpec(spec);
  } catch {
    return `${cellKey(cell)}: spec file not found: ${spec}`;
  }
  const found = hasAssertionForLabel(source, label);
  if (found === null) {
    return `${cellKey(cell)}: label "${label}" not found in ${spec}`;
  }
  if (!found) {
    return `${cellKey(cell)}: label "${label}" in ${spec} has no assertion in its test block (goto-only?)`;
  }
  return null;
}

function checkAxes(cell: Cell, matrix: CoverageMatrix): string | null {
  if (!matrix.routes.includes(cell.route)) return `${cellKey(cell)}: route not in axes`;
  if (!matrix.components.includes(cell.component)) return `${cellKey(cell)}: component not in axes`;
  if (!matrix.states.includes(cell.state)) return `${cellKey(cell)}: state not in axes`;
  return null;
}

export function checkMatrix(matrix: CoverageMatrix, readSpec: (rel: string) => string): CheckResult {
  const errors: string[] = [];
  const gapCells: Record<GapCategory, number> = {
    "funded-gated": 0,
    "schemaless-unvalidated": 0,
    "visual-local-only": 0,
    "transient-state": 0
  };
  let mappedCells = 0;

  const seen = new Set<string>();
  for (const cell of matrix.cells) {
    const key = cellKey(cell);
    if (seen.has(key)) {
      errors.push(`${key}: duplicate cell`);
    }
    seen.add(key);

    const axisError = checkAxes(cell, matrix);
    if (axisError) {
      errors.push(axisError);
    }

    if (cell.mapping.type === "assertion") {
      const error = checkAssertionCell(cell, cell.mapping.spec, cell.mapping.label, readSpec);
      if (error) {
        errors.push(error);
      } else {
        mappedCells += 1;
      }
    } else if (!GAP_CATEGORIES.includes(cell.mapping.category)) {
      errors.push(`${key}: unknown gap category "${cell.mapping.category}"`);
    } else if (cell.mapping.reason.trim() === "") {
      errors.push(`${key}: gap requires a non-empty reason`);
    } else {
      gapCells[cell.mapping.category] += 1;
    }
  }

  return { ok: errors.length === 0, errors, mappedCells, gapCells };
}
