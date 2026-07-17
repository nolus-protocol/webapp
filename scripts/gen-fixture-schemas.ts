/**
 * Generate JSON Schema files for the e2e fixture validator from the app's own Zod
 * response schemas, so a committed fixture cannot silently drift from the contract the
 * app validates against at runtime.
 *
 * Emitter: Zod 4's native `z.toJSONSchema()`. The third-party `zod-to-json-schema`
 * package emits an empty schema against Zod 4 and must not be used.
 *
 * numericString restoration: `z.toJSONSchema()` drops the `.refine()` on the shared
 * `numericString` (the money-field contract) and emits a bare `{"type":"string"}`.
 * Every field defined as numericString is re-annotated with a numeric `pattern` +
 * `minLength`. The fields are derived programmatically — a behavioural probe of each
 * emitted string schema — never a hand-maintained list, so a new numericString field
 * added upstream is covered automatically.
 *
 * Residual gap (documented): the pattern `^-?(\d+\.?\d*|\.\d+)$` is a structural
 * approximation of the runtime `isFinite(Number(s))` predicate. It rejects scientific
 * notation (`1e5`) the runtime predicate would accept, and accepts arbitrarily long
 * digit strings that overflow a double. Fixtures never use those forms, so the pattern
 * is a strictly tighter gate for the shapes fixtures actually carry.
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import * as schemas from "../src/common/api/schemas/index.ts";

const NUMERIC_STRING_JSON = {
  type: "string",
  pattern: "^-?(\\d+\\.?\\d*|\\.\\d+)$",
  minLength: 1
} as const;

/**
 * True when a Zod schema is the shared `numericString`: a string that rejects the empty
 * string and a non-numeric string but accepts a numeric one. numericString is the only
 * refined string in the response schemas, so this behavioural signature is unique — and
 * it survives `.nullish()`/`.optional()` cloning that breaks reference equality.
 */
function isNumericString(schema: unknown): boolean {
  const candidate = schema as z.ZodType;
  const def = (candidate as unknown as { _zod?: { def?: { type?: string } } })._zod?.def;
  if (def?.type !== "string") {
    return false;
  }
  const rejectsEmpty = !candidate.safeParse("").success;
  const acceptsNumeric = candidate.safeParse("1.23").success;
  const rejectsWord = !candidate.safeParse("abc").success;
  return rejectsEmpty && acceptsNumeric && rejectsWord;
}

function toJsonSchema(schema: z.ZodType): unknown {
  return z.toJSONSchema(schema, {
    override: (ctx: { zodSchema: unknown; jsonSchema: Record<string, unknown> }) => {
      if (isNumericString(ctx.zodSchema)) {
        Object.assign(ctx.jsonSchema, NUMERIC_STRING_JSON);
      }
    }
  });
}

function isZodSchema(value: unknown): value is z.ZodType {
  return typeof value === "object" && value !== null && "safeParse" in value && "_zod" in value;
}

/** `PricesResponseSchema` -> `prices-response`. */
function toFileSlug(exportName: string): string {
  return exportName
    .replace(/Schema$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "fixtures", "schemas");

  mkdirSync(outDir, { recursive: true });
  for (const existing of readdirSync(outDir)) {
    if (existing.endsWith(".json")) {
      rmSync(join(outDir, existing));
    }
  }

  const entries: [string, z.ZodType][] = [];
  for (const [name, value] of Object.entries(schemas)) {
    if (isZodSchema(value)) {
      entries.push([name, value]);
    }
  }
  entries.sort((a, b) => a[0].localeCompare(b[0]));

  if (entries.length === 0) {
    throw new Error("no Zod schemas exported from src/common/api/schemas — nothing to generate");
  }

  const index: string[] = [];
  for (const [name, schema] of entries) {
    const slug = toFileSlug(name);
    const json = toJsonSchema(schema);
    writeFileSync(join(outDir, `${slug}.json`), `${JSON.stringify(json, null, 2)}\n`);
    index.push(slug);
  }

  process.stdout.write(`generated ${index.length} schema(s): ${index.join(", ")}\n`);
}

main();
