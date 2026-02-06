import { type OfflineDirectSigner } from "@cosmjs/proto-signing";
import type { Keplr } from "@keplr-wallet/types";
import type { Wallet } from "..";

import BluetoothTransport from "@ledgerhq/hw-transport-web-ble";
import TransportWebUSB from "@ledgerhq/hw-transport-webusb";

import { LedgerSigner } from "@cosmjs/ledger-amino";
import { WalletConnectMechanism, type NetworkData } from "@/common/types";
import { makeCosmoshubPath, type OfflineAminoSigner } from "@cosmjs/amino";

import { createBankAminoConverters, createIbcAminoConverters } from "@cosmjs/stargate";
import { AminoTypes } from "@cosmjs/stargate";
import { WalletManager, WalletUtils, Logger } from "@/common/utils";
import { fetchEndpoints } from "@/common/utils/EndpointService";
import { type BaseWallet } from "./BaseWallet";
import { MetaMaskWallet } from "../evm";
import { SolanaWallet } from "../sol";

const aminoTypes = {
  ...createIbcAminoConverters(),
  ...createBankAminoConverters()
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
  const { BaseWallet } = await import("./BaseWallet");
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

async function authenticateKeplrLike(
  wallet: Wallet,
  network: NetworkData,
  getExtension: () => Promise<Keplr | undefined>,
  label: string
) {
  const extension = await getExtension();

  if (!extension?.getOfflineSignerAuto || !extension) {
    throw new Error(`${label} wallet is not installed.`);
  } else if (!extension.experimentalSuggestChain) {
    throw new Error(`${label} version is not latest. Please upgrade your ${label} wallet`);
  } else {
    let chainId = "";

    try {
      chainId = await wallet.getChainId();
      const node = await fetchEndpoints(network.key);
      await extension.experimentalSuggestChain(network.embedChainInfo(chainId, node.rpc, node.api));
    } catch (e) {
      Logger.error(e);
      throw new Error("Failed to fetch suggest chain.");
    }

    await extension.enable(chainId);

    if (extension.getOfflineSignerAuto) {
      const offlineSigner = await extension.getOfflineSignerAuto(chainId);

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

async function authenticateKeplr(wallet: Wallet, network: NetworkData) {
  return authenticateKeplrLike(wallet, network, WalletUtils.getKeplr, "Keplr");
}

async function authenticateLeap(wallet: Wallet, network: NetworkData) {
  return authenticateKeplrLike(wallet, network, WalletUtils.getLeap, "Leap");
}

export async function authenticateEvmPhantom(wallet: Wallet, network: NetworkData) {
  const node = await fetchEndpoints(network.key);
  const metamask = new MetaMaskWallet();
  await metamask.connectCustom(node, network);
  const signer = metamask.makeWCOfflineSigner();

  return await createWallet(
    wallet,
    signer as any,
    network.prefix,
    network.gasMultiplier,
    network.gasPrice,
    network.explorer
  );
}

export async function authenticateSolFlare(wallet: Wallet, network: NetworkData) {
  const node = await fetchEndpoints(network.key);
  const sol = new SolanaWallet();
  await sol.connectCustom(node, network);
  const signer = sol.makeWCOfflineSigner();

  return await createWallet(
    wallet,
    signer as any,
    network.prefix,
    network.gasMultiplier,
    network.gasPrice,
    network.explorer
  );
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

export { aminoTypes, authenticateLedger, authenticateKeplr, authenticateLeap, createWallet };
