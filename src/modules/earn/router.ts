import type { RouteRecordRaw } from "vue-router";
import { RouteNames } from "@/router/RouteNames";
import { EarnAssetsDialog } from "./enums";

export const EarnRouter: RouteRecordRaw = {
  path: `/${RouteNames.EARN}`,
  name: RouteNames.EARN,
  component: () => import("./view.vue"),
  children: [
    {
      path: ":tab",
      component: () => import("./components/EarnAssetsDialog.vue"),
      beforeEnter: (to, from, next) => {
        const validTabs = Object.values(EarnAssetsDialog);
        if (validTabs.includes(to.params.tab as EarnAssetsDialog)) {
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
