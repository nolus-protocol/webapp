import { INTERCOM_URL, INTERCOM_API, isServe } from "@/config/global";
import { boot, Intercom as messenger, shutdown, update } from "@intercom/messenger-js-sdk";

export class Intercom {
  private static loaded = false;
  public static async load(wallet: string) {
    if (isServe()) {
      return false;
    }
    try {
      if (Intercom.loaded) {
        return Intercom.boot(wallet);
      }
      const data = await Intercom.sign(wallet);
      messenger({
        app_id: INTERCOM_API,
        intercom_user_jwt: data.token,
        PositionsDetailes: `https://grafana9.nolus.network/d/ea14ddcc-73ed-4810-89be-fb5e035edee51/wallet-checker?orgId=1&var-walletAddress=${wallet}`
      });
      Intercom.loaded = true;
    } catch (e) {
      console.error(e);
    }
  }

  public static update(data = {}) {
    if (Intercom.loaded) {
      update(data);
    }
  }

  public static disconnect() {
    shutdown();
    Intercom.loaded = false;
  }

  private static boot(wallet: string) {
    boot({
      app_id: INTERCOM_API,
      user_id: wallet,
      PositionsDetailes: `https://grafana9.nolus.network/d/ea14ddcc-73ed-4810-89be-fb5e035edee51/wallet-checker?orgId=1&var-walletAddress=${wallet}`
    });
  }

  private static async sign(wallet: string): Promise<{ token: string }> {
    const data = await fetch(`${INTERCOM_URL}`, {
      method: "POST",
      body: JSON.stringify({ wallet }),
      headers: {
        "Content-Type": "application/json"
      }
    });

    return data.json();
  }
}
