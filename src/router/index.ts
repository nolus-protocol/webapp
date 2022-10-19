import MainLayoutView from '@/views/MainLayoutView.vue';
import DashboardViewVue from '@/views/DashboardView.vue';
import { WalletUtils } from '@/utils';
import { createRouter, createWebHistory } from 'vue-router';
import { RouteNames } from '@/router/RouterNames';
import { useWalletStore } from '@/stores/wallet';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: MainLayoutView,
      meta: { requiresAuth: true },
      beforeEnter: (to, from, next) => {
        if (to.hash.length > 0) {
          return next(to.path);
        }
        next();
      },
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
      beforeEnter: (to, from, next) => {
        if (to.hash.length > 0) {
          return next(to.path);
        }
        next();
      },
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
          beforeEnter: (to, from, next) => {
            const wallet = useWalletStore();
            if (!wallet.privateKey || !wallet.wallet) {
              return next('/auth/import-seed');
            }
            next();
          },
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

export default router;
