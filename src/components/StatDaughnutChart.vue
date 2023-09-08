<template>
    <Doughnut :data="chartData"
              :options="defaultOptions"
              ref="chartElement" />
</template>
  
<script lang="ts" setup>
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement } from 'chart.js'
import { tooltipConfig } from '@/components/templates/utils/tooltip';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

ChartJS.register(ArcElement)
const chartElement = ref<typeof Doughnut>()
const i18n = useI18n();

const chartData = {
    labels: [],
    datasets: [{
        label: i18n.t('message.total'),
        data: [],
        backgroundColor: [],
        hoverOffset: 12
    }]
};

const defaultOptions: any = {
    responsive: true,
    radius: '90%',
    maintainAspectRatio: true,
    borderWidth: 0,
    aspectRatio: true,
    cutout: window.innerWidth > 680 ? 60 : 95,
    tooltips: {
        intersect: false,
    },
    plugins: {
        legend: {
            display: false,
        },
        tooltip: tooltipConfig((data: string[]) => {
            emits('inFocus', data);
        })
    }
}

function updateChart(labels: string[], colors: string[], data: number[]) {
    const [s] = chartElement.value!.chart.data.datasets;

    for (const e of labels) {
        chartElement.value!.chart.data.labels.push(e);
    }

    for (const e of data) {
        s.data.push(e);
    }

    for (const e of colors) {
        s.backgroundColor.push(e);
    }

    chartElement.value?.chart.update();
}

defineExpose({
    updateChart,
});

const emits = defineEmits(['inFocus'])
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
      font-family: "Garet", sans-serif;
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
      font-family: "Garet", sans-serif;
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
