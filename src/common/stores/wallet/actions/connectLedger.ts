import { type Store } from "../types";
import { WalletManager } from "@/common/utils";
import { fetchEndpoints } from "@/common/utils/EndpointService";
import { ChainConstants, NolusClient, NolusWalletFactory } from "@nolus/nolusjs";
import { WalletConnectMechanism } from "@/common/types";
import { makeCosmoshubPath } from "@cosmjs/amino";
import { LedgerSigner } from "@cosmjs/ledger-amino";
import { Buffer } from "buffer";
import { LedgerName } from "@/config/global";

import BluetoothTransport from "@ledgerhq/hw-transport-web-ble";
import TransportWebUSB from "@ledgerhq/hw-transport-webusb";
import { IntercomService } from "@/common/utils/IntercomService";
import { useBalancesStore } from "../../balances";
import { useHistoryStore } from "../../history";

export async function connectLedger(this: Store, payload: { isBluetooth?: boolean } = {}) {
  let breakLoop = false;
  let ledgerWallet = null;

  const to = setTimeout(() => (breakLoop = true), 30000);
  const accountNumbers = [0];
  const paths = accountNumbers.map(makeCosmoshubPath);
  const networkConfig = await fetchEndpoints(ChainConstants.CHAIN_KEY);

  NolusClient.setInstance(networkConfig.rpc);

  while (!ledgerWallet && !breakLoop) {
    try {
      const isConnectedViaLedgerBluetooth =
        WalletManager.getWalletConnectMechanism() === WalletConnectMechanism.LEDGER_BLUETOOTH;
      const transport =
        payload.isBluetooth || isConnectedViaLedgerBluetooth
          ? await BluetoothTransport.create()
          : await TransportWebUSB.create();

      ledgerWallet = await NolusWalletFactory.nolusLedgerWallet(
        new LedgerSigner(transport, {
          prefix: ChainConstants.BECH32_PREFIX_ACC_ADDR,
          hdPaths: paths as any
        })
      );

      await ledgerWallet.useAccount();
      this.wallet = ledgerWallet;

      WalletManager.saveWalletConnectMechanism(
        payload.isBluetooth ? WalletConnectMechanism.LEDGER_BLUETOOTH : WalletConnectMechanism.LEDGER
      );
      WalletManager.setPubKey(Buffer.from(this.wallet?.pubKey ?? "").toString("hex"));
      this.walletName = LedgerName;
    } catch (e: Error | any) {
      breakLoop = true;
      throw new Error(e);
    }
  }

  const balancesStore = useBalancesStore();
  await balancesStore.setAddress(this.wallet?.address ?? "");
  
  const historyStore = useHistoryStore();
  historyStore.setAddress(this.wallet?.address ?? "");
  historyStore.loadActivities();

  IntercomService.load(this.wallet?.address as string, "ledger");

  clearTimeout(to);
}
