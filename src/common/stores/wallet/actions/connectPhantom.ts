import { type Store } from "../types";

import { WalletStorage, applyWalletProtocolFilter } from "@/common/utils";
import { NolusWalletFactory } from "@nolus/nolusjs";
import { WalletConnectMechanism } from "@/common/types";
import { Buffer } from "buffer";
import { IntercomService } from "@/common/utils/IntercomService";
import { SolanaWallet } from "@/networks/sol";
import { applyNolusWalletOverrides } from "@/networks/cosm/NolusWalletOverride";

export async function connectPhantom(this: Store) {
  const sol = new SolanaWallet("phantom");
  const { pubkeyAny } = await sol.connect();
  const signer = sol.makeWCOfflineSigner();

  const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(signer);
  await nolusWalletOfflineSigner.useAccount();

  WalletStorage.saveWalletConnectMechanism(WalletConnectMechanism.SOL_PHANTOM);
  WalletStorage.setPubKey(Buffer.from(pubkeyAny).toString("hex"));
  applyWalletProtocolFilter(WalletConnectMechanism.SOL_PHANTOM);

  this.wallet = nolusWalletOfflineSigner;
  applyNolusWalletOverrides(this.wallet);

  void IntercomService.load(this.wallet.address, "phantom");
}
