<template>
    <Doughnut
        :data="chartData"
        :options="defaultOptions"
    />
</template>
  
<script lang="ts" setup>
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement } from 'chart.js'
import { tooltipConfig } from '@/components/templates/utils/tooltip';;

ChartJS.register(ArcElement)

const chartData = {
    labels: [
        'Red',
        'Blue',
        'Yellow'
    ],
    datasets: [{
        label: 'My First Dataset',
        data: [300, 50, 100],
        backgroundColor: [
            'rgb(255, 99, 132)',
            'rgb(54, 162, 235)',
            'rgb(255, 205, 86)'
        ],
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
            console.log(data);
        })
    }
}

</script>