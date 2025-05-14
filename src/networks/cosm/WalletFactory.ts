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
import { createDepositForBurnWithCallerConverters } from "../list/noble/tx";
import { getWalletConnectOfflineSigner } from "@/common/stores/wallet/actions/connectWC";

const aminoTypes = {
  ...createIbcAminoConverters(),
  ...createBankAminoConverters(),
  ...createDepositForBurnWithCallerConverters()
};

const MsgTransferAmino = new AminoTypes(aminoTypes);

async function createWallet(
  wallet: Wallet,
  offlineDirectSigner: OfflineDirectSigner | OfflineAminoSigner | LedgerSigner,
  prefix: string,
  gasMultiplier: number,
  gasPrice: string,
  explorer: string
): Promise<BaseWallet> {
  const baseWallet = new BaseWallet(
    wallet.getTendermintClient(),
    offlineDirectSigner,
    { aminoTypes: MsgTransferAmino },
    wallet.rpc,
    wallet.api,
    prefix,
    gasMultiplier,
    gasPrice,
    explorer
  );
  await baseWallet.useAccount();
  return baseWallet;
}

async function authenticateKeplr(wallet: Wallet, network: NetworkData) {
  await WalletUtils.getKeplr();
  const keplrWindow = window as KeplrWindow;

  if (!keplrWindow.getOfflineSignerAuto || !keplrWindow.keplr) {
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

    if (keplrWindow.getOfflineSignerAuto) {
      const offlineSigner = await keplrWindow.getOfflineSignerAuto(chainId);

      return await createWallet(
        wallet,
        offlineSigner as any,
        network.prefix,
        network.gasMultiplier,
        network.gasPrice,
        network.explorer
      );
    }
  }

  throw new Error("Failed to fetch wallet.");
}

async function authenticateLeap(wallet: Wallet, network: NetworkData) {
  await WalletUtils.getLeap();
  const leapWindow = window as any;

  if (!leapWindow.leap.getOfflineSignerAuto || !leapWindow.leap) {
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

    if (leapWindow.leap.getOfflineSignerAuto) {
      const offlineSigner = await leapWindow.leap.getOfflineSignerAuto(chainId);

      return await createWallet(
        wallet,
        offlineSigner,
        network.prefix,
        network.gasMultiplier,
        network.gasPrice,
        network.explorer
      );
    }
  }

  throw new Error("Failed to fetch wallet.");
}

async function authenticateWalletConnect(wallet: Wallet, network: NetworkData) {
  try {
    const chainId = await wallet.getChainId();
    const { signer } = await getWalletConnectOfflineSigner(undefined, chainId);
    return await createWallet(
      wallet,
      signer as any,
      network.prefix,
      network.gasMultiplier,
      network.gasPrice,
      network.explorer
    );
  } catch (e) {
    throw e;
  }
}

async function authenticateLedger(wallet: Wallet, network: NetworkData) {
  const transport = await getLedgerTransport();
  const accountNumbers = [0];
  const paths = accountNumbers.map(makeCosmoshubPath);
  const w = await createWallet(
    wallet,
    new LedgerSigner(transport, {
      prefix: network.prefix,
      hdPaths: paths as any
    }),
    network.prefix,
    network.gasMultiplier,
    network.gasPrice,
    network.explorer
  );
  return w;
}

async function getLedgerTransport() {
  const isConnectedViaLedgerBluetooth =
    WalletManager.getWalletConnectMechanism() === WalletConnectMechanism.LEDGER_BLUETOOTH;

  if (isConnectedViaLedgerBluetooth) {
    return await BluetoothTransport.create();
  }

  return await TransportWebUSB.create();
}

export { aminoTypes, authenticateLedger, authenticateKeplr, authenticateLeap, authenticateWalletConnect, createWallet };
