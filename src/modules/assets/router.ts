import type { RouteRecordRaw } from "vue-router";
import { RouteNames } from "@/router/RouteNames";
import { AssetsDialog } from "@/modules/assets/enums";
import { isEnumValue } from "@/common/utils/typeGuards";

export const AssetsRouter: RouteRecordRaw = {
  path: `/${RouteNames.ASSETS}`,
  name: RouteNames.ASSETS,
  component: () => import("./view.vue"),
  meta: {
    key: RouteNames.ASSETS,
    title: "Nolus Protocol - Portfolio Assets",
    description: "A comprehensive interface offering insights and management tools for your activities on Nolus"
  },
  children: [
    {
      path: ":tab",
      component: () => import("./components/TransferDialog.vue"),
      beforeEnter: (to, from, next) => {
        if (isEnumValue(AssetsDialog, to.params.tab)) {
          next();
        } else {
          next({ path: "/" }); // Redirect to home if tab is not valid
        }
      },
      meta: {
        key: RouteNames.ASSETS
      }
    }
  ]
};
