<template>
  <LineWithLine
    class="max-h-[150px]"
    :data="chartData"
    :id="chartId"
    :options="defaultOptions"
    :css-classes="cssClasses"
    :height="height"
    :plugins="plugins"
    :styles="styles"
    :width="width"
  />
</template>

<script lang="ts" setup>
import "chartjs-adapter-date-fns";
import { createTypedChart } from "vue-chartjs";
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
  type ChartData,
} from "chart.js";

import { defaultOptions } from "@/components/templates/utils/chartOptions";
import type { PropType } from "vue";
import type { Point } from "chart.js/dist/helpers/helpers.canvas";

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
    // if (this.chart?.tooltip?.active) {
    //   const ctx = this.chart.ctx;
    //   const x = this.chart.tooltip.x;
    //   const topY = this.chart.scales["y-axis-0"].top;
    //   const bottomY = this.chart.scales["y-axis-0"].bottom;

    //   console.log(this.chart.scales['x-axis-0']);
    //   // draw line
    //   ctx.save();
    //   ctx.beginPath();
    //   ctx.moveTo(x, topY);
    //   ctx.lineTo(x, bottomY);
    //   ctx.lineWidth = 2;
    //   ctx.strokeStyle = "#07C";
    //   ctx.stroke();
    //   ctx.restore();
    // }
  }
}

const LineWithLine = createTypedChart("line", LineWithLineController);

defineProps({
  chartId: {
    type: String,
    default: "line-chart",
  },
  chartData: {
    type: Object as PropType<ChartData<"line", (number | Point | null)[], unknown>>,
    default: () => {
      return {
        labels: [],
        datasets: []
      }
    }
  },
  width: {
    type: Number,
  },
  height: {
    type: Number,
    default: 150,
  },
  cssClasses: {
    default: "",
    type: String,
  },
  styles: {
    type: Object as PropType<Partial<CSSStyleDeclaration>>,
    default: () => { },
  },
  plugins: {
    type: Array as PropType<Plugin<"line">[]>,
    default: () => [],
  },
});

</script>

<style lang="scss">
div.chart-tooltip {
  padding: 16px;
  pointer-events: none;
  position: absolute;
  transform: translate(-50%, 0);
  transition: all 0.1s ease;
  border: 1px solid #ebeff5;
  box-shadow: 0px 12px 32px rgba(7, 45, 99, 0.06);
  border-radius: 8px;
  background: white;
  z-index: 2;

  table {
    margin: 0;

    tr,
    th {
      border-width: 0;
    }

    thead {
      color: #2868e1;
      font-size: 12px;
      text-transform: uppercase;
      font-family: "Garet";
      font-style: normal;
      font-weight: 500;

      tr {
        th {
          display: block;
          white-space: pre;

          margin-bottom: 5px;
        }
      }
    }

    tbody {
      font-family: "Garet";
      font-style: normal;
      font-weight: 600;
      font-size: 14px;
      color: #082d63;

      tr {
        td {
          span {
            color: #8396b1;
          }
        }
      }
    }
  }
}

body.sync {
  @media (prefers-color-scheme: dark) {
    div.chart-tooltip {
      background-color: #2b384b;
      border-color: #5e7699;

      table {
        tbody {
          color: white;
        }
      }
    }
  }
}

body.dark {
  div.chart-tooltip {
    background-color: #2b384b;
    border-color: #5e7699;

    table {
      tbody {
        color: white;
      }
    }
  }
}
</style>
