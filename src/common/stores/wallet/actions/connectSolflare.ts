import { type Store } from "../types";

import { WalletStorage, applyWalletProtocolFilter } from "@/common/utils";
import { NolusWalletFactory } from "@nolus/nolusjs";
import { WalletConnectMechanism } from "@/common/types";
import { Buffer } from "buffer";
import { IntercomService } from "@/common/utils/IntercomService";
import { SolanaWallet } from "@/networks/sol";
import { applyNolusWalletOverrides } from "@/networks/cosm/NolusWalletOverride";

export async function connectSolflare(this: Store) {
  const sol = new SolanaWallet("solflare");
  const { pubkeyAny, solAddress } = await sol.connect();
  const signer = sol.makeWCOfflineSigner();

  const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(signer);
  await nolusWalletOfflineSigner.useAccount();

  const { address } = nolusWalletOfflineSigner;
  if (address === undefined) {
    throw new Error("Solflare connect failed: wallet exposes no account address");
  }

  WalletStorage.saveWalletConnectMechanism(WalletConnectMechanism.SOL_SOLFLARE);
  WalletStorage.setPubKey(Buffer.from(pubkeyAny).toString("hex"));
  applyWalletProtocolFilter(WalletConnectMechanism.SOL_SOLFLARE);

  this.wallet = nolusWalletOfflineSigner;
  this.solAddress = solAddress;
  applyNolusWalletOverrides(this.wallet);

  void IntercomService.load(address, "solflare");
}
