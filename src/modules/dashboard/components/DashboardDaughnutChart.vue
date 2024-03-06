<template>
  <Doughnut
    ref="chartElement"
    :data="chartData"
    :options="defaultOptions"
    :style="{ height: '140px', width: '140px' }"
  />
</template>

<script lang="ts" setup>
import type { IObjectKeys } from "@/common/types";
import { Doughnut } from "vue-chartjs";
import { ArcElement, Chart as ChartJS, Tooltip } from "chart.js";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { tooltipConfig } from "@/config/tooltip";

ChartJS.register(ArcElement, Tooltip);
const chartElement = ref<typeof Doughnut>();
const i18n = useI18n();

const chartData = {
  labels: [],
  datasets: [
    {
      label: i18n.t("message.total"),
      amount: i18n.t("message.amount"),
      data: [],
      backgroundColor: [],
      hoverOffset: 12
    }
  ]
};

const defaultOptions: IObjectKeys = {
  responsive: true,
  radius: "90%",
  maintainAspectRatio: true,
  borderWidth: 0,
  aspectRatio: true,
  cutout: window.innerWidth > 680 ? 45 : 75,
  tooltips: {
    intersect: false
  },
  plugins: {
    legend: {
      display: false
    },
    tooltip: tooltipConfig((data: string[]) => {})
  }
};

function updateChart(labels: string[], colors: string[], data: any[], assets: any[]) {
  const [s] = chartElement.value!.chart.data.datasets;
  chartElement.value!.chart.data.labels = labels;
  s.data = data;
  s.assets = assets;
  s.backgroundColor = colors;

  chartElement.value?.chart.update();
}

defineExpose({
  updateChart,
  chartElement
});
</script>

<style lang="scss">
canvas {
  z-index: initial;
}

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
  z-index: 9;

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
      font-family: "Garet", sans-serif;
      font-style: normal;
      font-weight: 500;

      tr {
        th {
          display: block;
          white-space: pre;
          text-align: left;
          margin-bottom: 5px;
        }
      }
    }

    tbody {
      font-family: "Garet", sans-serif;
      font-style: normal;
      font-weight: 600;
      font-size: 14px;
      color: #082d63;

      tr {
        display: flex;
        flex-direction: column;

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
