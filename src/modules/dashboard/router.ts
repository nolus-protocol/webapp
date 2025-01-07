import type { RouteRecordRaw } from "vue-router";
import { RouteNames } from "@/router/RouteNames";

export const DashboardRouter: RouteRecordRaw = {
  path: "",
  name: RouteNames.DASHBOARD,
  component: () => import("./view.vue"),
  meta: {
    key: RouteNames.DASHBOARD,
    title: "Nolus Protocol - Portfolio Dashboard",
    description: "A comprehensive interface offering insights and management tools for your activities on Nolus"
  }
};
