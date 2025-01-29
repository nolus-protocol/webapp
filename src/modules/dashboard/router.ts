import type { RouteRecordRaw } from "vue-router";
import { RouteNames } from "@/router/RouteNames";
import { AssetsDialog } from "../assets/enums";

export const DashboardRouter: RouteRecordRaw = {
  path: "",
  name: RouteNames.DASHBOARD,
  component: () => import("./view.vue"),
  meta: {
    key: RouteNames.DASHBOARD,
    title: "Nolus Protocol - Portfolio Dashboard",
    description: "A comprehensive interface offering insights and management tools for your activities on Nolus"
  },
  children: [
    {
      path: ":tab",
      component: () => import("../assets/components/TransferDialog.vue"),
      beforeEnter: (to, from, next) => {
        console.log("enter");
        const validTabs = Object.values(AssetsDialog);
        if (validTabs.includes(to.params.tab as AssetsDialog)) {
          next();
        } else {
          next({ path: "/" }); // Redirect to home if tab is not valid
        }
      },
      meta: {
        key: RouteNames.DASHBOARD
      }
    }
  ]
};
