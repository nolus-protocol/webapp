import { createRouter, createWebHistory, type NavigationGuardNext, type RouteLocationNormalized } from "vue-router";
import { DashboardRouter } from "@/modules/dashboard/router";
import { EarnRouter } from "@/modules/earn/router";
import { getLanguage } from "@/common/utils/LanguageUtils";
import { setLang } from "@/i18n";

import { StatsRouter } from "@/modules/stats/router";
import { LeasesRouter } from "@/modules/leases/router";
import { HistoryRouter } from "@/modules/history/router";
import { VoteRouter } from "@/modules/vote/router";
import { AssetsRouter } from "@/modules/assets/router";
import { StakeRouter } from "@/modules/stake/router";
import { RouteNames } from "./RouteNames";

import MainLayout from "@/modules/view.vue";

const router = createRouter({
  scrollBehavior(to, from) {
    if (to.meta.key == from.meta.key) {
      return false;
    }
    if (to.hash.length > 0) {
      return scrollHash(to.hash);
    }
    return { top: 0 };
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
  const lang = getLanguage().key;
  await setLang(lang);
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

// After a deploy, already-open tabs still reference the old hashed JS chunks.
// Lazy-route imports for those old chunks 404, the navigation silently completes
// with no component mounted, and the user sees a blank main content area.
// Force a fresh document load so the new index.html + new chunk hashes are picked up.
const CHUNK_RELOAD_KEY = "nolus-chunk-reload-at";
const CHUNK_RELOAD_COOLDOWN_MS = 10_000;
const CHUNK_LOAD_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk \S+ failed/i
];

export function handleChunkLoadError(
  error: unknown,
  toPath: string | undefined,
  storage: Storage,
  now: number,
  reload: (path: string) => void
): void {
  if (!(error instanceof Error)) return;
  if (!CHUNK_LOAD_ERROR_PATTERNS.some((re) => re.test(error.message))) return;

  const last = Number(storage.getItem(CHUNK_RELOAD_KEY) ?? "0");
  if (now - last < CHUNK_RELOAD_COOLDOWN_MS) return;
  storage.setItem(CHUNK_RELOAD_KEY, String(now));

  reload(toPath ?? window.location.pathname);
}

router.onError((error, to) => {
  handleChunkLoadError(error, to?.fullPath, window.sessionStorage, Date.now(), (path) => window.location.assign(path));
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
    if (typeof preload === "function") {
      // Stale chunks after a deploy will reject here; don't pollute console —
      // the real navigation will trigger router.onError with the same error.
      Promise.resolve(preload()).catch(() => {});
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
