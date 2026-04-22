/**
 * Size-cell formatter for the Leases list row.
 *
 * Size follows the codebase's rounding convention:
 *   - stable (USD) values     → `formatDecAsUsd` (2 dp, $-prefixed)
 *   - crypto asset values     → `formatTokenBalance` (adaptive, trimmed)
 *
 * LONG:  big = crypto (adaptive),    sub = USD (2 dp)
 * SHORT: big = USD (2 dp, rounded),  sub = crypto BTC (adaptive)
 *
 * For SHORT positions `displayData.unitAsset` is actually denominated in
 * the stable (USDC) — same Dec in both "is USDC" and "has USD meaning"
 * senses — so the sub-number needs the stable-to-crypto conversion via
 * the borrowed asset's oracle price.
 */
import { Dec } from "@keplr-wallet/unit";
import { formatDecAsUsd, formatTokenBalance } from "@/common/utils/NumberFormatUtils";

export interface LeaseSizeInputs {
  /** `Long` / `Short` — raw value from `configStore.getPositionType`. */
  positionType: "Long" | "Short" | string;
  /** `displayData.unitAsset` — for LONG this is crypto, for SHORT it's USDC. */
  unitAsset: Dec;
  /** `displayData.assetValueUsd` — USD value of the position. */
  assetValueUsd: Dec;
  /** The volatile/crypto asset on both position types (LONG: `amount.ticker`, SHORT: `debt.ticker`). */
  cryptoAsset?: { shortName?: string; decimal_digits?: number } | null;
  /**
   * Oracle price of the crypto asset in USD. Only used for SHORT; required
   * to convert the stable `unitAsset` into an equivalent crypto amount for
   * the sub-number. Pass a `Dec(0)` to force the zero fallback.
   */
  cryptoPriceUsd?: Dec;
}

export interface LeaseSizeCell {
  value: string;
  subValue: string;
  tooltip: string;
}

export function buildLeaseSizeCell(inputs: LeaseSizeInputs): LeaseSizeCell {
  if (inputs.positionType !== "Short") {
    return {
      value: formatTokenBalance(inputs.unitAsset),
      subValue: formatDecAsUsd(inputs.assetValueUsd),
      tooltip: inputs.unitAsset.toString(inputs.cryptoAsset?.decimal_digits ?? 6)
    };
  }

  const price = inputs.cryptoPriceUsd ?? new Dec(0);
  const cryptoAmount = price.isPositive() ? inputs.unitAsset.quo(price) : new Dec(0);
  const suffix = inputs.cryptoAsset?.shortName ? ` ${inputs.cryptoAsset.shortName}` : "";
  return {
    value: formatDecAsUsd(inputs.assetValueUsd),
    subValue: `${formatTokenBalance(cryptoAmount)}${suffix}`,
    tooltip: cryptoAmount.toString(inputs.cryptoAsset?.decimal_digits ?? 8)
  };
}
