import { isMobile } from "@/common/utils";

const mobile = isMobile();

export const CHART_AXIS = {
  yTicks: mobile ? 4 : 5,
  xTicks: mobile ? 3 : (undefined as number | undefined),
  // Observable Plot default is 10px. Only override on mobile to keep it compact.
  fontSize: mobile ? "10px" : (undefined as string | undefined)
};

export function compactTickFormat(d: number): string {
  if (Math.abs(d) >= 1e6) return `$${(d / 1e6).toFixed(1)}M`;
  if (Math.abs(d) >= 1e3) return `$${(d / 1e3).toFixed(1)}K`;
  if (Number.isInteger(d)) return `$${d}`;
  return `$${d.toFixed(2)}`;
}
