import KeplrEmbedChainInfo from '@/config/keplr';
import router from '@/router';
import BluetoothTransport from '@ledgerhq/hw-transport-web-ble';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import CURRENCIES from '@/config/currencies.json';

import type { HdPath } from '@cosmjs/crypto';
import type { State } from '@/stores/wallet/state';
import type { Window as KeplrWindow } from '@keplr-wallet/types/build/window';
import { WalletConnectMechanism } from '@/types';
import { defineStore } from 'pinia';
import { WalletActionTypes } from '@/stores/wallet/action-types';
import { EncryptionUtils, EnvNetworkUtils, KeyUtils as KeyUtilities, WalletUtils, AssetUtils, Web3AuthProvider } from '@/utils';
import { makeCosmoshubPath } from '@cosmjs/amino';
import { CurrencyUtils, KeyUtils, NolusClient, NolusWalletFactory } from '@nolus/nolusjs';
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import { ChainConstants } from '@nolus/nolusjs/build/constants';
import { fromHex, toHex } from '@cosmjs/encoding';
import { WalletManager } from '@/wallet/WalletManager';
import { RouteNames } from '@/router/RouterNames';
import { LedgerSigner } from '@cosmjs/ledger-amino';
import { decodeTxRaw, Registry, type DecodedTxRaw, } from '@cosmjs/proto-signing';
import { defaultRegistryTypes as defaultStargateTypes } from "@cosmjs/stargate";
import { NETWORKS } from '@/config/env';
import { ASSETS } from '@/config/assetsInfo';
import { ADAPTER_STATUS } from '@web3auth/base';
import { Buffer } from 'buffer';
import { Lpp } from '@nolus/nolusjs/build/contracts';
import { CONTRACTS } from '@/config/contracts';

