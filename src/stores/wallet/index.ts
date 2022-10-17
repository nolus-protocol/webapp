import KeplrEmbedChainInfo from '@/config/keplr';
import router from '@/router';
import BluetoothTransport from '@ledgerhq/hw-transport-web-ble';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';

import type { HdPath } from '@cosmjs/crypto';
import type { AssetBalance, State } from '@/stores/wallet/state';
import type { Window as KeplrWindow } from '@keplr-wallet/types/build/window';
import { WalletConnectMechanism } from '@/types';
import { defineStore } from 'pinia';
import { WalletActionTypes } from '@/stores/wallet/action-types';
import { EncryptionUtils, EnvNetworkUtils, KeyUtils as KeyUtilities, WalletUtils } from '@/utils';
import { makeCosmoshubPath } from '@cosmjs/amino';
import { AssetUtils, CurrencyUtils, KeyUtils, NolusClient, NolusWalletFactory } from '@nolus/nolusjs';
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import { ChainConstants } from '@nolus/nolusjs/build/constants';
import { fromHex, toHex } from '@cosmjs/encoding';
import { WalletManager } from '@/wallet/WalletManager';
import { RouteNames } from '@/router/RouterNames';
import { IbcAssets, supportedCurrencies } from '@/config/currencies';
import { LedgerSigner } from '@cosmjs/ledger-amino';

