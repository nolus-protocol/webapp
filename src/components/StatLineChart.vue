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
    ref="chartElement"
  />
</template>

<script lang="ts" setup>
import "chartjs-adapter-date-fns";
import { createTypedChart } from "vue-chartjs";
import { CategoryScale, Chart as ChartJS, Legend, LinearScale, TimeScale, LineController, LineElement, PointElement, Title, Tooltip, type Plugin, type ChartData, type Point, type ChartOptions } from "chart.js";

import { ref, type PropType } from "vue";
import { tooltipConfig } from "./templates/utils/tooltip";

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
  }
}

const LineWithLine = createTypedChart("line", LineWithLineController);
const chartElement = ref<typeof LineWithLine>();

const defaultOptions: ChartOptions<any> = {
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
        maxTicksLimit: 8,
        align: 'inner',
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
    tooltip: tooltipConfig((data: string[], index: number) => {
      emits('inFocus', data, index);
    }, false)
  },
};

const props = defineProps({
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

function updateChart(supplied: any, borrowed: any) {
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
  return props.chartData
}

defineExpose({
  updateChart,
  getChartData
});

const emits = defineEmits(['inFocus'])

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
