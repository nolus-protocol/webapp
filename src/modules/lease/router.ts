import type { RouteRecordRaw } from "vue-router";
import { RouteNames } from "@/router/RouteNames";

export const LeaseRouter: RouteRecordRaw = {
  path: `/${RouteNames.LEASE}`,
  name: RouteNames.LEASE,
  component: () => import("./view.vue"),
  meta: {
    title: "Nolus Protocol - Lease Positions",
    description:
      "Explore lease positions with the Nolus Protocol. Streamline tracking, management, and insights for your leasing activities"
  }
};
