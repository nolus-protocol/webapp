// import { defineComponent, h, PropType } from "vue";

// import { Line } from "vue-chartjs";
// import {
//   Chart as ChartJS,
//   Title,
//   Tooltip,
//   Legend,
//   LineElement,
//   LinearScale,
//   PointElement:chart-options="chartOptions",
//   CategoryScale,
//   Plugin,
// } from "chart.js";

// ChartJS.register(
//   Title,
//   Tooltip,:chart-options="chartOptions"
//   Legend,
//   LineElement,
//   LinearScale,
//   PointElement,
//   CategoryScale
// );

// export default defineComponent({
//   name: "LineChart",
//   components: {
//     Line,
//   },
//   props: {
//     chartId: {
//       type: String,
//       default: "line-chart",
//     },
//     width: {
//       type: Number,
//       //   default: 200,
//     },
//     height: {
//       type: Number,
//       default: 200,
//     },
//     cssClasses: {
//       default: "",
//       type: String,
//     },
//     styles: {
//       type: Object as PropType<Partial<CSSStyleDeclaration>>,
//       default: () => {},
//     },
//     plugins: {
//       type: Array as PropType<Plugin<"line">[]>,
//       default: () => [],
//     },
//   },
//   setup(props) {
//     const chartData = {
//       labels: ["January", "February", "March", "April", "May", "June", "July"],
//       plugins: {
//         dataLabels: {
//           display: false,
//         },
//       },
//       datasets: [
//         {
//           label: "",
//           backgroundColor: "red",
//           borderColor: "red",
//           pointBackgroundColor: "#fff",
//           pointBorderColor: "#fff",
//           pointHoverBackgroundColor: "#fff",
//           pointHoverBorderColor: "green",
//           data: [65, 59, 90, 81, 56, 55, 40],
//         },
//       ],

//       //labels: ["a", "b"],
//     };

//     const chartOptions = {
//       responsive: true,
//       maintainAspectRatio: false,
//       legend: { display: false },
//     };

//     return () =>
//       h(Line, {
//         chartData,
//         chartOptions,

//         chartId: props.chartId,
//         width: props.width,
//         height: props.height,
//         cssClasses: props.cssClasses,
//         styles: props.styles,
//         plugins: props.plugins,
//       });
//   },

// });
