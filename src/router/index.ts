import MainLayoutView from '@/views/MainLayoutView.vue';
import DashboardViewVue from '@/views/DashboardView.vue';
import { WalletUtils } from '@/utils';
import { createRouter, createWebHistory, type NavigationGuardNext, type RouteLocationNormalized } from 'vue-router';
import { RouteNames } from '@/router/RouterNames';
import { useWalletStore } from '@/stores/wallet';
import { WalletManager } from '@/wallet/WalletManager';
import { WalletConnectMechanism } from '@/types';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: MainLayoutView,
      meta: { requiresAuth: true },
      beforeEnter: [removeHash, checkWalletName],
      children: [
        {
          path: '',
          name: RouteNames.DASHBOARD,
          component: DashboardViewVue,
        },
        {
          path: '/lease',
          name: RouteNames.LEASE,
          component: () => import('@/views/LeaseView.vue'),
        },
        {
          path: '/earn',
          name: RouteNames.EARN,
          component: () => import('@/views/EarningsView.vue'),
        },
        {
          path: '/history',
          name: RouteNames.HISTORY,
          component: () => import('@/views/HistoryView.vue'),
        },
      ],
    },
    {
      path: '/auth',
      component: () => import('@/views/AuthView.vue'),
      beforeEnter: removeHash,
      children: [
        {
          path: '',
          name: RouteNames.AUTH,
          component: () => import('@/views/AuthSelectView.vue'),
        },
        {
          path: 'import-seed',
          name: RouteNames.IMPORT_SEED,
          component: () => import('@/views/ImportSeedView.vue'),
        },
        {
          path: 'create-account',
          name: RouteNames.CREATE_ACCOUNT,
          component: () => import('@/views/CreateAccountView.vue'),
        },
        {
          path: 'set-password',
          name: RouteNames.SET_PASSWORD,
          component: () => import('@/views/SetPassword.vue'),
          beforeEnter: checkWallet,
        },
        {
          path: 'set-wallet-name',
          name: RouteNames.SET_WALLET_NAME,
          component: () => import('@/views/SetWalletName.vue'),
          beforeEnter: beforeWalletName,
        },
        {
          path: 'connecting-to-keplr',
          name: RouteNames.CONNECT_KEPLR,
          component: () => import('@/views/ConnectingKeplr.vue'),
        },
        {
          path: 'import-ledger',
          name: RouteNames.IMPORT_LEDGER,
          component: () => import('@/views/ImportLedgerView.vue'),
        },
        {
          path: 'google',
          component: () => import('@/views/GoogleAuthView.vue'),
          beforeEnter: removeHash,
        },
      ],
    },
    {
      path: '/styleguide',
      component: () => import('@/views/StyleguideView.vue'),
    },
    {
      path: '/:pathMatch(.*)',
      redirect: '/',
    },
  ],
});

router.beforeEach((to) => {
  const isAuth = WalletUtils.isAuth();
  if (to.meta.requiresAuth && !isAuth) {
    return {
      path: '/auth',
    };
  }
});

function checkWallet(to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) {
  const wallet = useWalletStore();
  if (!wallet.privateKey || !wallet.wallet) {
    return next('/auth');
  }
  next();
}

function beforeWalletName(to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) {

  switch (WalletManager.getWalletConnectMechanism()) {
    case (WalletConnectMechanism.EXTENSION): {
      break;
    }
    default: {
      const isAuth = WalletUtils.isAuth();
      if (!isAuth) {
        return next('/auth');
      }
    }
  }

  next();
}

function checkWalletName(to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) {

  switch (WalletManager.getWalletConnectMechanism()) {
    case (WalletConnectMechanism.EXTENSION): {
      break;
    }
    default: {
      const name = WalletManager.getWalletName() ?? '';
      if (name.length == 0) {
        return next('/auth/set-wallet-name');
      }
    }
  }

  next();
}

function removeHash(to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) {
  if (to.hash.length > 0) {
    return next(to.path);
  }
  next();
}

export default router;
