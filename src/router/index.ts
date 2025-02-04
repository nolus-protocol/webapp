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

const router = createRouter({
  scrollBehavior(to, from, position) {
    if (to.meta.key == from.meta.key) {
      return false;
    }
    return restoreScroll(position);
  },
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: MainLayout,
      beforeEnter: [loadLanguage, loadData],
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

let lastPromise: Promise<{ top: number; behavior: string }> | any;
let timeOut: NodeJS.Timeout | null;
let reject: Function;

function restoreScroll(position: { behavior?: ScrollOptions["behavior"]; left: number; top: number } | null) {
  if (timeOut) {
    clearTimeout(timeOut);
    timeOut = null;
  }

  lastPromise = new Promise((resolve, r) => {
    reject = r;
    timeOut = setTimeout(() => {
      timeOut = null;
      resolve({ top: position?.top ?? 0, behavior: "instant" });
    }, 350);
  }).catch((e) => {});

  return lastPromise;
}

window.addEventListener(
  "scroll",
  () => {
    if (timeOut) {
      reject?.();
      clearTimeout(timeOut);
      timeOut = null;
    }
  },
  { passive: true }
);

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

export { router, RouteNames };
