import { type OfflineDirectSigner } from "@cosmjs/proto-signing";
import type { Wallet } from "..";
import type { Window as KeplrWindow } from "@keplr-wallet/types/build/window";

import BluetoothTransport from "@ledgerhq/hw-transport-web-ble";
import TransportWebUSB from "@ledgerhq/hw-transport-webusb";

import { LedgerSigner } from "@cosmjs/ledger-amino";
import { WalletConnectMechanism, type NetworkData } from "@/common/types";
import { makeCosmoshubPath, type OfflineAminoSigner } from "@cosmjs/amino";

import { createBankAminoConverters, createIbcAminoConverters } from "@cosmjs/stargate";
import { AminoTypes } from "@cosmjs/stargate";
import { WalletManager, WalletUtils, AppUtils, Logger } from "@/common//utils";
import { BaseWallet } from "./BaseWallet";

const aminoTypes = {
  ...createIbcAminoConverters(),
  ...createBankAminoConverters()
};

const MsgTransferAmino = new AminoTypes(aminoTypes);

async function createWallet(
  wallet: Wallet,
  offlineDirectSigner: OfflineDirectSigner | OfflineAminoSigner | LedgerSigner,
  prefix: string,
  gasMupltiplier: number,
  gasPrice: string
): Promise<BaseWallet> {
  const baseWallet = new BaseWallet(
    wallet.getTendermintClient(),
    offlineDirectSigner,
    { aminoTypes: MsgTransferAmino },
    wallet.rpc,
    wallet.api,
    prefix,
    gasMupltiplier,
    gasPrice
  );
  await baseWallet.useAccount();
  return baseWallet;
}

async function authenticateKeplr(wallet: Wallet, network: NetworkData) {
  await WalletUtils.getKeplr();
  const keplrWindow = window as KeplrWindow;

  if (!keplrWindow.getOfflineSignerOnlyAmino || !keplrWindow.keplr) {
    throw new Error("Keplr wallet is not installed.");
  } else if (!keplrWindow.keplr.experimentalSuggestChain) {
    throw new Error("Keplr version is not latest. Please upgrade your Keplr wallet");
  } else {
    let chainId = "";

    try {
      chainId = await wallet.getChainId();
      const node = await AppUtils.fetchEndpoints(network.key);
      await keplrWindow.keplr?.experimentalSuggestChain(network.embedChainInfo(chainId, node.rpc, node.api));
    } catch (e) {
      throw new Error("Failed to fetch suggest chain.");
    }

    await keplrWindow.keplr?.enable(chainId);

    if (keplrWindow.getOfflineSignerOnlyAmino) {
      const offlineSigner = keplrWindow.getOfflineSignerOnlyAmino(chainId);

      return await createWallet(wallet, offlineSigner, network.prefix, network.gasMupltiplier, network.gasPrice);
    }
  }

  throw new Error("Failed to fetch wallet.");
}

async function authenticateLeap(wallet: Wallet, network: NetworkData) {
  await WalletUtils.getLeap();
  const leapWindow = window as any;

  if (!leapWindow.leap.getOfflineSignerOnlyAmino || !leapWindow.leap) {
    throw new Error("Leap wallet is not installed.");
  } else if (!leapWindow.leap.experimentalSuggestChain) {
    throw new Error("Leap version is not latest. Please upgrade your Leap wallet");
  } else {
    let chainId = "";

    try {
      chainId = await wallet.getChainId();
      const node = await AppUtils.fetchEndpoints(network.key);

      await leapWindow.leap?.experimentalSuggestChain(network.embedChainInfo(chainId, node.rpc, node.api));
    } catch (e) {
      Logger.error(e);
      throw new Error("Failed to fetch suggest chain.");
    }

    await leapWindow.leap?.enable(chainId);

    if (leapWindow.leap.getOfflineSignerOnlyAmino) {
      const offlineSigner = leapWindow.leap.getOfflineSignerOnlyAmino(chainId);

      return await createWallet(wallet, offlineSigner, network.prefix, network.gasMupltiplier, network.gasPrice);
    }
  }

  throw new Error("Failed to fetch wallet.");
}

async function authenticateLedger(wallet: Wallet, network: NetworkData) {
  const transport = await getLedgerTransport();
  const accountNumbers = [0];
  const paths = accountNumbers.map(makeCosmoshubPath);
  return await createWallet(
    wallet,
    new LedgerSigner(transport, {
      prefix: network.prefix,
      hdPaths: paths
    }),
    network.prefix,
    network.gasMupltiplier,
    network.gasPrice
  );
}

async function getLedgerTransport() {
  const isConnectedViaLedgerBluetooth =
    WalletManager.getWalletConnectMechanism() === WalletConnectMechanism.LEDGER_BLUETOOTH;

  if (isConnectedViaLedgerBluetooth) {
    return await BluetoothTransport.create();
  }

  return await TransportWebUSB.create();
}

export { aminoTypes, authenticateLedger, authenticateKeplr, authenticateLeap, createWallet };
