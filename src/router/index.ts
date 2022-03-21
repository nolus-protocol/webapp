// import { createRouter, createWebHistory, RouteRecordRaw } from ''
import HomeView from '../views/HomeView.vue'
import WelcomeView from '@/views/WelcomeView.vue'
import StyleguideView from '@/views/StyleguideView.vue'
import ImportLedgerView from '@/views/ImportLedgerView.vue'
import ConnectingKeplr from '@/views/ConnectingKeplr.vue'
import ImportSeedView from '@/views/ImportSeedView.vue'
import CreateAccountView from '@/views/CreateAccountView.vue'
import ConfirmMnemonicView from '@/views/ConfirmMnemonicView.vue'
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/welcome',
    name: 'welcome',
    component: WelcomeView
  },
  {
    path: '/styleguide',
    name: 'styleguide',
    component: StyleguideView
  },
  {
    path: '/import-ledger',
    name: 'importLedger',
    component: ImportLedgerView
  },
  {
    path: '/connecting-to-keplr',
    name: 'connectingKeprl',
    component: ConnectingKeplr
  },
  {
    path: '/import-seed',
    name: 'importSeedView',
    component: ImportSeedView
  },
  {
    path: '/create-account',
    name: 'createAccountView',
    component: CreateAccountView
  },
  {
    path: '/confirm-mnemonic',
    name: 'ConfirmMnemonicView',
    component: ConfirmMnemonicView
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

// router.beforeEach((to, from, next) => {
//   if (to.name !== 'welcome' && !localStorage.getItem('wallet_connect_via')) {
//     next({ name: 'welcome' })
//   } else {
//     next()
//   }
// })

export default router
