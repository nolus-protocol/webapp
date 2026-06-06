import type { RouteRecordRaw } from "vue-router";
import { RouteNames } from "@/router/RouteNames";
import { EarnAssetsDialog } from "./enums";
import { isEnumValue } from "@/common/utils/typeGuards";

export const EarnRouter: RouteRecordRaw = {
  path: `/${RouteNames.EARN}`,
  name: RouteNames.EARN,
  component: () => import("./view.vue"),
  children: [
    {
      path: ":tab",
      component: () => import("./components/EarnAssetsDialog.vue"),
      beforeEnter: (to, from, next) => {
        if (isEnumValue(EarnAssetsDialog, to.params.tab)) {
          next();
        } else {
          next({ path: "/" }); // Redirect to home if tab is not valid
        }
      },
      meta: {
        key: RouteNames.EARN
      }
    }
  ],
  meta: {
    title: "Nolus Protocol - Earn",
    key: RouteNames.EARN,
    description:
      "Maximize your earnings with Nolus Protocol. Discover opportunities, manage assets, and grow your portfolio effortlessly"
  }
};
