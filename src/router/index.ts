// import { createRouter, createWebHistory, RouteRecordRaw } from ''
import HomeView from '../views/HomeView.vue'
import WelcomeView from '@/views/WelcomeView.vue'
import StyleguideView from '@/views/StyleguideView.vue'
import ImportLedgerView from '@/views/ImportLedgerView.vue'
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
