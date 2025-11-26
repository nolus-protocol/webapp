import { createRouter, createWebHistory, type NavigationGuardNext, type RouteLocationNormalized } from "vue-router";
import { DashboardRouter } from "@/modules/dashboard/router";
import { EarnRouter } from "@/modules/earn/router";
import { AppUtils } from "@/common/utils";
import { setLang } from "@/i18n";
import { useWalletStore } from "@/common/stores/wallet";

import { ApplicationActions, useApplicationStore } from "@/common/stores/application";
import { StatsRouter } from "@/modules/stats/router";
import { LeasesRouter } from "@/modules/leases/router";
import { HistoryRouter } from "@/modules/history/router";
import { VoteRouter } from "@/modules/vote/router";
import { AssetsRouter } from "@/modules/assets/router";
import { StakeRouter } from "@/modules/stake/router";
import { RouteNames } from "./RouteNames";

import MainLayout from "@/modules/view.vue";
import { ChainConstants, NolusClient } from "@nolus/nolusjs";

const router = createRouter({
  scrollBehavior(to, from) {
    if (to.meta.key == from.meta.key) {
      return false;
    }
    if (to.hash.length > 0) {
      return scrollHash(to.hash);
    }
    return { top: 0 } as any;
  },
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: MainLayout,
      beforeEnter: [loadLanguage],
      children: [
        DashboardRouter,
        LeasesRouter,
        EarnRouter,
        HistoryRouter,
        VoteRouter,
        StatsRouter,
        AssetsRouter,
        StakeRouter
      ]
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

router.beforeEach((to, from, next) => {
  const description: HTMLElement | null = document.querySelector('meta[name="description"]');
  window.document.title = to.meta.title as string;
  if (description) {
    description.setAttribute("content", to.meta.description as string);
  }

  next();
});

router
  .isReady()
  .then(() => {
    preloadAllRoutes();
  })
  .catch((e) => console.error(e));

const preloadAllRoutes = () => {
  router.getRoutes().forEach((route) => {
    const preload = route.components?.default;
    if (preload instanceof Function) {
      (preload as Function)();
    }
  });
};

const scrollHash = (hash: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const element = document.querySelector(hash);
      if (element) {
        element.scrollIntoView({ inline: "end" });
        resolve(false);
      } else {
        resolve(false);
      }
    }, 375);
  });
};

export { router, RouteNames };
