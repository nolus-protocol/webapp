import type { RouteRecordRaw } from "vue-router";
import { RouteNames } from "@/router/RouteNames";

export const StatsRouter: RouteRecordRaw = {
  path: `/${RouteNames.STATS}`,
  name: RouteNames.STATS,
  component: () => import("./view.vue"),
  meta: {
    title: "Nolus Protocol - Stats",
    key: RouteNames.STATS,
    description:
      "Examine the stability and health of the Nolus Protocol. Access vital stats and metrics to ensure optimal performance and reliability"
  }
};
