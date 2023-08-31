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
        hoverOffset: 4
    }]
};

const defaultOptions: any = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: true,
    cutout: 50,
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