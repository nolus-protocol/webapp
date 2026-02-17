import "./polyfills";
import "@/index.scss";
import "@/assets/styles/global.scss";

import { createPinia } from "pinia";
import { setupI18n } from "@/i18n";
import { router } from "@/router";
import { createApp as createVueApp } from "vue";
import App from "@/App.vue";

export const createApp = () => {
  const app = createVueApp(App);
  const pinia = createPinia();

  app.use(router);
  app.use(pinia);
  app.use(setupI18n());

  return {
    app,
    router,
    pinia
  };
};
