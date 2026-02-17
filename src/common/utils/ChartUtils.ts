import { isMobile } from "@/common/utils";
import { NATIVE_CURRENCY } from "@/config/global";

const mobile = isMobile();

export const CHART_AXIS = {
  fontSize: mobile ? "12px" : "14px",
  xTicks: mobile ? 4 : 6,
  yTicks: mobile ? 4 : 5
};

export function getChartWidth(plotContainer: HTMLElement): number {
  return plotContainer.parentElement!.clientWidth;
}

const measureCanvas = document.createElement("canvas").getContext("2d")!;

export function computeMarginLeft(
  yDomain: [number, number],
  tickFormat: (d: number) => string,
  ticks?: number[]
): number {
  measureCanvas.font = `${CHART_AXIS.fontSize} system-ui, sans-serif`;
  const values = ticks ?? [yDomain[0], yDomain[1]];
  let maxWidth = 0;
  for (const v of values) {
    const w = measureCanvas.measureText(tickFormat(v)).width;
    if (w > maxWidth) maxWidth = w;
  }
  return Math.ceil(maxWidth) + 12;
}

/**
 * Generate exactly `count` evenly-spaced tick values within a domain.
 * Observable Plot's `ticks: N` is only a hint — passing an explicit array
 * guarantees the exact number of ticks rendered.
 */
export function computeYTicks(yDomain: [number, number], count: number = CHART_AXIS.yTicks): number[] {
  const [min, max] = yDomain;
  if (count <= 1 || min === max) return [min];
  const step = (max - min) / (count - 1);
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) {
    ticks.push(min + step * i);
  }
  return ticks;
}

export function computeMarginLeftForLabels(labels: string[]): number {
  measureCanvas.font = `${CHART_AXIS.fontSize} system-ui, sans-serif`;
  let maxWidth = 0;
  for (const label of labels) {
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
