import { INTERCOM_API, isDev } from "@/config/global";
import { boot, Intercom as messenger, shutdown, update } from "@intercom/messenger-js-sdk";

export class Intercom {
  private static loaded = false;
  public static load(wallet: string) {
    if (!isDev()) {
      return;
    }
    if (Intercom.loaded) {
      return Intercom.boot(wallet);
    }
    messenger({
      app_id: INTERCOM_API,
      user_id: wallet
    });
    Intercom.loaded = true;
  }

  public static update(data = {}) {
    if (Intercom.loaded) {
      update(data);
    }
  }

  public static disconnect() {
    shutdown();
  }

  private static boot(wallet: string) {
    boot({
      app_id: INTERCOM_API, // Workplace ID
      user_id: wallet // User's wallet address
    });
  }
}
