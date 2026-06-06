import type { RouteRecordRaw } from "vue-router";
import { RouteNames } from "@/router/RouteNames";
import { StakeDialog } from "@/modules/stake/enums";
import { isEnumValue } from "@/common/utils/typeGuards";

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
        if (isEnumValue(StakeDialog, to.params.tab)) {
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
