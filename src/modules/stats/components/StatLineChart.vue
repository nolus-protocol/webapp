<template>
  <LineWithLine
    :id="chartId"
    ref="chartElement"
    :css-classes="cssClasses"
    :data="chartData"
    :height="height"
    :options="defaultOptions"
    :plugins="plugins"
    :styles="styles"
    :width="width"
    class="max-h-[150px]"
  />
</template>

<script lang="ts" setup>
import "chartjs-adapter-date-fns";
import { createTypedChart } from "vue-chartjs";
import { type PropType, ref } from "vue";
import { tooltipConfig } from "@/config/tooltip";
import type { IObjectKeys } from "@/common/types";

import {
  CategoryScale,
  Chart as ChartJS,
  type ChartData,
  type ChartOptions,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  type Plugin,
  type Point,
  PointElement,
  TimeScale,
  Title,
  Tooltip
} from "chart.js";

ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale, TimeScale);

class LineWithLineController extends LineController {
  public override draw() {
    super.draw();
  }
}

const LineWithLine = createTypedChart("line", LineWithLineController);
const chartElement = ref<typeof LineWithLine>();

const defaultOptions: ChartOptions<IObjectKeys | any> = {
  responsive: true,
  maintainAspectRatio: true,
  aspectRatio: true,
  tooltips: {
    intersect: false
  },
  scales: {
    x: {
      parsing: false,
      type: "time",
      ticks: {
        autoSkip: true,
        maxTicksLimit: 8,
        align: "inner",
        maxRotation: 0,
        color: "#8396B1",
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
        drawTicks: false
      }
    },
    y: {
      ticks: {
        display: false
      },
      border: {
        display: false
      },
      grid: {
        display: false,
        drawBorder: false,
        drawOnChartArea: false,
        drawTicks: false
      }
    }
  },
  plugins: {
    legend: {
      display: false
    },
    tooltip: tooltipConfig((data: string[], index: number) => {
      emits("inFocus", data, index);
    }, false)
  }
};

const props = defineProps({
  chartId: {
    type: String,
    default: "line-chart"
  },
  chartData: {
    type: Object as PropType<ChartData<"line", (number | Point | null)[], unknown>>,
    default: () => {
      return {
        labels: [],
        datasets: []
      };
    }
  },
  width: {
    type: Number
  },
  height: {
    type: Number,
    default: 150
  },
  cssClasses: {
    default: "",
    type: String
  },
  styles: {
    type: Object as PropType<Partial<CSSStyleDeclaration>>,
    default: () => {}
  },
  plugins: {
    type: Array as PropType<Plugin<"line">[]>,
    default: () => []
  }
});

function updateChart(supplied: IObjectKeys[], borrowed: IObjectKeys[]) {
  const [s, b] = chartElement.value!.chart.data.datasets;
  for (const e of supplied) {
    s.data.push(e);
  }
  for (const e of borrowed) {
    b.data.push(e);
  }
  chartElement.value?.chart.update();
}

function getChartData() {
  return props.chartData;
}

defineExpose({
  updateChart,
  getChartData
});

const emits = defineEmits(["inFocus"]);
</script>

<style lang="scss">
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
