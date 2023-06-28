import MainLayoutView from "@/views/MainLayoutView.vue";
import { WalletUtils, WalletManager } from "@/utils";
import { RouteNames } from "@/router/RouterNames";
import { useWalletStore } from "@/stores/wallet";
import { WalletConnectMechanism } from "@/types";

import { createRouter, createWebHistory, type NavigationGuardNext, type RouteLocationNormalized } from "vue-router";
import { ApplicationActionTypes, useApplicationStore } from "@/stores/application";
import { setLang } from "@/i18n";
import { ApptUtils } from "@/utils/AppUtils";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: MainLayoutView,
      meta: { requiresAuth: true },
      beforeEnter: [loadLanguage, removeHash, checkWalletName, loadData],
      children: [
        {
          path: "",
          name: RouteNames.DASHBOARD,
          component: () => import("@/views/DashboardView.vue"),
        },
        {
          path: "/lease",
          name: RouteNames.LEASE,
          component: () => import("@/views/LeaseView.vue"),
        },
        {
          path: "/earn",
          name: RouteNames.EARN,
          component: () => import("@/views/EarningsView.vue"),
        },
        {
          path: "/history",
          name: RouteNames.HISTORY,
          component: () => import("@/views/HistoryView.vue"),
        },
      ],
    },
    {
      path: "/auth",
      component: () => import("@/views/AuthView.vue"),
      beforeEnter: [loadLanguage, removeHash],
      children: [
        {
          path: "",
          name: RouteNames.AUTH,
          component: () => import("@/views/AuthSelectView.vue"),
        },
        {
          path: "import-seed",
          name: RouteNames.IMPORT_SEED,
          component: () => import("@/views/ImportSeedView.vue"),
        },
        {
          path: "create-account",
          name: RouteNames.CREATE_ACCOUNT,
          component: () => import("@/views/CreateAccountView.vue"),
        },
        {
          path: "set-password",
          name: RouteNames.SET_PASSWORD,
          component: () => import("@/views/SetPassword.vue"),
          beforeEnter: checkWallet,
        },
        {
          path: "set-wallet-name",
          name: RouteNames.SET_WALLET_NAME,
          component: () => import("@/views/SetWalletName.vue"),
          beforeEnter: beforeWalletName,
        },
        {
          path: "connecting-to-keplr",
          name: RouteNames.CONNECT_KEPLR,
          component: () => import("@/views/ConnectingKeplr.vue"),
        },
        {
          path: "connecting-to-leap",
          name: RouteNames.CONNECT_LEAP,
          component: () => import("@/views/ConnectingLeap.vue"),
        },
        {
          path: "import-ledger",
          name: RouteNames.IMPORT_LEDGER,
          component: () => import("@/views/ImportLedgerView.vue"),
        },
        {
          path: "google",
          component: () => import("@/views/GoogleAuthView.vue"),
          beforeEnter: removeHash,
        },
      ],
    },
    {
      path: "/styleguide",
      component: () => import("@/views/StyleguideView.vue"),
    },
    {
      path: "/:pathMatch(.*)",
      redirect: "/",
    },
  ],
});

async function loadLanguage(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext) {

  await setLang(ApptUtils.getLang().key);
  return next();
  
}

router.beforeEach((to) => {
  const isAuth = WalletUtils.isAuth();
  if (to.meta.requiresAuth && !isAuth) {
    return {
      path: "/auth",
    };
  }
});

function checkWallet(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  const wallet = useWalletStore();
  if (!wallet.privateKey || !wallet.wallet) {
    return next("/auth");
  }
  next();
}

function beforeWalletName(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  switch (WalletManager.getWalletConnectMechanism()) {
    case WalletConnectMechanism.EXTENSION: {
      break;
    }
    case WalletConnectMechanism.LEAP: {
      break;
    }
    default: {
      const isAuth = WalletUtils.isAuth();
      if (!isAuth) {
        return next("/auth");
      }
    }
  }

  next();
}

function checkWalletName(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  switch (WalletManager.getWalletConnectMechanism()) {
    case WalletConnectMechanism.EXTENSION: {
      break;
    }
    case WalletConnectMechanism.LEAP: {
      break;
    }
    case WalletConnectMechanism.LEDGER: {
      break;
    }
    case WalletConnectMechanism.LEDGER_BLUETOOTH: {
      break;
    }
    default: {
      const name = WalletManager.getWalletName() ?? "";
      if (name.length == 0) {
        return next("/auth/set-wallet-name");
      }
    }
  }

  next();
}

function removeHash(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  if (to.hash.length > 0) {
    return next(to.path);
  }
  next();
}

async function loadData() {
  const app = useApplicationStore();
  await app[ApplicationActionTypes.CHANGE_NETWORK](false);
  await app[ApplicationActionTypes.LOAD_CURRENCIES]();
}

export default router;
