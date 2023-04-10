import { NATIVE_CURRENCY } from "@/config/env";
import type { ChartOptions } from "chart.js";

export const defaultOptions: ChartOptions<any> = {
  responsive: true,
  maintainAspectRatio: true,
  aspectRatio: true,
  tooltips: {
    intersect: false,
  },
  scales: {
    x: {
      parsing: false,
      type: "time",
      ticks: {
        autoSkip: true,
        maxTicksLimit: 6,
        maxRotation: 0,
        color: '#8396B1',
        font: {
          size: 12,
          family: "Garet-Medium"
        }
      },
      border: {
        display: false
      },
      grid: {
        display: false,
        drawBorder: false,
        drawOnChartArea: false,
        drawTicks: false,
      },
    },
    y: {
      ticks: {
        display: false,
      },
      border: {
        display: false
      },
      grid: {
        display: false,
        drawBorder: false,
        drawOnChartArea: false,
        drawTicks: false,
      },
    },
  },
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      enabled: false,
      intersect: false,
      position: "nearest",
      callbacks: {
        label: (context: {
          dataset: { label: string };
          parsed: { y: number | bigint | null };
        }) => {
          let label = context.dataset.label || "";
          let value = "";
          if (label) {
            label = `${label}: `;
          }

          if (context.parsed.y !== null) {
            value = new Intl.NumberFormat(NATIVE_CURRENCY.locale, {
              style: "currency",
              currency: NATIVE_CURRENCY.currency,
            }).format(context.parsed.y);
          }

          return {
            label,
            value,
          };
        },
      },
      external: (context: { chart: any; tooltip?: any }) => {
        const { chart, tooltip } = context;
        const tooltipEl = getOrCreateTooltip(chart);

        if (tooltip.opacity === 0) {
          tooltipEl.style.opacity = '0';
          return;
        }
        if (tooltip.body) {
          const titleLines = tooltip.title || [];
          const bodyLines = tooltip.body.map((b: { lines: any }) => b.lines);

          const tableHead = document.createElement("thead");

          titleLines.forEach((title: string) => {
            const tr = document.createElement("tr");

            const th = document.createElement("th");
            const text = document.createTextNode(title);

            th.appendChild(text);
            tr.appendChild(th);
            tableHead.appendChild(tr);
          });

          const tableBody = document.createElement("tbody");
          bodyLines.forEach((body: any[], i: any) => {
            const tr = document.createElement("tr");

            body.forEach((item: { label: any; value: any }) => {
              const { label, value } = item;
              const td = document.createElement("td");
              const span = document.createElement("span");

              const labelText = document.createTextNode(label);
              const valueText = document.createTextNode(value);

              span.appendChild(labelText);
              td.appendChild(span);
              td.appendChild(valueText);
              tr.appendChild(td);
            });
            tableBody.appendChild(tr);
          });

          const tableRoot = tooltipEl.querySelector("table");
          // Remove old children
          while (tableRoot?.firstChild) {
            tableRoot.firstChild.remove();
          }

          // Add new children
          tableRoot?.appendChild(tableHead);
          tableRoot?.appendChild(tableBody);
        }

        const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;
        let moveLeft = positionX + tooltip.caretX;
        const left = moveLeft + tooltipEl.offsetWidth / 2;
        const bounding = context.chart.canvas.getBoundingClientRect();
        const canvasPosition = bounding.width + bounding.left;

        if (canvasPosition < left) {
          const diff = left - canvasPosition;
          moveLeft -= diff;
        }
        // Display, position, and set styles for font
        tooltipEl.style.opacity = '1';
        tooltipEl.style.left = moveLeft + "px";
        tooltipEl.style.top = positionY + tooltip.caretY + 10 + "px";
      },
    },
  },
};

const getOrCreateTooltip = (chart: {
  canvas: {
    nextSibling: HTMLElement,
    parentNode: {
      querySelector: (arg0: string) => any;
      appendChild: (arg0: any) => void;
    };
  };
}) => {
  const nextSibling = chart.canvas.nextSibling;

  if (!nextSibling) {
    const tooltipEl = document.createElement("div");
    tooltipEl.classList.add("chart-tooltip");
    tooltipEl.id = 'chart-tooltip'

    const table = document.createElement("table");

    tooltipEl.appendChild(table);
    chart.canvas.parentNode.appendChild(tooltipEl);
    return tooltipEl;
  }

  return nextSibling;
};