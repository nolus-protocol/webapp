import { isMobile } from "@/common/utils";
import { NATIVE_CURRENCY } from "@/config/global";

const mobile = isMobile();

export const CHART_AXIS = {
  yTicks: mobile ? 4 : 5,
  xTicks: mobile ? 3 : (undefined as number | undefined),
  fontSize: mobile ? "12px" : "14px"
};

export function getChartWidth(plotContainer: HTMLElement): number {
  return plotContainer.parentElement!.clientWidth;
}

const measureCanvas = document.createElement("canvas").getContext("2d")!;

export function computeMarginLeft(
  yDomain: [number, number],
  tickFormat: (d: number) => string,
  ticks: number
): number {
  measureCanvas.font = `${CHART_AXIS.fontSize} system-ui, sans-serif`;
  const [min, max] = yDomain;
  const step = (max - min) / (ticks - 1 || 1);
  let maxWidth = 0;
  for (let i = 0; i < ticks; i++) {
    const value = min + step * i;
    const label = tickFormat(value);
    const width = measureCanvas.measureText(label).width;
    if (width > maxWidth) maxWidth = width;
  }
  return Math.ceil(maxWidth) + 12;
}

/**
 * Create a USD tick formatter based on the axis data range.
 * The range determines the format — all ticks use the same format.
 *
 * >= 1K: compact ($1.5K, $68K, $1.5M)
 * >= 1: 2 decimals ($1.85, $7.00)
 * < 1: adaptive decimals ($0.0045, $0.12)
 */
export function createUsdTickFormat(yDomain: [number, number]): (d: number) => string {
  const maxAbs = Math.max(Math.abs(yDomain[0]), Math.abs(yDomain[1]));

  if (maxAbs >= 1000) {
    const fmt = new Intl.NumberFormat(NATIVE_CURRENCY.locale, {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1,
      style: "currency",
      currency: "USD"
    });
    return (d) => fmt.format(d);
  }

  if (maxAbs >= 1) {
    const fmt = new Intl.NumberFormat(NATIVE_CURRENCY.locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: "currency",
      currency: "USD"
    });
    return (d) => fmt.format(d);
  }

  // Sub-dollar: find first significant digit for adaptive precision
  const str = maxAbs.toFixed(8);
  const afterDot = str.split(".")[1] ?? "";
  const firstSig = afterDot.search(/[1-9]/);
  const decimals = firstSig === -1 ? 2 : Math.min(firstSig + 2, 8);
  const fmt = new Intl.NumberFormat(NATIVE_CURRENCY.locale, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 2,
    style: "currency",
    currency: "USD"
  });
  return (d) => fmt.format(d);
}

/**
 * Create a plain number tick formatter (no $) based on the axis data range.
 * Same logic as createUsdTickFormat but without currency style.
 */
export function createNumberTickFormat(yDomain: [number, number]): (d: number) => string {
  const maxAbs = Math.max(Math.abs(yDomain[0]), Math.abs(yDomain[1]));

  if (maxAbs >= 1000) {
    const fmt = new Intl.NumberFormat(NATIVE_CURRENCY.locale, {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1
    });
    return (d) => fmt.format(d);
  }

  const fmt = new Intl.NumberFormat(NATIVE_CURRENCY.locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
  return (d) => fmt.format(d);
}
