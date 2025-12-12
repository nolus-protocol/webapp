import "./polyfills";
import "@/index.scss";
import "@/assets/styles/global.scss";

import { createPinia } from "pinia";
import { setupI18n } from "@/i18n";
import { router } from "@/router";
import { createSSRApp, createApp as createClientApp } from "vue";
import { Mode } from "./config/global";
import App from "@/App.vue";
import type { IObjectKeys } from "./common/types";

if (import.meta.env.VITE_MODE == Mode.prod && !import.meta.env.SSR) {
  console.log = () => null;
}

export const createApp = (data: IObjectKeys) => {
  const isServer = import.meta.env.SSR;
  const app = (isServer ? createSSRApp : createClientApp)(App);
  app.provide("ssrContext", data);

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
