import { test as t1Test, expect } from "../t1/support.js";
import type { T1Options } from "../t1/support.js";
import { parseT2Config } from "../config.js";
import { createWalletIdentity } from "../signer.js";
import type { WalletIdentity } from "../signer.js";
import { installKeplrStub } from "./keplr.js";

export type WalletSelection = "primary" | "secondary";

export interface T2Options extends T1Options {
  walletIdentity: WalletSelection;
}

export interface T2Fixtures {
  wallet: WalletIdentity;
}

function selectMnemonic(selection: WalletSelection): string {
  const parsed = parseT2Config(process.env);
  if (!parsed.ok) {
    throw new Error(`E2E T2 configuration error:\n  - ${parsed.errors.join("\n  - ")}`);
  }
  return selection === "secondary" ? parsed.config.secondaryMnemonic : parsed.config.primaryMnemonic;
}

/**
 * T2 reuses the T1 `budget` fixture verbatim — the same console/pageerror/failed-request
 * and `/ws` collectors and the same clean-budget assertion. A wallet-connected page fetches
 * its balances once on connect (a same-origin `200`) and opens a `balances` WS subscription
 * on the existing `/ws` socket; neither trips the T1 budget, so no relaxation is needed.
 *
 * The `wallet` fixture derives the selected identity in Node and installs the scripted
 * `window.keplr` before the SPA boots. `walletIdentity` is a fixture option so a spec can
 * switch to the secondary account with `test.use({ walletIdentity: "secondary" })`.
 */
export const test = t1Test.extend<T2Options & T2Fixtures>({
  walletIdentity: ["primary", { option: true }],
  wallet: async ({ page, walletIdentity }, use) => {
    const identity = await createWalletIdentity(selectMnemonic(walletIdentity));
    await installKeplrStub(page, identity);
    await use(identity);
  }
});

export { expect };
