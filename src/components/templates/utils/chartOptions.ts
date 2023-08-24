import { tooltipConfig } from '@/components/templates/utils/tooltip';;
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
    tooltip: tooltipConfig()
  },
};