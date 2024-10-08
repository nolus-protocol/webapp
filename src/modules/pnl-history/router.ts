import type { RouteRecordRaw } from "vue-router";
import { RouteNames } from "@/router/RouteNames";

export const PnlHistoryRouter: RouteRecordRaw = {
  path: `/${RouteNames["PNL-HISTORY"]}`,
  name: RouteNames["PNL-HISTORY"],
  component: () => import("./view.vue"),
  meta: {
    title: "Nolus Protocol - PNL History",
    description:
      "Review your activity on the Nolus Protocol. Access detailed records and insights of all your past loans"
  }
};
