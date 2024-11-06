import { createRouter, createWebHistory, type NavigationGuardNext, type RouteLocationNormalized } from "vue-router";
import { AssetsRouter } from "@/modules/dashboard/router";
import { EarnRouter } from "@/modules/earn/router";
import { AppUtils } from "@/common/utils";
import { setLang } from "@/i18n";

import { ApplicationActions, useApplicationStore } from "@/common/stores/application";
import { StatsRouter } from "@/modules/stats/router";
import { LeaseRouter } from "@/modules/lease/router";
import { HistoryRouter } from "@/modules/history/router";
import { VoteRouter } from "@/modules/vote/router";
import { RouteNames } from "./RouteNames";

import MainLayout from "@/modules/view.vue";
import { PnlHistoryRouter } from "@/modules/pnl-history/router";
import { useWalletStore } from "@/common/stores/wallet";

const router = createRouter({
  scrollBehavior(to, from, savedPosition) {
    if (to.hash.length == 0 && from.hash.length == 0) {
      return { top: 0, behavior: "instant" };
    }
  },
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: MainLayout,
      beforeEnter: [loadLanguage, loadData],
      children: [AssetsRouter, LeaseRouter, EarnRouter, HistoryRouter, VoteRouter, StatsRouter, PnlHistoryRouter]
    },
    {
      path: "/:pathMatch(.*)",
      redirect: "/"
    }
  ]
});

async function loadLanguage(to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) {
  await setLang(AppUtils.getLang().key);
  return next();
}

async function loadData() {
  const app = useApplicationStore();
  const wallet = useWalletStore();
  app[ApplicationActions.LOAD_THEME]();
  await Promise.all([app[ApplicationActions.CHANGE_NETWORK](), wallet.ignoreAssets()]);
}

router.beforeEach((to, from, next) => {
  const description: HTMLElement | null = document.querySelector('meta[name="description"]');
  window.document.title = to.meta.title as string;
  if (description) {
    description.setAttribute("content", to.meta.description as string);
  }

  next();
});

export { router, RouteNames };
