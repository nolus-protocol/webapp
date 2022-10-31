import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES } from "@web3auth/base";
import { OpenloginAdapter } from "@web3auth/openlogin-adapter";
import { NETWORKS } from "@/config/env";
import { EnvNetworkUtils } from "./EnvNetworkUtils";

const configurations = NETWORKS[EnvNetworkUtils.getStoredNetworkName()].web3auth;

const clientId = configurations.clientId;

export class Web3AuthProvider {

  web3auth: Web3Auth;
  adapter: OpenloginAdapter;

  static instance: Web3AuthProvider;

  private constructor() {
    this.web3auth = new Web3Auth({
      clientId,
      chainConfig: {
        chainNamespace: CHAIN_NAMESPACES.OTHER,
        displayName: "Nolus",
        ticker: "NLS",
        tickerName: "NOLUS",
      },
      uiConfig: {
        loginMethodsOrder: ["google"]
      }
    });
    this.adapter = new OpenloginAdapter({
      adapterSettings: {
        network: "testnet",
        clientId,
        uxMode: "redirect",
        loginConfig: {
          google: configurations.google,
        },
      }
    });
    this.web3auth.configureAdapter(this.adapter);

  }

  public static async getInstance() {
    if (!Web3AuthProvider.instance) {
      Web3AuthProvider.instance = new Web3AuthProvider();
      await Web3AuthProvider.instance.web3auth.init();
    }
    return Web3AuthProvider.instance;
  }

  public async connect() {
    await Web3AuthProvider.instance.web3auth.connectTo(this.adapter.name, { loginProvider: "google" });;
  }

}