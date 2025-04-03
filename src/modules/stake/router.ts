import type { RouteRecordRaw } from "vue-router";
import { RouteNames } from "@/router/RouteNames";
import { StakeDialog } from "@/modules/stake/enums";

export const StakeRouter: RouteRecordRaw = {
  path: `/${RouteNames.STAKE}`,
  name: RouteNames.STAKE,
  component: () => import("./view.vue"),
  children: [
    {
      path: ":tab",
      name: "",
      component: () => import("./components/StakeDialog.vue"),
      meta: {
        key: RouteNames.STAKE
      },
      beforeEnter: (to, from, next) => {
        const validTabs = Object.values(StakeDialog);
        if (validTabs.includes(to.params.tab as StakeDialog)) {
          next();
        } else {
          next({ path: "/" }); // Redirect to home if tab is not valid
        }
      }
    }
  ],
  meta: {
    title: "Nolus Protocol - Portfolio Dashboard",
    description: "A comprehensive interface offering insights and management tools for your activities on Nolus",
    key: RouteNames.STAKE
  }
};
