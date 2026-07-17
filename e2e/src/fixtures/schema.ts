/**
 * Ajv (draft 2020-12) validator over the generated `fixtures/schemas/*.json`. A fixture
 * that drifts from the app's Zod contract fails here, so a stale fixture is a red build,
 * never a silent wrong-value pass. The generated schemas restore the numericString
 * `pattern` the raw Zod->JSON-Schema emit drops, so an empty/non-numeric money string is
 * rejected — the exact class the app's runtime Zod guard exists to catch.
 */

import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import { readSchema } from "./loader.js";
import type { SchemaName } from "./registry.js";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validators = new Map<string, ValidateFunction>();

function validatorFor(name: SchemaName): ValidateFunction {
  const cached = validators.get(name);
  if (cached) {
    return cached;
  }
  const compiled = ajv.compile(readSchema(name));
  validators.set(name, compiled);
  return compiled;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function collectErrors(validate: ValidateFunction): string[] {
  return (validate.errors ?? []).map((err) => `${err.instancePath || "/"} ${err.message ?? "invalid"}`.trim());
}

/** Validate a whole-body object against its schema. */
export function validateBody(name: SchemaName, data: unknown): ValidationResult {
  const validate = validatorFor(name);
  const valid = validate(data);
  return { valid, errors: valid ? [] : collectErrors(validate) };
}

/** Validate every element of a bare-array body against a per-item schema. */
export function validateArrayBody(name: SchemaName, data: unknown): ValidationResult {
  if (!Array.isArray(data)) {
    return { valid: false, errors: ["expected a JSON array body"] };
  }
  const validate = validatorFor(name);
  const errors: string[] = [];
  data.forEach((item, index) => {
    if (!validate(item)) {
      errors.push(...collectErrors(validate).map((message) => `[${index}] ${message}`));
    }
  });
  return { valid: errors.length === 0, errors };
}