const useWalletStore = defineStore('wallet', {
  state: () => {
    return {
      torusClient: null,
      wallet: null,
      privateKey: null,
      balances: [],
    } as State;
  },
  actions: {
    async [WalletActionTypes.CONNECT_KEPLR](
      payload: { isFromAuth?: boolean } = {}
    ) {
      await WalletUtils.getKeplr();
      const keplrWindow = window as KeplrWindow;

      if (!keplrWindow.getOfflineSigner || !keplrWindow.keplr) {
        throw new Error('Keplr wallet is not installed.');
      } else if (!keplrWindow.keplr.experimentalSuggestChain) {
        throw new Error(
          'Keplr version is not latest. Please upgrade your Keplr wallet'
        );
      } else {
        let chainId = '';

        try {
          chainId = await NolusClient.getInstance().getChainId();
          const networkConfig = EnvNetworkUtils.loadNetworkConfig();
          await keplrWindow.keplr?.experimentalSuggestChain(
            KeplrEmbedChainInfo(
              EnvNetworkUtils.getStoredNetworkName(),
              chainId,
              networkConfig?.tendermintRpc as string,
              networkConfig?.api as string
            )
          );
        } catch (e) {
          throw new Error('Failed to fetch suggest chain.');
        }

        await keplrWindow.keplr?.enable(chainId);

        if (keplrWindow.getOfflineSigner) {
          const offlineSigner = keplrWindow.getOfflineSigner(chainId);
          const nolusWalletOfflineSigner =
            await NolusWalletFactory.nolusOfflineSigner(offlineSigner);
          await nolusWalletOfflineSigner.useAccount();

          this.wallet = nolusWalletOfflineSigner;
          await this[WalletActionTypes.UPDATE_BALANCES]();

          WalletManager.saveWalletConnectMechanism(
            WalletConnectMechanism.EXTENSION
          );
          WalletManager.storeWalletAddress(
            nolusWalletOfflineSigner.address || ''
          );

          if (payload?.isFromAuth) {
            await router.push({ name: RouteNames.DASHBOARD });
          }
        }
      }
    },
    async [WalletActionTypes.CONNECT_LEDGER](
      payload: { isFromAuth?: boolean; isBluetooth?: boolean } = {}
    ) {
      let breakLoop = false;
      let ledgerWallet = null;

      // 20 sec timeout to let the user unlock his hardware
      const to = setTimeout(() => (breakLoop = true), 20000);
      const accountNumbers = [0];
      const paths = accountNumbers.map(makeCosmoshubPath);

      while (!ledgerWallet && !breakLoop) {
        try {
          const isConnectedViaLedgerBluetooth =
            WalletManager.getWalletConnectMechanism() ===
            WalletConnectMechanism.LEDGER_BLUETOOTH;
          const transport =
            payload.isBluetooth || isConnectedViaLedgerBluetooth
              ? await BluetoothTransport.create()
              : await TransportWebUSB.create();

          //TODO remove any
          ledgerWallet = await NolusWalletFactory.nolusLedgerWallet(
            new LedgerSigner(transport, {
              prefix: ChainConstants.BECH32_PREFIX_ACC_ADDR,
              hdPaths: paths,
            }) as any
          );

          await ledgerWallet.useAccount();
          this.wallet = ledgerWallet;

          WalletManager.saveWalletConnectMechanism(
            payload.isBluetooth
              ? WalletConnectMechanism.LEDGER_BLUETOOTH
              : WalletConnectMechanism.LEDGER
          );
          WalletManager.storeWalletAddress(ledgerWallet.address || '');
          await this[WalletActionTypes.UPDATE_BALANCES]();

          if (payload?.isFromAuth) {
            await router.push({ name: RouteNames.DASHBOARD });
          }
        } catch (e: Error | any) {
          breakLoop = true;
          throw new Error(e);
        }
      }
      clearTimeout(to);
    },
    async [WalletActionTypes.CONNECT_VIA_MNEMONIC](mnemonic: string) {
      let privateKey: Uint8Array;

      if (KeyUtilities.isPrivateKey(mnemonic)) {
        privateKey = Buffer.from(mnemonic.trim().replace('0x', ''), 'hex');
      } else {
        const accountNumbers = [0];
        const path: HdPath | any = accountNumbers.map(makeCosmoshubPath)[0];
        privateKey = await KeyUtils.getPrivateKeyFromMnemonic(mnemonic, path);
      }

      const directSecrWallet = await DirectSecp256k1Wallet.fromKey(
        privateKey,
        ChainConstants.BECH32_PREFIX_ACC_ADDR
      );
      const nolusWalletOfflineSigner =
        await NolusWalletFactory.nolusOfflineSigner(directSecrWallet);
      await nolusWalletOfflineSigner.useAccount();
      this.wallet = nolusWalletOfflineSigner;
      this.privateKey = toHex(privateKey);
    },
    [WalletActionTypes.STORE_PRIVATE_KEY](password: string) {
      const privateKey = this.privateKey ?? '';
      if (privateKey.length > 0 && password?.length > 0) {
        const pubKey = toHex(this.wallet?.pubKey || new Uint8Array(0));
        const encryptedPbKey = EncryptionUtils.encryptEncryptionKey(
          pubKey,
          password
        );
        const encryptedPk = EncryptionUtils.encryptPrivateKey(
          privateKey,
          pubKey,
          password
        );

        WalletManager.saveWalletConnectMechanism(
          WalletConnectMechanism.MNEMONIC
        );
        WalletManager.storeWalletAddress(this.wallet?.address ?? '');
        WalletManager.storeEncryptedPubKey(encryptedPbKey);
        WalletManager.storeEncryptedPk(encryptedPk);
        this.privateKey = null;
      }
    },
    async [WalletActionTypes.UPDATE_BALANCES]() {
      try {
        const walletAddress = WalletManager.getWalletAddress() || '';

        if (!WalletUtils.isAuth()) {
          WalletManager.eraseWalletInfo();
          await router.push({ name: RouteNames.AUTH });
          return;
        }

        const ibcBalances = [] as AssetBalance[];
        for (const currency of supportedCurrencies) {
          const balance = await NolusClient.getInstance().getBalance(
            walletAddress,
            currency
          );
          ibcBalances.push({
            balance: CurrencyUtils.convertCosmosCoinToKeplCoin(balance),
          });
        }

        for (const ibcAsset of IbcAssets) {
          const ibcDenom = AssetUtils.makeIBCMinimalDenom(
            ibcAsset.sourceChannelId,
            ibcAsset.coinMinimalDenom
          );
          const balance = await NolusClient.getInstance().getBalance(
            walletAddress,
            ibcDenom
          );

          ibcBalances.push({
            balance: CurrencyUtils.convertCosmosCoinToKeplCoin(balance),
          });
        }

        this.balances = ibcBalances;
      } catch (e: Error | any) {
        throw new Error(e);
      }
    },
    async [WalletActionTypes.LOAD_PRIVATE_KEY_AND_SIGN](payload: { password: string }) {
      if (this.privateKey === null && payload.password !== '') {
        const encryptedPubKey = WalletManager.getEncryptedPubKey();
        const encryptedPk = WalletManager.getPrivateKey();
        const decryptedPubKey = EncryptionUtils.decryptEncryptionKey(encryptedPubKey, payload.password);
        const decryptedPrivateKey = EncryptionUtils.decryptPrivateKey(encryptedPk, decryptedPubKey, payload.password);
        const directSecrWallet = await DirectSecp256k1Wallet.fromKey(fromHex(decryptedPrivateKey), ChainConstants.BECH32_PREFIX_ACC_ADDR);
        const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(directSecrWallet);
        await nolusWalletOfflineSigner.useAccount();

        this.wallet = nolusWalletOfflineSigner;
        this.privateKey = '';
        await this[WalletActionTypes.UPDATE_BALANCES]();

      }
    },
    async [WalletActionTypes.SEARCH_TX]() {
      const data = await NolusClient.getInstance().searchTxByAddress(
        WalletManager.getWalletAddress() || ''
      );
      return data;
    },
  },
});

export { useWalletStore, WalletActionTypes };
