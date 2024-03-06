import type { RouteRecordRaw } from "vue-router";
import { RouteNames } from "@/router/RouteNames";

export const EarnRouter: RouteRecordRaw = {
  path: `/${RouteNames.EARN}`,
  name: RouteNames.EARN,
  component: () => import("./view.vue"),
  meta: {
    title: "Nolus Protocol - Earn",
    description:
      "Maximize your earnings with Nolus Protocol. Discover opportunities, manage assets, and grow your portfolio effortlessly"
  }
};
