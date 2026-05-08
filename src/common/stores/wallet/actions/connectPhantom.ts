import { type Store } from "../types";

import { WalletManager, applyWalletProtocolFilter } from "@/common/utils";
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

  WalletManager.saveWalletConnectMechanism(WalletConnectMechanism.SOL_PHANTOM);
  WalletManager.setPubKey(Buffer.from(pubkeyAny).toString("hex"));
  applyWalletProtocolFilter(WalletConnectMechanism.SOL_PHANTOM);

  this.wallet = nolusWalletOfflineSigner;
  applyNolusWalletOverrides(this.wallet);

  IntercomService.load(this.wallet.address, "phantom");
}
