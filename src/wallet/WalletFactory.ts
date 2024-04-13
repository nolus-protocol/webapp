import { type OfflineDirectSigner } from "@cosmjs/proto-signing";
import type { Wallet } from ".";
import type { Window as KeplrWindow } from "@keplr-wallet/types/build/window";

import BluetoothTransport from "@ledgerhq/hw-transport-web-ble";
import TransportWebUSB from "@ledgerhq/hw-transport-webusb";

import { LedgerSigner } from "@cosmjs/ledger-amino";
import { type NetworkDataV2, WalletConnectMechanism } from "@/common/types";
import { makeCosmoshubPath, type OfflineAminoSigner } from "@cosmjs/amino";

import { createBankAminoConverters, createIbcAminoConverters } from "@cosmjs/stargate";
import { AminoTypes } from "@cosmjs/stargate";
import { Logger, WalletManager, WalletUtils } from "@/common/utils";
import { BaseWallet } from "./BaseWallet";

const aminoTypes = {
  ...createIbcAminoConverters(),
  ...createBankAminoConverters()
};

const MsgTransferAmino = new AminoTypes(aminoTypes);

const createWallet = async (
  wallet: Wallet,
  offlineDirectSigner: OfflineDirectSigner | OfflineAminoSigner | LedgerSigner,
  prefix: string
): Promise<BaseWallet> => {
  const baseWallet = new BaseWallet(
    wallet.getTendermintClient(),
    offlineDirectSigner,
    { aminoTypes: MsgTransferAmino },
    wallet.rpc,
    wallet.api,
    prefix
  );
  await baseWallet.useAccount();
  return baseWallet;
};

const authenticateKeplr = async (wallet: Wallet, network: NetworkDataV2) => {
  await WalletUtils.getKeplr();
  const keplrWindow = window as KeplrWindow;

  if (!keplrWindow.getOfflineSignerOnlyAmino || !keplrWindow.keplr) {
    throw new Error("Keplr wallet is not installed.");
  } else if (!keplrWindow.keplr.experimentalSuggestChain) {
    throw new Error("Keplr version is not latest. Please upgrade your Keplr wallet");
  } else {
    try {
      await keplrWindow.keplr?.experimentalSuggestChain(network.embedChainInfo());
    } catch (e) {
      throw new Error("Failed to fetch suggest chain.");
    }

    await keplrWindow.keplr?.enable(network.chainId);

    if (keplrWindow.getOfflineSignerOnlyAmino) {
      const offlineSigner = keplrWindow.getOfflineSignerOnlyAmino(network.chainId);

      return await createWallet(wallet, offlineSigner, network.prefix);
    }
  }

  throw new Error("Failed to fetch wallet.");
};

const authenticateLeap = async (wallet: Wallet, network: NetworkDataV2) => {
  await WalletUtils.getLeap();
  const leapWindow = window as any;

  if (!leapWindow.leap.getOfflineSignerOnlyAmino || !leapWindow.leap) {
    throw new Error("Leap wallet is not installed.");
  } else if (!leapWindow.leap.experimentalSuggestChain) {
    throw new Error("Leap version is not latest. Please upgrade your Leap wallet");
  } else {
    try {
      await leapWindow.leap?.experimentalSuggestChain(network.embedChainInfo());
    } catch (e) {
      Logger.error(e);
      throw new Error("Failed to fetch suggest chain.");
    }

    await leapWindow.leap?.enable(network.chainId);

    if (leapWindow.leap.getOfflineSignerOnlyAmino) {
      const offlineSigner = leapWindow.leap.getOfflineSignerOnlyAmino(network.chainId);

      return await createWallet(wallet, offlineSigner, network.prefix);
    }
  }

  throw new Error("Failed to fetch wallet.");
};

const authenticateLedger = async (wallet: Wallet, network: NetworkDataV2) => {
  const transport = await getLedgerTransport();
  const accountNumbers = [0];
  const paths = accountNumbers.map(makeCosmoshubPath) as any;
  return await createWallet(
    wallet,
    new LedgerSigner(transport, {
      prefix: network.prefix,
      hdPaths: paths
    }),
    network.prefix
  );
};

const getLedgerTransport = async () => {
  const isConnectedViaLedgerBluetooth =
    WalletManager.getWalletConnectMechanism() === WalletConnectMechanism.LEDGER_BLUETOOTH;

  if (isConnectedViaLedgerBluetooth) {
    return await BluetoothTransport.create();
  }

  return await TransportWebUSB.create();
};

export { aminoTypes, authenticateLedger, authenticateKeplr, authenticateLeap, createWallet };
