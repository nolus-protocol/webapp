import "./polyfills";

import { createPinia } from "pinia";
import { setupI18n } from "@/i18n";
import { router } from "@/router";
import { createApp } from "vue";
import { Mode } from "./config/global";
import App from "@/App.vue";

import "@/index.scss";
import "@/assets/styles/global.scss";
import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { AppUtils } from "./common/utils";
import { ApplicationActions, useApplicationStore } from "./common/stores/application";
import { useWalletStore } from "./common/stores/wallet";

if (import.meta.env.VITE_MODE == Mode.prod) {
  console.log = () => null;
}

async function bootstrap() {
  const app = createApp(App);

  app.use(createPinia());
  app.use(router);
  app.use(setupI18n());

  const rpc = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc;
  NolusClient.setInstance(rpc);

  app.mount("#app");
  await loadData();
}

async function loadData() {
  const app = useApplicationStore();
  const wallet = useWalletStore();
  app[ApplicationActions.LOAD_THEME]();
  await Promise.all([app[ApplicationActions.CHANGE_NETWORK](), wallet.ignoreAssets()]).catch((e) => console.error(e));
}

bootstrap().catch((e) => console.error(e));
