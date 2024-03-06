import type { RouteRecordRaw } from "vue-router";
import { RouteNames } from "@/router/RouteNames";

export const HistoryRouter: RouteRecordRaw = {
  path: `/${RouteNames.HISTORY}`,
  name: RouteNames.HISTORY,
  component: () => import("./view.vue"),
  meta: {
    title: "Nolus Protocol - Transaction History",
    description:
      "Review your activity on the Nolus Protocol. Access detailed records and insights of all your past transactions"
  }
};
