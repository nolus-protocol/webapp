<template>
  <Chart
    :updateChart="updateChart"
    :fns="[setStats]"
    :getClosestDataPoint="getClosestDataPoint"
    ref="chart"
    :disableSkeleton="true"
    :data-length="5"
  />
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";

import type { ExternalCurrency } from "@/common/types";
import { formatNumber, formatDecAsUsd } from "@/common/utils/NumberFormatUtils";
import { NATIVE_CURRENCY } from "@/config/global";
import { Dec } from "@keplr-wallet/unit";
import { plot, barY, axisX, ruleY } from "@observablehq/plot";
import { computeYTicks } from "@/common/utils/ChartUtils";
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { select, pointer, type Selection } from "d3";

const marginBottom = 50;
const marginLeft = 50;
const marginRight = 30;
const chart = ref<typeof Chart>();

const i18n = useI18n();

const props = defineProps<{
  downPaymentStable: Dec;
  downPaymentAmount: string;
  downPaymentAsset: ExternalCurrency;

  borrowStable: Dec;
  borrowAmount: string;
  borrowAsset: ExternalCurrency;
}>();
const zero = 0.00000001;

const responses = ref<{ name: string; value: number; ticker: string; price: string }[]>([
  {
    name: i18n.t("message.borrowed-taxes"),
    value: zero,
    ticker: `${new Dec(props.borrowAmount, props.borrowAsset?.decimal_digits ?? 0).toString(props.borrowAsset?.decimal_digits ?? 0)} ${props.borrowAsset?.shortName ?? ""}`,
    price: formatDecAsUsd(props.borrowStable)
  },
  {
    name: i18n.t("message.downpayment"),
    value: zero,
    ticker: `${new Dec(props.downPaymentAmount, props.downPaymentAsset?.decimal_digits ?? 0).toString(props.downPaymentAsset?.decimal_digits ?? 0)} ${props.downPaymentAsset?.shortName ?? ""}`,
    price: formatDecAsUsd(props.downPaymentStable)
  }
]);

watch(
  () => [
    props.downPaymentStable,
    props.downPaymentAmount,
    props.downPaymentAsset,
    props.borrowStable,
    props.borrowAmount,
    props.borrowAsset
  ],
  () => {
    setStats();
    chart.value?.update();
  }
);

