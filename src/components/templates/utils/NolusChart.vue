<template>
  <Line :chart-data="chartData" :chart-id="chartId" :chart-options="chartOptions" :css-classes="cssClasses"
    :height="height" :plugins="plugins" :styles="styles" :width="width" />
</template>

<script lang="ts">
// @ts-nocheck

import 'chartjs-adapter-date-fns';
import { defineComponent, h, type PropType } from 'vue';
import { generateChart } from 'vue-chartjs';
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  TimeScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  type Plugin,
} from 'chart.js';
import { DEFAULT_CURRENCY } from '@/config/env';

export const defaultOptions = {
  responsive: true,
  maintainAspectRatio: false,
  tooltips: {
    intersect: false
  },
  scales: {
    x: {
      parsing: false,
      type: 'time',
      ticks: {
        autoSkip: true,
        maxTicksLimit: 6,
        maxRotation: 0,
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
      position: 'nearest',
      labelTextColor: 'red',
      callbacks: {
        label: (context) => {
          let label = context.dataset.label || '';
          let value = '';
          if (label) {
            label = `${label}: `;
          }

          if (context.parsed.y !== null) {
            value = new Intl.NumberFormat(DEFAULT_CURRENCY.locale, { style: 'currency', currency: DEFAULT_CURRENCY.currency }).format(context.parsed.y);
          }

          return {
            label,
            value
          };
        }
      },
      external: (context) => {

        const { chart, tooltip } = context;
        const tooltipEl = getOrCreateTooltip(chart);

        if (tooltip.opacity === 0) {
          tooltipEl.style.opacity = 0;
          return;
        }

        if (tooltip.body) {
          const titleLines = tooltip.title || [];
          const bodyLines = tooltip.body.map(b => b.lines);

          const tableHead = document.createElement('thead');

          titleLines.forEach(title => {
            const tr = document.createElement('tr');

            const th = document.createElement('th');
            const text = document.createTextNode(title);

            th.appendChild(text);
            tr.appendChild(th);
            tableHead.appendChild(tr);
          });

          const tableBody = document.createElement('tbody');
          bodyLines.forEach((body, i) => {
            const tr = document.createElement('tr');

            body.forEach((item) => {
              const { label, value } = item;
              const td = document.createElement('td');
              const span = document.createElement('span');

              const labelText = document.createTextNode(label);
              const valueText = document.createTextNode(value);

              span.appendChild(labelText);
              td.appendChild(span);
              td.appendChild(valueText);
              tr.appendChild(td)
            });
            ;
            tableBody.appendChild(tr);
          });

          const tableRoot = tooltipEl.querySelector('table');

          // Remove old children
          while (tableRoot.firstChild) {
            tableRoot.firstChild.remove();
          }

          // Add new children
          tableRoot.appendChild(tableHead);
          tableRoot.appendChild(tableBody);
        }

        const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;

        // Display, position, and set styles for font
        tooltipEl.style.opacity = 1;
        tooltipEl.style.left = positionX + tooltip.caretX + 'px';
        tooltipEl.style.top = positionY + tooltip.caretY + 'px';
      }
    }
  }
};

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  TimeScale
);

class LineWithLineController extends LineController {
  public override draw() {
    super.draw();

    if (this.chart?.tooltip?.active) {
      const ctx = this.chart.ctx;
      const x = this.chart.tooltip.x;
      const topY = this.chart.scales['y-axis-0'].top;
      const bottomY = this.chart.scales['y-axis-0'].bottom;

      // draw line
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, bottomY);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#07C';
      ctx.stroke();
      ctx.restore();
    }
  }
}

const LineWithLine = generateChart(
  'line-with-chart',
  'line',
  LineWithLineController
);

export default defineComponent({
  name: 'CustomChart',
  components: {
    LineWithLine,
  },
  props: {
    chartId: {
      type: String,
      default: 'line-chart',
    },
    chartData: {
      type: Object,
      default: {},
    },
    chartOptions: {
      type: Object,
      default: defaultOptions,
    },
    width: {
      type: Number,
    },
    height: {
      type: Number,
      default: 150,
    },
    cssClasses: {
      default: '',
      type: String,
    },
    styles: {
      type: Object as PropType<Partial<CSSStyleDeclaration>>,
      default: () => { },
    },
    plugins: {
      type: Array as PropType<Plugin<'line'>[]>,
      default: () => [],
    },
  },
  setup(props) {
    return () =>
      h(LineWithLine, {
        chartData: props.chartData,
        chartOptions: props.chartOptions,
        chartId: props.chartId,
        width: props.width,
        height: props.height,
        cssClasses: props.cssClasses,
        styles: props.styles,
        plugins: props.plugins,

      });
  },
});

const getOrCreateTooltip = (chart) => {
  let tooltipEl = chart.canvas.parentNode.querySelector('div');

  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.classList.add('chart-tooltip');

    const table = document.createElement('table');

    tooltipEl.appendChild(table);
    chart.canvas.parentNode.appendChild(tooltipEl);
  }

  return tooltipEl;
};

</script>

<style lang="scss">
div.chart-tooltip {
  padding: 16px;
  pointer-events: none;
  position: absolute;
  transform: translate(-50%, 0);
  transition: all .1s ease;
  border: 1px solid #EBEFF5;
  box-shadow: 0px 12px 32px rgba(7, 45, 99, 0.06);
  border-radius: 8px;

  min-width: 195px;
  background: white;

  table {
    margin: 0;

    tr,
    th {
      border-width: 0;
    }

    thead {
      color: #2868E1;
      font-size: 12px;
      text-transform: uppercase;
      font-family: 'Garet';
      font-style: normal;
      font-weight: 500;

      tr {
        th {
          display: block;
          margin-bottom: 5px;
        }
      }
    }

    tbody {
      font-family: 'Garet';
      font-style: normal;
      font-weight: 600;
      font-size: 14px;
      color: #082D63;

      tr {
        td {
          span {
            color: #8396B1;
          }
        }
      }
    }
  }
}

@media (prefers-color-scheme: dark) {
  div.chart-tooltip {
    background-color: #2B384B;
    border-color: #5E7699;

    table {
      tbody {
        color: white;
      }
    }
  }
}
</style>