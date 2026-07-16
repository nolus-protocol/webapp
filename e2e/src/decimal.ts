interface ParsedDecimal {
  negative: boolean;
  intDigits: string;
  fracDigits: string;
}

function parseDecimal(value: string, name: string): ParsedDecimal {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`${name} is not a decimal number: "${value}"`);
  }
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const dot = unsigned.indexOf(".");
  if (dot === -1) {
    return { negative, intDigits: unsigned, fracDigits: "" };
  }
  return { negative, intDigits: unsigned.slice(0, dot), fracDigits: unsigned.slice(dot + 1) };
}

function toScaledBigInt(parsed: ParsedDecimal, scale: number): bigint {
  const padded = parsed.fracDigits.padEnd(scale, "0");
  const magnitude = BigInt(parsed.intDigits + padded);
  return parsed.negative ? -magnitude : magnitude;
}

function formatScaled(value: bigint, scale: number): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(scale + 1, "0");
  const intPart = digits.slice(0, digits.length - scale);
  const fracPart = scale === 0 ? "" : digits.slice(digits.length - scale).replace(/0+$/, "");
  const body = fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart;
  return negative ? `-${body}` : body;
}

export function sumDecimalStrings(values: string[]): string {
  const parsed = values.map((value, index) => parseDecimal(value, `value[${index}]`));
  const scale = parsed.reduce((max, item) => Math.max(max, item.fracDigits.length), 0);
  const total = parsed.reduce((acc, item) => acc + toScaledBigInt(item, scale), 0n);
  return formatScaled(total, scale);
}

export interface ToleranceComparison {
  within: boolean;
  diff: string;
}

export function compareWithinTolerance(left: string, right: string, tolerance: number): ToleranceComparison {
  const parsedLeft = parseDecimal(left, "left");
  const parsedRight = parseDecimal(right, "right");
  const parsedTolerance = parseDecimal(tolerance.toString(), "tolerance");
  const scale = Math.max(
    parsedLeft.fracDigits.length,
    parsedRight.fracDigits.length,
    parsedTolerance.fracDigits.length
  );

  const scaledLeft = toScaledBigInt(parsedLeft, scale);
  const scaledRight = toScaledBigInt(parsedRight, scale);
  const scaledTolerance = toScaledBigInt(parsedTolerance, scale);

  const rawDiff = scaledLeft - scaledRight;
  const absDiff = rawDiff < 0n ? -rawDiff : rawDiff;

  return {
    within: absDiff <= scaledTolerance,
    diff: formatScaled(rawDiff, scale)
  };
}
