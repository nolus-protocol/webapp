<template>
  <Line
    :chart-data="chartData"
    :chart-id="chartId"
    :chart-options="chartOptions"
    :css-classes="cssClasses"
    :dataset-id-key="datasetIdKey"
    :height="height"
    :plugins="plugins"
    :styles="styles"
    :width="width"
  />
</template>

<script lang="ts">
import { defineComponent, h, PropType } from "vue";

import { generateChart } from "vue-chartjs";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  Plugin,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale
);

class LineWithLineController extends LineController {
  public override draw() {
    super.draw();

    if (this.chart?.tooltip?.active) {
      const ctx = this.chart.ctx;
      const x = this.chart.tooltip.x;
      const topY = this.chart.scales["y-axis-0"].top;
      const bottomY = this.chart.scales["y-axis-0"].bottom;

      // draw line
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, bottomY);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#07C";
      ctx.stroke();
      ctx.restore();
    }
  }
}

const LineWithLine = generateChart(
  "line-with-chart",
  "line",
  LineWithLineController
);

export default defineComponent({
  name: "CustomChart",
  components: {
    LineWithLine,
  },
  props: {
    chartId: {
      type: String,
      default: "line-chart",
    },
    width: {
      type: Number,
      // default: 300,
    },
    height: {
      type: Number,
      default: 80,
    },
    cssClasses: {
      default: "",
      type: String,
    },
    styles: {
      type: Object as PropType<Partial<CSSStyleDeclaration>>,
      default: () => {},
    },
    plugins: {
      type: Array as PropType<Plugin<"line">[]>,
      default: () => [],
    },
  },
  setup(props) {
    const DATA_COUNT = 31;
    const NUMBER_CFG = {
      count: DATA_COUNT,
      min: 0,
      max: 100,
    };
    const chartData = {
      labels: [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
      ],
      showXLabels: 10,
      datasets: [
        {
          label: "Data One",
          borderColor: "#2868E1",
          data: [
            40, 15, 90, 10, 40, 39, 50, 2, 40, 80, 40, 20, 25, 29, 40, 43, 50,
            48, 56, 40, 15, 90, 10, 40, 39, 50, 2, 40, 80, 40, 20, 25, 29, 40,
            43, 50,
          ],
          tension: 0.4,
          pointRadius: 0,
        },
      ],
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      tooltips: {
        intersect: false,
      },
      scales: {
        x: {
          type: "linear",
          ticks: {
            max: 31,
            min: 0,
            stepSize: 15,
          },
          scaleLabel: {
            display: true,
            labelString: "min",
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
      },
    };

    return () =>
      // @ts-ignore
      h(LineWithLine, {
        chartData,
        chartOptions,
        chartId: props.chartId,
        width: props.width,
        height: props.height,
        cssClasses: props.cssClasses,
        styles: props.styles,
        plugins: props.plugins,
      });
  },
});
</script>
