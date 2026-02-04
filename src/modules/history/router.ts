import type { RouteRecordRaw } from "vue-router";
import { RouteNames } from "@/router/RouteNames";

export const HistoryRouter: RouteRecordRaw = {
  path: `/${RouteNames.HISTORY}`,
  component: () => import("./view.vue"),
  children: [
    {
      path: "",
      name: RouteNames.HISTORY,
      component: () => import("./components/History.vue"),
      meta: {
        title: "Nolus Protocol - Transaction History",
        key: RouteNames.HISTORY,
        description:
          "Review your activity on the Nolus Protocol. Access detailed records and insights of all your past transactions"
      }
    },
    {
      path: "pnl-log",
      name: `${RouteNames.HISTORY}-pnl-log`,
      component: () => import("@/modules/leases/components/PnlLog.vue"),
      meta: {
        title: "Nolus Protocol - Pnl log",
        key: `${RouteNames.HISTORY}-pnl-log`,
        description:
          "Explore lease positions with the Nolus Protocol. Streamline tracking, management, and insights for your leasing activities"
      }
    }
  ]
};
