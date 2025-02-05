import type { RouteRecordRaw } from "vue-router";
import { RouteNames } from "@/router/RouteNames";

export const LeasesRouter: RouteRecordRaw = {
  path: `/${RouteNames.LEASES}`,
  component: () => import("./view.vue"),
  children: [
    {
      path: "",
      name: RouteNames.LEASES,
      component: () => import("./components/Leases.vue"),
      meta: {
        title: "Nolus Protocol - Lease Positions",
        key: RouteNames.LEASES,
        description:
          "Explore lease positions with the Nolus Protocol. Streamline tracking, management, and insights for your leasing activities"
      }
    },
    {
      path: `open`,
      name: `${RouteNames.LEASES}-open`,
      component: () => import("./components/NewLease.vue"),
      meta: {
        title: "Nolus Protocol - New Lease",
        key: `${RouteNames.LEASES}-open`
      },
      children: [
        {
          path: "long",
          meta: {
            key: `${RouteNames.LEASES}-open`,
            action: "long"
          },
          component: () => import("./components/new-lease/LongForm.vue")
        },
        {
          path: "short",
          meta: {
            key: `${RouteNames.LEASES}-open`,
            action: "short"
          },
          component: () => import("./components/new-lease/ShortForm.vue")
        }
      ]
    },
    {
      path: "pnl-log",
      name: `${RouteNames.LEASES}-pnl-log`,
      component: () => import("./components/PnlLog.vue"),
      meta: {
        title: "Nolus Protocol - Pnl log",
        key: `${RouteNames.LEASES}-pnl-log`,
        description:
          "Explore lease positions with the Nolus Protocol. Streamline tracking, management, and insights for your leasing activities"
      }
    },
    {
      path: `:protocol/:id`,
      name: `${RouteNames.LEASES}-single`,
      component: () => import("./components/SingleLease.vue"),
      meta: {
        title: "Nolus Protocol - Single Lease",
        key: `${RouteNames.LEASES}-single`
      },
      children: [
        {
          path: "repay",
          meta: {
            key: `${RouteNames.LEASES}-single`
          },
          component: () => import("./components/single-lease/RepayDialog.vue")
        },
        {
          path: "close",
          meta: {
            key: `${RouteNames.LEASES}-single`
          },
          component: () => import("./components/single-lease/CloseDialog.vue")
        },
        {
          path: "stop-loss",
          meta: {
            key: `${RouteNames.LEASES}-single`
          },
          component: () => import("./components/single-lease/StopLossDialog.vue")
        },
        {
          path: "take-profit",
          meta: {
            key: `${RouteNames.LEASES}-single`
          },
          component: () => import("./components/single-lease/TakeProfitDialog.vue")
        }
      ]
    }
  ]
};
