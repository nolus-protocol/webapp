import App from './App.vue'
import router from './router'
import store from './store'
import { createApp } from 'vue'

import '@/index.css'
import '@/assets/styles/global.scss'

createApp(App)
  .use(store)
  .use(router)
  .mount('#app')
