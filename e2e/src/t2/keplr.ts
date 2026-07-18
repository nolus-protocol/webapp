import type { Page } from "@playwright/test";
import type { AminoSignResponse, StdSignDoc } from "@cosmjs/amino";

import type { AccountPayload, WalletIdentity } from "../signer.js";

/**
 * A scripted `window.keplr` provider that lets Playwright drive the app's real Keplr
 * connect flow without a browser extension. It implements EXACTLY the four methods the
 * app calls and nothing else — `getKey`, `signArbitrary`, `defaultOptions` and friends
 * have zero call sites in `src/` and are deliberately omitted so drift stays visible.
 *
 * App call sites (verified against main @ afa8bfb3):
 *   - `enable(chainId)`
 *       src/common/stores/wallet/actions/connectKeplrLike.ts:46
 *       src/networks/cosm/WalletFactory.ts:89
 *   - `experimentalSuggestChain(chainInfo)`
 *       src/common/stores/wallet/actions/connectKeplrLike.ts:24 (presence), :34 (call)
 *       src/networks/cosm/WalletFactory.ts:71 (presence), :83 (call)
 *   - `getOfflineSignerOnlyAmino(chainId, options)`  (Path A — connect button)
 *       src/common/stores/wallet/actions/connectKeplrLike.ts:22 (presence), :48-49 (call)
 *   - `getOfflineSignerAuto(chainId)`  (Path B — cross-chain external wallet)
 *       src/networks/cosm/WalletFactory.ts:69 (presence), :92 (call)
 *
 * Beyond the four methods, the app also reads two things OFF the returned signer:
 *   - `signer.chainId` — `useSwapForm.ts` `getWallets` resolves the native chain from the
 *     connected wallet's signer and throws "Native chain id not available" when absent
 *     (real Keplr's `CosmJSOfflineSigner` carries a public `chainId` field). Every signer
 *     this stub returns therefore pins the `chainId` it was created for.
 *   - `getAccounts()` per chain — the cross-chain swap path builds one wallet per Skip
 *     route hop and needs a chain-appropriate bech32 address (e.g. `osmo1…` on
 *     `osmosis-1`), so the account binding threads the signer's chain id to Node where
 *     the identity derives the right prefix.
 *
 * The signer object returned by the two getters intentionally omits `signDirect`:
 * CosmJS's `isOfflineDirectSigner` is literally `signer.signDirect !== undefined`
 * (@cosmjs/proto-signing signer.js), so defining it at all would route signing down the
 * direct branch instead of the amino `signAmino` branch the app relies on.
 */

const GET_ACCOUNTS_BINDING = "__e2eWalletGetAccounts";
const SIGN_AMINO_BINDING = "__e2eWalletSignAmino";
const LAST_CHAIN_ID_VAR = "__e2eLastChainId";

/**
 * Browser-context source for the stub. This package's tsconfig omits the "DOM" lib, so
 * every line here is authored as a string (never referencing browser globals in typed
 * code) exactly like the `seedScript` pattern in `src/t1/support.ts`. The builder takes
 * no arguments — in particular it never receives the mnemonic — so the init-script
 * source can never carry a secret.
 */
export function buildKeplrInitScript(): string {
  return `(() => {
  const decodePubkey = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); }
    return bytes;
  };
  const makeAminoSigner = (chainId) => ({
    chainId,
    getAccounts: async () => {
      const account = await window.${GET_ACCOUNTS_BINDING}(chainId);
      return [{ address: account.address, pubkey: decodePubkey(account.pubkey), algo: account.algo }];
    },
    signAmino: (signerAddress, signDoc) => window.${SIGN_AMINO_BINDING}(signerAddress, signDoc)
  });
  window.keplr = {
    enable: (chainId) => { window.${LAST_CHAIN_ID_VAR} = chainId; return Promise.resolve(); },
    experimentalSuggestChain: () => Promise.resolve(),
    getOfflineSignerOnlyAmino: (chainId) => makeAminoSigner(chainId),
    getOfflineSignerAuto: (chainId) => Promise.resolve(makeAminoSigner(chainId))
  };
})();`;
}

/**
 * Registers the Node-side signing bindings and injects the in-page `window.keplr` before
 * the SPA boots. The mnemonic never crosses into the page: `getAccounts` hands back a
 * base64 public key and `signAmino` proxies a JSON-safe `StdSignDoc`/`AminoSignResponse`
 * pair, both of which survive the `exposeFunction` boundary untouched.
 */
export async function installKeplrStub(page: Page, identity: WalletIdentity): Promise<void> {
  await page.exposeFunction(GET_ACCOUNTS_BINDING, (chainId?: string): Promise<AccountPayload> =>
    identity.getAccounts(chainId)
  );
  await page.exposeFunction(
    SIGN_AMINO_BINDING,
    (signerAddress: string, signDoc: StdSignDoc): Promise<AminoSignResponse> =>
      identity.signAmino(signerAddress, signDoc)
  );
  await page.addInitScript(buildKeplrInitScript());
}

/** Browser expression reading the chain id the app last passed to `enable`. */
export const lastChainIdExpression = `window.${LAST_CHAIN_ID_VAR}`;

/** Browser expression reading the stub's identity marker (must be `undefined`, the #155 pin). */
export const isKeplrExpression = `window.keplr.isKeplr`;

/**
 * Browser-context source that drives one amino signature through the stub's Path-A
 * getter, mirroring how CosmJS calls the signer: `getOfflineSignerOnlyAmino` synchronously,
 * then `signAmino`. Authored as a string for the same no-DOM-lib reason as the init script.
 */
export function buildSignAminoScript(signerAddress: string, signDoc: StdSignDoc): string {
  return `(async () => {
  const signer = window.keplr.getOfflineSignerOnlyAmino(window.${LAST_CHAIN_ID_VAR});
  return signer.signAmino(${JSON.stringify(signerAddress)}, ${JSON.stringify(signDoc)});
})()`;
}