const useWalletStore = defineStore('wallet', {
  state: () => {
    return {
      torusClient: null,
      wallet: null,
      privateKey: null,
      walletName: null,
      balances: [],
      currencies: {},
      stakingBalance: null,
      suppliedBalance: '0'
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
          const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(offlineSigner);
          await nolusWalletOfflineSigner.useAccount();
          this.wallet = nolusWalletOfflineSigner;
          this.walletName = (await keplrWindow.keplr.getKey(chainId)).name;
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
      // 30 sec timeout to let the user unlock his hardware
      const to = setTimeout(() => (breakLoop = true), 30000);
      const accountNumbers = [0];
      const paths = accountNumbers.map(makeCosmoshubPath);

      while (!ledgerWallet && !breakLoop) {
        try {
          const isConnectedViaLedgerBluetooth =
            WalletManager.getWalletConnectMechanism() === WalletConnectMechanism.LEDGER_BLUETOOTH;
          const transport =
            payload.isBluetooth || isConnectedViaLedgerBluetooth
              ? await BluetoothTransport.create()
              : await TransportWebUSB.create();
          //TODO: remove any
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

          if (payload?.isFromAuth) {
            await router.push({ name: RouteNames.SET_WALLET_NAME });
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
      const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(directSecrWallet);
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
          return false;
        }

        const ibcBalances = [];

        for (const key in CURRENCIES.currencies) {
          const currency = CURRENCIES.currencies[key as keyof typeof CURRENCIES.currencies];
          const ibcDenom = AssetUtils.makeIBCMinimalDenom(currency.ibc_route, currency.symbol);
          ibcBalances.push(NolusClient.getInstance().getBalance(
            walletAddress,
            ibcDenom
          ).then((item) => {
            const data = {
              ticker: key,
              name: currency.name,
              symbol: currency.symbol,
              decimal_digits: currency.decimal_digits,
              groups: currency.groups,
              swap_routes: currency.swap_routes
            };
            this.currencies[ibcDenom] = data;
            return { balance: CurrencyUtils.convertCosmosCoinToKeplCoin(item) };
          }));
        }
        this.balances = await Promise.all(ibcBalances);
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
        this.privateKey = null;
        await this[WalletActionTypes.UPDATE_BALANCES]();

      }
    },
    async [WalletActionTypes.SEARCH_TX]() {
      const address = WalletManager.getWalletAddress();
      if (address?.length > 0) {
        const data = await NolusClient.getInstance().searchTxByAddress(
          WalletManager.getWalletAddress() || ''
        );
        return data;
      }
      return [];
    },
    async [WalletActionTypes.LOAD_VESTED_TOKENS](): Promise<{
      delayed: boolean,
      endTime: string,
      toAddress: string,
      amount: { amount: string, denom: string }
    }[]> {
      const client = await NolusClient.getInstance().getTendermintClient();

      const data = await client.txSearch({ query: `message.action='/cosmos.vesting.v1beta1.MsgCreateVestingAccount' AND transfer.sender='${WalletManager.getWalletAddress()}'` });
      const registry = new Registry(defaultStargateTypes);

      let items = data.txs.map(async (tx) => {
        const decodedTx: DecodedTxRaw = decodeTxRaw(tx.tx);
        for (const message of decodedTx.body.messages) {
          const decodedMsg = registry.decode(message);
          const date = new Date(decodedMsg.endTime.toNumber() * 1000);
          const block = await client.block(tx.height);
          const blockDate = block.block.header.time;

          const from = `${blockDate.toLocaleDateString('en-US', { day: '2-digit' })}/${blockDate.toLocaleDateString('en-US', { month: '2-digit' })}/${blockDate.toLocaleDateString('en-US', { year: 'numeric' })}`;
          const to = `${date.toLocaleDateString('en-US', { day: '2-digit' })}/${date.toLocaleDateString('en-US', { month: '2-digit' })}/${date.toLocaleDateString('en-US', { year: 'numeric' })}`;

          decodedMsg.endTime = `${from} - ${to}`;
          decodedMsg.amount = decodedMsg.amount[0];

          return decodedMsg;
        }

      });
      return Promise.all(items);
    },
    async [WalletActionTypes.CONNECT_GOOGLE]() {
      const instance = await Web3AuthProvider.getInstance();

      if (instance.web3auth.status == ADAPTER_STATUS.CONNECTED) {
        const provider = instance.web3auth.provider;

        if (provider) {

          const privateKeyStr = await provider.request({
            method: "private_key"
          });

          if (KeyUtilities.isPrivateKey(privateKeyStr as string)) {
            
            const privateKey = Buffer.from(privateKeyStr as string, 'hex');
            const directSecrWallet = await DirectSecp256k1Wallet.fromKey(
              privateKey,
              ChainConstants.BECH32_PREFIX_ACC_ADDR
            );

            const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(directSecrWallet);
            await nolusWalletOfflineSigner.useAccount();
            this.wallet = nolusWalletOfflineSigner;
            this.privateKey = toHex(privateKey);
            await Web3AuthProvider.logout();
            return true;

          }

        }

      }

      await instance.connect();
    },
    async [WalletActionTypes.LOAD_STAKED_TOKENS]() {
      const url = NETWORKS[EnvNetworkUtils.getStoredNetworkName()].api;
      const data = await fetch(`${url}/cosmos/staking/v1beta1/delegations/${WalletManager.getWalletAddress()}`);
      const json = await data.json();
      const [item] = json.delegation_responses;
      if(item){
        this.stakingBalance = item.balance;
      }
    },
    async [WalletActionTypes.LOAD_SUPPLIED_AMOUNT]() {
      const walletAddress = this?.wallet?.address ?? WalletManager.getWalletAddress();
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const lppClient = new Lpp(cosmWasmClient, CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].lpp.instance);
      const depositBalance = await lppClient.getLenderDeposit(
        walletAddress as string
      );
      this.suppliedBalance = depositBalance.balance;
    },
    async [WalletActionTypes.LOAD_WALLET_NAME]() {
      switch (WalletManager.getWalletConnectMechanism()) {
        case (WalletConnectMechanism.EXTENSION): {
          break;
        }
        default: {
          this.walletName = WalletManager.getWalletName();
          break;
        }
      }
    },
  },
  getters: {
    getCurrencyInfo: (state) => {
      return (denom: string) => {
        const currency = state.currencies[denom];

        if(!currency){
          return {
            ticker: 'NLS',
            coinDenom: ASSETS.NLS.abbreviation,
            coinMinimalDenom: denom,
            coinDecimals: Number(CURRENCIES.currencies.NLS.decimal_digits),
            coinAbbreviation: ASSETS.NLS.abbreviation,
            coinGeckoId: ASSETS.NLS.coinGeckoId,
            coinIcon: ASSETS.NLS.coinIcon
          }
        }

        const key = currency.ticker as keyof typeof ASSETS;

        return {
          ticker: key,
          coinDenom: ASSETS[key].abbreviation,
          coinMinimalDenom: denom,
          coinDecimals: Number(currency.decimal_digits),
          coinAbbreviation: ASSETS[key].abbreviation,
          coinGeckoId: ASSETS[key].coinGeckoId,
          coinIcon: ASSETS[key].coinIcon
        }
      };
    },
    getCurrencyByTicker: (state) => {
      return (ticker: string) => {
        return CURRENCIES.currencies[ticker as keyof typeof CURRENCIES.currencies]
      };
    },
    getIbcDenomBySymbol: (state) => {
      return (symbol: string) => {
        for (const key in state.currencies) {
          if (symbol == state.currencies[key].symbol) {
            return key;
          }
        }
      };
    }
  },
});

export { useWalletStore, WalletActionTypes };
