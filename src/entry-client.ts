import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { createApp } from "./main";
import { AppUtils } from "./common/utils";
import { ApplicationActions, useApplicationStore } from "./common/stores/application";
import { useWalletStore } from "./common/stores/wallet";

const { app, router } = createApp({});

async function loadData() {
  const app = useApplicationStore();
  const wallet = useWalletStore();
  app[ApplicationActions.LOAD_THEME]();
  await Promise.all([app[ApplicationActions.CHANGE_NETWORK](), wallet.ignoreAssets()]).catch((e) => console.error(e));
}

async function bootstrap() {
  const rpc = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc;
  NolusClient.setInstance(rpc);

  app.mount("#app", true);
  await loadData();
}

router
  .isReady()
  .then(() => {
    return bootstrap();
  })
  .catch((e) => console.error(e));
