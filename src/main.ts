import App from './App.vue'
import router from '@/router'
import { createApp } from 'vue'
import '@/index.css'
import '@/assets/styles/global.scss'
import { store } from '@/store'

const app = createApp(App)
app
  .use(store)
  .use(router)
  .mount('#app')

// app.config.errorHandler = (err, instance, info) => {
//   console.log('error handling: ', err, ' instance: ', instance)
//   console.log(' instance: ', instance)
// }
