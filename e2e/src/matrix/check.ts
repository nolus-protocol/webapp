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

/**
 * Does a test block enclosing an occurrence of `label` contain a real assertion? Scans
 * every occurrence (labels are also listed in docblocks, which are not tests), so a match
 * only counts when the label sits in a `test(...)` block that actually asserts. Returns null
 * when the label appears nowhere, false when it appears but no enclosing block asserts.
 */
export function hasAssertionForLabel(source: string, label: string): boolean | null {
  let idx = source.indexOf(label);
  if (idx < 0) {
    return null;
  }
  while (idx >= 0) {
    const before = source.lastIndexOf("test(", idx);
    if (before >= 0) {
      const after = source.indexOf("test(", idx + label.length);
      const end = after < 0 ? source.length : after;
      if (ASSERTION.test(source.slice(before, end))) {
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
