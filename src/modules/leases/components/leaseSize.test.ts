/**
 * Regression tests for the Leases-list Size cell.
 *
 * Rule (mirror of PositionSummaryWidget):
 *   LONG : value = crypto adaptive, subValue = USD 2 dp
 *   SHORT: value = USD 2 dp,        subValue = crypto adaptive (BTC/etc.)
 *
 * The SHORT branch has regressed at least once on the positions list —
 * when the format was unified with LONG it left USDC being rendered
 * via `formatTokenBalance` (8 dp) while the sub showed a $-rounded number.
 * These assertions prevent it from flipping back.
 */
import { describe, it, expect } from "vitest";
import { Dec } from "@keplr-wallet/unit";
import { buildLeaseSizeCell } from "./leaseSize";

const BTC = { shortName: "BTC", decimal_digits: 8 };

describe("buildLeaseSizeCell", () => {
  describe("LONG", () => {
    it("puts crypto adaptive in the big value and $-rounded USD in the sub", () => {
      const cell = buildLeaseSizeCell({
        positionType: "Long",
        unitAsset: new Dec("0.00089801"), // 0.000898 BTC
        assetValueUsd: new Dec("70"), // $70
        cryptoAsset: BTC
      });
      // Big: adaptive crypto precision, no $. formatTokenBalance uses
      // first-significant-digit+1 rule for amounts < 1 and trims trailing
      // zeros, so 0.00089801 renders as "0.00089".
      expect(cell.value).not.toMatch(/^\$/);
      expect(cell.value).toBe("0.00089");
      // Sub: USD 2 dp, $-prefixed
      expect(cell.subValue).toMatch(/^\$70\.00$/);
      // Tooltip exposes full crypto decimals for disambiguation
      expect(cell.tooltip).toBe("0.00089801");
    });

    it("renders integer-scale crypto amounts without padding trailing zeros past min 2", () => {
      const cell = buildLeaseSizeCell({
        positionType: "Long",
        unitAsset: new Dec("1234.5"),
        assetValueUsd: new Dec("1234.5"),
        cryptoAsset: BTC
      });
      expect(cell.value).toBe("1,234.50");
      expect(cell.subValue).toBe("$1,234.50");
    });
  });

  describe("SHORT", () => {
    it("puts $-rounded USD in the big value and crypto adaptive in the sub", () => {
      // 70 USDC position, BTC = $77,949.36 → 0.00089801 BTC
      const cell = buildLeaseSizeCell({
        positionType: "Short",
        unitAsset: new Dec("70"), // USDC amount (Dec still carries stable magnitude)
        assetValueUsd: new Dec("69.97"),
        cryptoAsset: BTC,
        cryptoPriceUsd: new Dec("77949.36")
      });
      // Big is the $-rounded number the user would read as position value
      expect(cell.value).toMatch(/^\$69\.97$/);
      // Sub is the crypto-size at adaptive precision, with ticker
      expect(cell.subValue).toBe("0.00089 BTC");
      // Tooltip is the full crypto amount at the asset's native decimals
      expect(cell.tooltip).toMatch(/^0\.00089801/);
    });

    it("does not crash and shows zero crypto when the price feed is missing", () => {
      const cell = buildLeaseSizeCell({
        positionType: "Short",
        unitAsset: new Dec("70"),
        assetValueUsd: new Dec("69.97"),
        cryptoAsset: BTC,
        cryptoPriceUsd: new Dec("0")
      });
      expect(cell.value).toMatch(/^\$69\.97$/);
      expect(cell.subValue).toBe("0.00 BTC");
      expect(cell.tooltip).toBe("0.00000000");
    });

    it("falls back cleanly when cryptoPriceUsd is omitted entirely", () => {
      const cell = buildLeaseSizeCell({
        positionType: "Short",
        unitAsset: new Dec("70"),
        assetValueUsd: new Dec("69.97"),
        cryptoAsset: BTC
      });
      expect(cell.value).toBe("$69.97");
      expect(cell.subValue).toBe("0.00 BTC");
    });

    it("omits the ticker suffix when the crypto asset lookup returned null", () => {
      const cell = buildLeaseSizeCell({
        positionType: "Short",
        unitAsset: new Dec("70"),
        assetValueUsd: new Dec("69.97"),
        cryptoAsset: null,
        cryptoPriceUsd: new Dec("77949.36")
      });
      expect(cell.value).toBe("$69.97");
      expect(cell.subValue).not.toMatch(/BTC/);
      // Still a numeric sub-value; no trailing whitespace
      expect(cell.subValue).toMatch(/^\d/);
    });
  });
});
