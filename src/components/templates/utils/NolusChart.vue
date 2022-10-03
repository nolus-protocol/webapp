<template>
  <Line
    :chart-data="chartData"
    :chart-id="chartId"
    :chart-options="chartOptions"
    :css-classes="cssClasses"
    :height="height"
    :plugins="plugins"
    :styles="styles"
    :width="width"
  />
</template>

<script lang="ts">
import { defineComponent, h, PropType } from 'vue'

import { generateChart } from 'vue-chartjs'
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  TimeScale,
  LineController,
  LineElement,
  Plugin,
  PointElement,
  Title,
  Tooltip
} from 'chart.js'
import 'chartjs-adapter-date-fns'

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
            maxRotation: 0
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
        }
      }
    }

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  TimeScale
)

class LineWithLineController extends LineController {
  public override draw () {
    super.draw()

    if (this.chart?.tooltip?.active) {
      const ctx = this.chart.ctx
      const x = this.chart.tooltip.x
      const topY = this.chart.scales['y-axis-0'].top
      const bottomY = this.chart.scales['y-axis-0'].bottom

      // draw line
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(x, topY)
      ctx.lineTo(x, bottomY)
      ctx.lineWidth = 2
      ctx.strokeStyle = '#07C'
      ctx.stroke()
      ctx.restore()
    }
  }
}

const LineWithLine = generateChart(
  'line-with-chart',
  'line',
  LineWithLineController
)

export default defineComponent({
  name: 'CustomChart',
  components: {
    LineWithLine
  },
  props: {
    chartId: {
      type: String,
      default: 'line-chart'
    },
    chartData: {
      type: Object,
      default: {}
    },
    chartOptions: {
      type: Object,
      default: defaultOptions
    },
    width: {
      type: Number
    },
    height: {
      type: Number,
      default: 150
    },
    cssClasses: {
      default: '',
      type: String
    },
    styles: {
      type: Object as PropType<Partial<CSSStyleDeclaration>>,
      default: () => {
      }
    },
    plugins: {
      type: Array as PropType<Plugin<'line'>[]>,
      default: () => []
    }
  },
  setup (props) {
    return () =>
      // @ts-ignore
      h(LineWithLine, {
        chartData: props.chartData,
        chartOptions: props.chartOptions,
        chartId: props.chartId,
        width: props.width,
        height: props.height,
        cssClasses: props.cssClasses,
        styles: props.styles,
        plugins: props.plugins
      })
  }
})
</script>
