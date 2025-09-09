import { WalletActions } from "..";

import { connectKeplr } from "./connectKeplr";
import { connectLeap } from "./connectLeap";
import { connectLedger } from "./connectLedger";
import { disconnect } from "./disconnect";
import { loadApr } from "./loadApr";
import { loadStakedTokens } from "./loadStakedTokens";
import { loadSuppliedAmount } from "./loadSuppliedAmount";
import { loadVestedTokens } from "./loadVestedTokens";
import { loadWalletName } from "./loadWalletName";
import { updateBalances } from "./updateBalances";
import { updateHistory } from "./updateHistory";
import { ignoreAssets } from "./ignoreAssets";
import { loadActivities } from "./loadActivities";
import { connectWithWalletConnect } from "./connectWC";

export const actions = {
  [WalletActions.DISCONNECT]: disconnect,
  [WalletActions.CONNECT_KEPLR]: connectKeplr,
  [WalletActions.CONNECT_LEAP]: connectLeap,
  [WalletActions.CONNECT_LEDGER]: connectLedger,
  [WalletActions.CONNECT_WC]: connectWithWalletConnect,
  [WalletActions.UPDATE_BALANCES]: updateBalances,
  [WalletActions.LOAD_VESTED_TOKENS]: loadVestedTokens,
  [WalletActions.LOAD_SUPPLIED_AMOUNT]: loadSuppliedAmount,
  [WalletActions.LOAD_WALLET_NAME]: loadWalletName,
  [WalletActions.LOAD_STAKED_TOKENS]: loadStakedTokens,
  [WalletActions.LOAD_APR]: loadApr,
  updateHistory,
  ignoreAssets,
  loadActivities
};
