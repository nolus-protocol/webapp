import MainLayoutView from "@/views/MainLayoutView.vue";
import { WalletManager, WalletUtils } from "@/utils";
import { RouteNames } from "@/router/RouterNames";
import { useWalletStore } from "@/stores/wallet";
import { WalletConnectMechanism } from "@/types";

import { createRouter, createWebHistory, type NavigationGuardNext, type RouteLocationNormalized } from "vue-router";
import { ApplicationActionTypes, useApplicationStore } from "@/stores/application";
import { setLang } from "@/i18n";
import { AppUtils } from "@/utils/AppUtils";
import { AdminActionTypes, useAdminStore } from "@/stores/admin";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: MainLayoutView,
      beforeEnter: [loadLanguage, checkWalletName, loadData],
      children: [
        {
          path: "",
          name: RouteNames.DASHBOARD,
          component: () => import("@/views/DashboardView.vue"),
          meta: {
            title: 'Nolus Protocol - Portfolio Dashboard',
            description: 'A comprehensive interface offering insights and management tools for your activities on Nolus'
          }
        },
        {
          path: "/lease",
          name: RouteNames.LEASE,
          component: () => import("@/views/LeaseView.vue"),
          meta: {
            title: 'Nolus Protocol - Lease Positions',
            description: 'Explore lease positions with the Nolus Protocol. Streamline tracking, management, and insights for your leasing activities'
          }
        },
        {
          path: "/earn",
          name: RouteNames.EARN,
          component: () => import("@/views/EarningsView.vue"),
          meta: {
            title: 'Nolus Protocol - Earn',
            description: 'Maximize your earnings with Nolus Protocol. Discover opportunities, manage assets, and grow your portfolio effortlessly'
          }
        },
        {
          path: "/history",
          name: RouteNames.HISTORY,
          component: () => import("@/views/HistoryView.vue"),
          meta: {
            title: 'Nolus Protocol - Transaction History',
            description: 'Review your activity on the Nolus Protocol. Access detailed records and insights of all your past transactions'
          }
        },
        {
          path: "/vote",
          name: RouteNames.VOTE,
          component: () => import("@/views/VoteView.vue"),
          meta: {
            title: 'Nolus Protocol - Vote',
            description: ''
          }
        },
        {
          path: "/stats",
          name: RouteNames.STATS,
          component: () => import("@/views/StatsView.vue"),
          meta: {
            title: 'Nolus Protocol - Stats',
            description: 'Examine the stability and health of the Nolus Protocol. Access vital stats and metrics to ensure optimal performance and reliability'
          }
        },
      ],
    },
    {
      path: "/auth",
      component: () => import("@/views/AuthView.vue"),
      beforeEnter: [loadLanguage],
      children: [
        {
          path: "",
          name: RouteNames.AUTH,
          component: () => import("@/views/AuthSelectView.vue"),
          meta: {
            title: 'Nolus Protocol',
            description: 'Nolus Protocol is a Web3 financial suite that offers an innovative approach to money markets with a novel lease solution to further develop the DeFi space'
          }
        },
        {
          path: "import-seed",
          name: RouteNames.IMPORT_SEED,
          component: () => import("@/views/ImportSeedView.vue"),
          meta: {
            title: 'Nolus Protocol',
            description: 'Nolus Protocol is a Web3 financial suite that offers an innovative approach to money markets with a novel lease solution to further develop the DeFi space'
          }
        },
        {
          path: "create-account",
          name: RouteNames.CREATE_ACCOUNT,
          component: () => import("@/views/CreateAccountView.vue"),
          meta: {
            title: 'Nolus Protocol',
            description: 'Nolus Protocol is a Web3 financial suite that offers an innovative approach to money markets with a novel lease solution to further develop the DeFi space'
          }
        },
        {
          path: "set-password",
          name: RouteNames.SET_PASSWORD,
          component: () => import("@/views/SetPassword.vue"),
          meta: {
            title: 'Nolus Protocol',
            description: 'Nolus Protocol is a Web3 financial suite that offers an innovative approach to money markets with a novel lease solution to further develop the DeFi space'
          },
          beforeEnter: checkWallet,
        },
        {
          path: "set-wallet-name",
          name: RouteNames.SET_WALLET_NAME,
          component: () => import("@/views/SetWalletName.vue"),
          meta: {
            title: 'Nolus Protocol',
            description: 'Nolus Protocol is a Web3 financial suite that offers an innovative approach to money markets with a novel lease solution to further develop the DeFi space'
          },
          beforeEnter: beforeWalletName,
        },
        {
          path: "connecting-to-keplr",
          name: RouteNames.CONNECT_KEPLR,
          component: () => import("@/views/ConnectingKeplr.vue"),
          meta: {
            title: 'Nolus Protocol',
            description: 'Nolus Protocol is a Web3 financial suite that offers an innovative approach to money markets with a novel lease solution to further develop the DeFi space'
          }
        },
        {
          path: "connecting-to-leap",
          name: RouteNames.CONNECT_LEAP,
          component: () => import("@/views/ConnectingLeap.vue"),
          meta: {
            title: 'Nolus Protocol',
            description: 'Nolus Protocol is a Web3 financial suite that offers an innovative approach to money markets with a novel lease solution to further develop the DeFi space'
          }
        },
        {
          path: "import-ledger",
          name: RouteNames.IMPORT_LEDGER,
          component: () => import("@/views/ImportLedgerView.vue"),
          meta: {
            title: 'Nolus Protocol',
            description: 'Nolus Protocol is a Web3 financial suite that offers an innovative approach to money markets with a novel lease solution to further develop the DeFi space'
          }
        },
        {
          path: "google",
          component: () => import("@/views/GoogleAuthView.vue"),
          meta: {
            title: 'Nolus Protocol',
            description: 'Nolus Protocol is a Web3 financial suite that offers an innovative approach to money markets with a novel lease solution to further develop the DeFi space'
          },
        },
      ],
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

  await setLang(AppUtils.getLang().key);
  return next();

}

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
    case WalletConnectMechanism.MNEMONIC: {
      const name = WalletManager.getWalletName() ?? "";
      if (name.length == 0) {
        return next("/auth/set-wallet-name");
      }
      break;
    }
    case WalletConnectMechanism.GOOGLE: {
      const name = WalletManager.getWalletName() ?? "";
      if (name.length == 0) {
        return next("/auth/set-wallet-name");
      }
      break;
    }
  }

  next();
}

async function loadData() {
  const app = useApplicationStore();
  const admin = useAdminStore();

  await app[ApplicationActionTypes.CHANGE_NETWORK](false);
  await Promise.all([
    app[ApplicationActionTypes.LOAD_CURRENCIES](),
    admin[AdminActionTypes.GET_PROTOCOLS](),
  ]);
}

router.beforeEach((to, from, next) => {
  const description: HTMLElement | null = document.querySelector('meta[name="description"]');
  window.document.title = to.meta.title as string;
  if (description) {
    description.setAttribute('content', to.meta.description as string);
  }

  next();
});

export default router;
