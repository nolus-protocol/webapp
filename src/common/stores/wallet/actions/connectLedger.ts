import { type Store } from "../types";
import { AppUtils, WalletManager } from "@/common/utils";
import { ChainConstants, NolusClient, NolusWalletFactory } from "@nolus/nolusjs";
import { WalletConnectMechanism } from "@/common/types";
import { makeCosmoshubPath } from "@cosmjs/amino";
import { LedgerSigner } from "@cosmjs/ledger-amino";
import { Buffer } from "buffer";
import { LedgerName } from "@/config/global";

import BluetoothTransport from "@ledgerhq/hw-transport-web-ble";
import TransportWebUSB from "@ledgerhq/hw-transport-webusb";

export async function connectLedger(this: Store, payload: { isBluetooth?: boolean } = {}) {
  let breakLoop = false;
  let ledgerWallet = null;

  const to = setTimeout(() => (breakLoop = true), 30000);
  const accountNumbers = [0];
  const paths = accountNumbers.map(makeCosmoshubPath);
  const networkConfig = await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY);

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
          hdPaths: paths
        })
      );

      await ledgerWallet.useAccount();
      this.wallet = ledgerWallet;

      WalletManager.saveWalletConnectMechanism(
        payload.isBluetooth ? WalletConnectMechanism.LEDGER_BLUETOOTH : WalletConnectMechanism.LEDGER
      );
      WalletManager.storeWalletAddress(ledgerWallet.address || "");
      WalletManager.setPubKey(Buffer.from(this.wallet?.pubKey ?? "").toString("hex"));
      this.walletName = LedgerName;
    } catch (e: Error | any) {
      breakLoop = true;
      throw new Error(e);
    }
  }

  await this.UPDATE_BALANCES();

  clearTimeout(to);
}