async function setStats() {
  const v1 = Number(`${props.borrowStable.toString(NATIVE_CURRENCY.minimumFractionDigits)}`);
  const v2 = Number(`${props.downPaymentStable.toString(NATIVE_CURRENCY.minimumFractionDigits)}`);
  responses.value = [
    {
      name: i18n.t("message.borrowed-taxes"),
      value: v1 == 0 ? zero : v1,
      ticker: `${new Dec(props.borrowAmount, props.borrowAsset?.decimal_digits ?? 0).toString(props.borrowAsset?.decimal_digits ?? 0)} ${props.borrowAsset?.shortName ?? ""}`,
      price: formatDecAsUsd(props.borrowStable)
    },
    {
      name: i18n.t("message.downpayment"),
      value: v2 == 0 ? zero : v2,
      ticker: `${new Dec(props.downPaymentAmount, props.downPaymentAsset?.decimal_digits ?? 0).toString(props.downPaymentAsset?.decimal_digits ?? 0)} ${props.downPaymentAsset?.shortName ?? ""}`,
      price: formatDecAsUsd(props.downPaymentStable)
    }
  ];
}

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, unknown>) {
  if (!plotContainer) return;

  const values = responses.value.map((d) => d.value);
  const yDomain: [number, number] = [0, Math.max(...values)];
  const yTicks = computeYTicks(yDomain);

  const nextChart = plot({
    className: "position-preview-chart",
    y: { label: null, tickFormat: (d) => `$${d}`, tickSize: 0, line: true, ticks: yTicks },
    marginBottom,
    marginLeft,
    marginRight,
    marks: [
      axisX({ label: null, tickSize: 0, fontSize: 16 }),
      barY([responses.value[1]], {
        x: "name",
        y: "value",
        fill: "#C1CAD7",
        rx: 6,
        insetBottom: 0,
        clip: "frame"
      }),
      barY([responses.value[0]], {
        x: "name",
        y: "value",
        fill: "#19A96C",
        rx: 6,
        insetBottom: 0,
        clip: "frame"
      }),
      ruleY([0])
    ]
  });

  const prevChart = plotContainer.firstChild as HTMLElement | null;
  if (prevChart) {
    plotContainer.replaceChild(nextChart, prevChart);
  } else {
    plotContainer.appendChild(nextChart);
  }

  // Inject labels sized to content: append text first, measure, then insert background
  type Measurable = { getBBox(): { x: number; y: number; width: number; height: number } };
  const ns = "http://www.w3.org/2000/svg";
  const fontSize = 14;
  const lineHeight = fontSize * 1.4;
  const px = 12;
  const py = 6;
  // barGroups order matches mark order: [data[1]=downpayment, data[0]=borrow]
  const dataOrder = [responses.value[1], responses.value[0]];

  nextChart.querySelectorAll("[aria-label='bar']").forEach((barGroup, i) => {
    const rect = barGroup.querySelector("rect");
    const d = dataOrder[i];
    if (!rect || !d) return;

    const bx = parseFloat(rect.getAttribute("x") ?? "0");
    const bw = parseFloat(rect.getAttribute("width") ?? "0");
    const by = parseFloat(rect.getAttribute("y") ?? "0");
    const bh = parseFloat(rect.getAttribute("height") ?? "0");
    const cx = bx + bw / 2;
    const baseY = by + bh - py - lineHeight;

    const makeText = (content: string, y: number) => {
      const t = document.createElementNS(ns, "text");
      t.setAttribute("x", String(cx));
      t.setAttribute("y", String(y));
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-size", String(fontSize));
      t.style.fill = "currentColor";
      t.textContent = content;
      nextChart.appendChild(t);
      return t;
    };

    const t1 = makeText(d.price, baseY - lineHeight);
    t1.setAttribute("font-weight", "bold");
    const t2 = makeText(d.ticker, baseY);

    // Measure after append (forces synchronous reflow)
    const b1 = (t1 as unknown as Measurable).getBBox();
    const b2 = (t2 as unknown as Measurable).getBBox();
    const minX = Math.min(b1.x, b2.x);
    const maxX = Math.max(b1.x + b1.width, b2.x + b2.width);
    const minY = Math.min(b1.y, b2.y);
    const maxY = Math.max(b1.y + b1.height, b2.y + b2.height);

    const bg = document.createElementNS(ns, "rect");
    bg.setAttribute("x", String(minX - px));
    bg.setAttribute("y", String(minY - py));
    bg.setAttribute("width", String(maxX - minX + px * 2));
    bg.setAttribute("height", String(maxY - minY + py * 2));
    bg.setAttribute("rx", "6");
    bg.style.fill = "none";
    nextChart.insertBefore(bg, t1);
  });

  select(nextChart)
    .on("mousemove", (event) => {
      const [x] = pointer(event, nextChart);
      const width = (nextChart as HTMLElement).clientWidth;

      const closestData = getClosestDataPoint(x, width);
      if (closestData) {
        tooltip.html(
          `<strong>${i18n.t("message.amount")}</strong> $${formatNumber(
            closestData.value,
            NATIVE_CURRENCY.maximumFractionDigits
          )}`
        );

        const node = tooltip.node()!.getBoundingClientRect();
        const height = node.height;
        const width = node.width;

        tooltip
          .style("opacity", 1)
          .style("left", `${event.pageX - width / 2}px`)
          .style("top", `${event.pageY - height - 10}px`);
      }
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });
}

function getClosestDataPoint(cPosition: number, width: number) {
  const plotAreaWidth = width - marginLeft - marginRight;
  const adjustedX = cPosition - marginLeft;
  const barWidth = plotAreaWidth / responses.value.length;

  const barIndex = Math.floor(adjustedX / barWidth);

  if (barIndex >= 0 && barIndex < responses.value.length) {
    return responses.value[barIndex];
  }

  return null;
}
</script>

<style lang="scss">
.position-preview-chart {
  color: var(--color-typography-default);
}
</style>
