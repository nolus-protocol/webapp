import { DirectSecp256k1Wallet, type OfflineDirectSigner } from "@cosmjs/proto-signing";
import { LedgerSigner } from "@cosmjs/ledger-amino";
import type { Wallet } from ".";
import type { Window as KeplrWindow } from "@keplr-wallet/types/build/window";
import { WalletConnectMechanism, type NetworkData } from "@/types";
import { makeCosmoshubPath, type OfflineAminoSigner } from "@cosmjs/amino";

import KeplrEmbedChainInfo from "@/config/keplr";
import TransportWebUSB from "@ledgerhq/hw-transport-webusb";
import { createIbcAminoConverters, createBankAminoConverters } from "@cosmjs/stargate";
import { AminoTypes } from "@cosmjs/stargate";
import { EncryptionUtils, WalletManager, WalletUtils } from "@/utils";
import { BaseWallet } from "./BaseWallet";
import BluetoothTransport from "@ledgerhq/hw-transport-web-ble";
import { fromHex } from "@cosmjs/encoding";

const aminoTypes = {
    ...createIbcAminoConverters(),
    ...createBankAminoConverters()
}

const MsgTransferAmino = new AminoTypes(aminoTypes);

const createWallet = async (wallet: Wallet, offlineDirectSigner: OfflineDirectSigner | OfflineAminoSigner | LedgerSigner, prefix: string): Promise<BaseWallet> => {
    const baseWallet = new BaseWallet(wallet.getTendermintClient(), offlineDirectSigner, { aminoTypes: MsgTransferAmino });
    await baseWallet.useAccount();
    return baseWallet;
};

const authenticateKeplr = async (wallet: Wallet, network: NetworkData) => {
    await WalletUtils.getKeplr();
    const keplrWindow = window as KeplrWindow;

    if (!keplrWindow.getOfflineSignerOnlyAmino || !keplrWindow.keplr) {
        throw new Error("Keplr wallet is not installed.");
    } else if (!keplrWindow.keplr.experimentalSuggestChain) {
        throw new Error(
            "Keplr version is not latest. Please upgrade your Keplr wallet"
        );
    } else {
        let chainId = "";

        try {
            chainId = await wallet.getChainId();
            await keplrWindow.keplr?.experimentalSuggestChain(
                KeplrEmbedChainInfo(
                    network.name,
                    chainId,
                    network.tendermintRpc as string,
                    network.api as string
                )
            );
        } catch (e) {
            throw new Error("Failed to fetch suggest chain.");
        }

        await keplrWindow.keplr?.enable(chainId);

        if (keplrWindow.getOfflineSignerOnlyAmino) {
            const offlineSigner = keplrWindow.getOfflineSignerOnlyAmino(
                chainId
            );

            return await createWallet(wallet, offlineSigner, network.prefix);

        }
    }

    throw new Error("Failed to fetch wallet.");

}

const authenticateLeap = async (wallet: Wallet, network: NetworkData) => {
    await WalletUtils.getLeap();
    const leapWindow = window as any;

    if (!leapWindow.leap.getOfflineSignerOnlyAmino || !leapWindow.leap) {
        throw new Error("Keplr wallet is not installed.");
    } else if (!leapWindow.leap.experimentalSuggestChain) {
        throw new Error(
            "Keplr version is not latest. Please upgrade your Keplr wallet"
        );
    } else {
        let chainId = "";

        try {
            chainId = await wallet.getChainId();
            await leapWindow.leap?.experimentalSuggestChain(
                KeplrEmbedChainInfo(
                    network.name,
                    chainId,
                    network.tendermintRpc as string,
                    network.api as string
                )
            );
        } catch (e) {
            throw new Error("Failed to fetch suggest chain.");
        }

        await leapWindow.leap?.enable(chainId);

        if (leapWindow.leap.getOfflineSignerOnlyAmino) {
            const offlineSigner = leapWindow.leap.getOfflineSignerOnlyAmino(
                chainId
            );

            return await createWallet(wallet, offlineSigner, network.prefix);

        }
    }

    throw new Error("Failed to fetch wallet.");

}

const authenticateLedger = async (wallet: Wallet, network: NetworkData) => {
    const transport = await getLedgerTransport();
    const accountNumbers = [0];
    const paths = accountNumbers.map(makeCosmoshubPath);
    return await createWallet(
        wallet,
        new LedgerSigner(transport, {
            prefix: network.prefix,
            hdPaths: paths,
        }),
        network.prefix
    );
}

const getLedgerTransport = async () => {
    const isConnectedViaLedgerBluetooth = WalletManager.getWalletConnectMechanism() === WalletConnectMechanism.LEDGER_BLUETOOTH;

    if (isConnectedViaLedgerBluetooth) {
        return await BluetoothTransport.create();
    }

    return await TransportWebUSB.create();

}

const authenticateDecrypt = async (wallet: Wallet, network: NetworkData, password: string) => {
    const encryptedPk = WalletManager.getPrivateKey();
    const encryptedPubKey = WalletManager.getEncryptedPubKey();

    const decryptedPubKey = EncryptionUtils.decryptEncryptionKey(
        encryptedPubKey,
        password
    );

    const decryptedPrivateKey = EncryptionUtils.decryptPrivateKey(
        encryptedPk,
        decryptedPubKey,
        password
    );

    const directSecrWallet = await DirectSecp256k1Wallet.fromKey(
        fromHex(decryptedPrivateKey),
        network.prefix
    );

    return await createWallet(wallet, directSecrWallet, network.prefix);
}

export { aminoTypes, authenticateLedger, authenticateKeplr, authenticateLeap, authenticateDecrypt, createWallet };