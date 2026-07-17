/**
 * An independent 18-dp fixed-point decimal — the arithmetic half of the render oracle.
 *
 * It reimplements the semantics of the app's `@keplr-wallet/unit` `Dec` (18 internal
 * decimal places; `toString(n)` TRUNCATES toward zero, never rounds; `mul`/`quo` truncate)
 * from first principles with `bigint`, importing nothing from the app. Independence is the
 * point: if the oracle borrowed the app's arithmetic it would only prove the app equals
 * itself. Only display rounding (Intl) lives in the formatter layer; every truncation the
 * app performs is reproduced here as an exact string/integer chop.
 */

const PRECISION = 18;
const SCALE = 10n ** BigInt(PRECISION);

function pow10(n: number): bigint {
  return 10n ** BigInt(n);
}

/** Integer division truncated toward zero (matches keplr's chop-and-truncate). */
function divTruncate(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  // bigint `/` already truncates toward zero in JS, so this is exact for both signs.
  return quotient;
}

export class Decimal {
  /** Value scaled by 10^18. */
  private readonly atomics: bigint;

  private constructor(atomics: bigint) {
    this.atomics = atomics;
  }

  static zero(): Decimal {
    return new Decimal(0n);
  }

  /** Parse a decimal string (`"63463.437"`, `"-1.5"`). Excess fractional digits truncate. */
  static fromString(value: string): Decimal {
    const trimmed = value.trim();
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(trimmed)) {
      throw new Error(`not a decimal string: "${value}"`);
    }
    const negative = trimmed.startsWith("-");
    const unsigned = negative ? trimmed.slice(1) : trimmed;
    const [intPart = "0", fracPart = ""] = unsigned.split(".");
    const fracScaled = (fracPart + "0".repeat(PRECISION)).slice(0, PRECISION);
    const atomics = BigInt(intPart || "0") * SCALE + BigInt(fracScaled || "0");
    return new Decimal(negative ? -atomics : atomics);
  }

  /** Interpret an integer micro-amount string as having `prec` implied decimals. */
  static fromAtomics(intValue: string, prec: number): Decimal {
    const trimmed = intValue.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      throw new Error(`not an integer string: "${intValue}"`);
    }
    if (prec > PRECISION) {
      throw new Error(`precision ${prec.toString()} exceeds ${PRECISION.toString()}`);
    }
    return new Decimal(BigInt(trimmed) * pow10(PRECISION - prec));
  }

  add(other: Decimal): Decimal {
    return new Decimal(this.atomics + other.atomics);
  }

  sub(other: Decimal): Decimal {
    return new Decimal(this.atomics - other.atomics);
  }

  mul(other: Decimal): Decimal {
    return new Decimal(divTruncate(this.atomics * other.atomics, SCALE));
  }

  quo(other: Decimal): Decimal {
    if (other.atomics === 0n) {
      throw new Error("division by zero");
    }
    return new Decimal(divTruncate(this.atomics * SCALE, other.atomics));
  }

  abs(): Decimal {
    return new Decimal(this.atomics < 0n ? -this.atomics : this.atomics);
  }

  isZero(): boolean {
    return this.atomics === 0n;
  }

  isNegative(): boolean {
    return this.atomics < 0n;
  }

  isPositive(): boolean {
    return this.atomics > 0n;
  }

  gte(other: Decimal): boolean {
    return this.atomics >= other.atomics;
  }

  gt(other: Decimal): boolean {
    return this.atomics > other.atomics;
  }

  /** Truncate toward zero to `prec` fixed decimals — the app's `Dec.toString(prec)`. */
  toString(prec = PRECISION): string {
    const sign = this.atomics < 0n ? "-" : "";
    const absAtomics = this.atomics < 0n ? -this.atomics : this.atomics;
    const intPart = absAtomics / SCALE;
    const fracAll = (absAtomics % SCALE).toString().padStart(PRECISION, "0");
    if (prec <= 0) {
      return `${sign}${intPart.toString()}`;
    }
    const fracChopped = (fracAll + "0".repeat(prec)).slice(0, prec);
    return `${sign}${intPart.toString()}.${fracChopped}`;
  }

  /** Float view — for the paths where the app itself passes through `Number(...)`. */
  toNumber(): number {
    return Number(this.toString(PRECISION));
  }
}
