import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES } from "@web3auth/base";
import { OpenloginAdapter } from "@web3auth/openlogin-adapter";

const clientId = "BLHKuWj_YEP5D5I0HZoz1w6QmL6wHjY_DHlzntAx9_g6tp9RlOFUDwyIeqReRpmLBK2pJ4AfbgoMfAXmjnHtwRA"

export class Web3AuthProvider {

  web3auth!: Web3Auth;
  adapter!: OpenloginAdapter;

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
    this.adapter = new OpenloginAdapter({ adapterSettings: {
      network: "testnet",
      clientId,
      uxMode: "redirect", // other option: popup
      loginConfig: {
        google: {
          name: "Nolus",
          verifier: "nolus",
          typeOfLogin: "google",
          clientId: "408160298134-e8ul2n0p1ka3fe01oalnodb2l6fs9nb6.apps.googleusercontent.com",
    
        },
      },
    }});
    this.web3auth.configureAdapter(this.adapter);

  }

  public static async getInstance() {
    if (!Web3AuthProvider.instance) {
      Web3AuthProvider.instance = new Web3AuthProvider();
      await Web3AuthProvider.instance.web3auth.init();
    }
    return Web3AuthProvider.instance;
  }

  public async open() {
    await Web3AuthProvider.instance.web3auth.connectTo(this.adapter.name, {loginProvider: "google"});;
  }

}