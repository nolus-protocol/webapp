import { describe, it, expect } from "vitest";
import { validateBody, validateArrayBody } from "./schema.js";
import { readFixture, loadAllFixtures } from "./loader.js";
import type { SchemaName } from "./registry.js";

interface BalancesFixture {
  balances: {
    key: string;
    symbol: string;
    denom: string;
    amount: string;
    amount_usd: string;
    decimal_digits: number;
  }[];
  total_value_usd: string;
}

function baseBalances(): BalancesFixture {
  return structuredClone(readFixture("wallet/balances.json") as BalancesFixture);
}

describe("fixture schema validation", () => {
  it("every schema-backed fixture parses against its generated schema", () => {
    for (const { route, body } of loadAllFixtures()) {
      if (route.schema) {
        const result = validateBody(route.schema, body);
        expect(result.valid, `${route.file} vs ${route.schema}: ${result.errors.join("; ")}`).toBe(true);
      }
      if (route.itemSchema) {
        const result = validateArrayBody(route.itemSchema, body);
        expect(result.valid, `${route.file} vs ${route.itemSchema}[]: ${result.errors.join("; ")}`).toBe(true);
      }
    }
  });

  // The Phase-1 gate: if the validator cannot reject a broken fixture, the seam is inert.
  describe("rejects deliberately-broken fixtures", () => {
    const schema: SchemaName = "balances-response";

    it("accepts the pristine fixture (control)", () => {
      expect(validateBody(schema, baseBalances()).valid).toBe(true);
    });

    it("rejects a wrong-typed money field (number where a numeric string is required)", () => {
      const broken = baseBalances();
      (broken.balances[0] as unknown as { amount: number }).amount = 123;
      const result = validateBody(schema, broken);
      expect(result.valid).toBe(false);
      expect(result.errors.join(" ")).toMatch(/amount/);
    });

    it("rejects an empty numericString (the money-field contract)", () => {
      const broken = baseBalances();
      broken.total_value_usd = "";
      const result = validateBody(schema, broken);
      expect(result.valid).toBe(false);
      expect(result.errors.join(" ")).toMatch(/total_value_usd/);
    });

    it("rejects a non-numeric money string", () => {
      const broken = baseBalances();
      if (broken.balances[0]) {
        broken.balances[0].amount_usd = "not-a-number";
      }
      expect(validateBody(schema, broken).valid).toBe(false);
    });

    it("rejects a missing required field", () => {
      const broken = baseBalances();
      delete (broken.balances[0] as Partial<BalancesFixture["balances"][number]>).amount;
      const result = validateBody(schema, broken);
      expect(result.valid).toBe(false);
      expect(result.errors.join(" ")).toMatch(/amount|required/);
    });
  });

  it("validateArrayBody rejects a non-array body", () => {
    expect(validateArrayBody("earn-pool", { not: "an array" }).valid).toBe(false);
  });
});
