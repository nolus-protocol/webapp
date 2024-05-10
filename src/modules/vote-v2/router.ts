import type { RouteRecordRaw } from "vue-router";
import { RouteNames } from "@/router";

export const VoteRouter: RouteRecordRaw = {
  path: `/${RouteNames.VOTE}`,
  name: RouteNames.VOTE,
  component: () => import("./view.vue"),
  meta: {
    title: "Nolus Protocol - Votes",
    description: ""
  }
};
