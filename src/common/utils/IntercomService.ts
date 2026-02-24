import { INTERCOM_API } from "@/config/global";
import { boot, Intercom as messenger, shutdown, update } from "@intercom/messenger-js-sdk";
import { BackendApi } from "@/common/api";

/**
 * Centralized Intercom Service
 *
 * All user attributes are computed server-side and embedded in signed JWT tokens.
 * The frontend only handles SDK lifecycle: load, disconnect.
 *
 * Flow:
 * 1. Frontend calls load(wallet, walletType) on wallet connect
 * 2. Backend fetches all portfolio data, builds attributes, signs JWT
 * 3. Signed JWT is passed to Intercom via boot()/messenger()
 * 4. Frontend calls disconnect() on wallet disconnect
 */
class IntercomServiceClass {
  private loaded = false;
  private currentWallet: string | null = null;

  /**
   * Initialize Intercom for a user.
   * The backend computes all portfolio attributes and returns a signed JWT.
   */
  async load(wallet: string, walletType: string): Promise<boolean> {
    try {
      this.currentWallet = wallet;

      const data = await BackendApi.getIntercomToken(wallet, walletType);

      const baseData = {
        app_id: INTERCOM_API,
        api_base: "https://api-iam.intercom.io",
        user_id: wallet,
        intercom_user_jwt: data.token
      };

      if (this.loaded) {
        boot(baseData);
      } else {
        messenger(baseData);
        this.loaded = true;
      }

      return true;
    } catch (e) {
      console.error("[IntercomService] Failed to load:", e);
      return false;
    }
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    shutdown();
    this.loaded = false;
    this.currentWallet = null;

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Check if Intercom is loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get current wallet address
   */
  getCurrentWallet(): string | null {
    return this.currentWallet;
  }
}

// Export singleton instance
export const IntercomService = new IntercomServiceClass();
