import { WalletActions } from "../types";

import { connectKeplr } from "./connectKeplr";
import { connectLeap } from "./connectLeap";
import { connectLedger } from "./connectLedger";
import { disconnect } from "./disconnect";
import { loadApr } from "./loadApr";
import { loadVestedTokens } from "./loadVestedTokens";
import { loadWalletName } from "./loadWalletName";
import { ignoreAssets } from "./ignoreAssets";
import { connectWithWalletConnect } from "./connectWC";
import { connectPhantom } from "./connectPhantom";
import { connectMetamask } from "./connectMetamask";
import { connectSolflare } from "./connectSolflare";

export const actions = {
  [WalletActions.DISCONNECT]: disconnect,
  [WalletActions.CONNECT_KEPLR]: connectKeplr,
  [WalletActions.CONNECT_LEAP]: connectLeap,
  [WalletActions.CONNECT_LEDGER]: connectLedger,
  [WalletActions.CONNECT_WC]: connectWithWalletConnect,
  [WalletActions.CONNECT_EVM_METAMASK]: connectMetamask,
  [WalletActions.CONNECT_EVM_PHANTOM]: connectPhantom,
  [WalletActions.CONNECT_SOL_SOLFLARE]: connectSolflare,
  [WalletActions.LOAD_VESTED_TOKENS]: loadVestedTokens,
  [WalletActions.LOAD_WALLET_NAME]: loadWalletName,
  [WalletActions.LOAD_APR]: loadApr,
  ignoreAssets
};
