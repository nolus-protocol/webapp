import { Web3AuthNoModal } from "@web3auth/no-modal";
import { CHAIN_NAMESPACES } from "@web3auth/base";
import { OpenloginAdapter } from "@web3auth/openlogin-adapter";
import { NETWORKS } from "@/config/env";
import { EnvNetworkUtils } from "./EnvNetworkUtils";

const configurations =
  NETWORKS[EnvNetworkUtils.getStoredNetworkName()]?.web3auth;

const clientId = configurations?.clientId;

export class Web3AuthProvider {
  web3auth: Web3AuthNoModal;
  adapter: OpenloginAdapter;

  private static instance: Web3AuthProvider | null;

  private constructor() {
    this.web3auth = new Web3AuthNoModal({
      clientId,
      chainConfig: {
        chainNamespace: CHAIN_NAMESPACES.OTHER,
        displayName: "Nolus",
        ticker: "NLS",
        tickerName: "NOLUS",
      },
    });
    this.adapter = new OpenloginAdapter({
      adapterSettings: {
        network: configurations.network,
        clientId,
        uxMode: "redirect",
        redirectUrl: `${window.location.origin}/auth/google`,
        loginConfig: {
          google: configurations.google,
        },
      },
    });

    this.web3auth.configureAdapter(this.adapter);
  }

  public static async getInstance() {
    const instance = Web3AuthProvider.instance;
    if (!Web3AuthProvider.instance) {
      Web3AuthProvider.instance = new Web3AuthProvider();
      await Web3AuthProvider.instance.web3auth.init();
    }
    return Web3AuthProvider.instance;
  }

  public async connect() {
    await Web3AuthProvider.instance?.web3auth.connectTo(this.adapter.name, {
      loginProvider: "google",
    });
  }

  public static async logout() {
    const instance = Web3AuthProvider.instance!;
    await instance?.web3auth?.logout({ cleanup: true });
    Web3AuthProvider.instance = null;
  }
}
