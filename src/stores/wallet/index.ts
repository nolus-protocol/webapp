import KeplrEmbedChainInfo from "@/config/keplr";
import router from "@/router";
import BluetoothTransport from "@ledgerhq/hw-transport-web-ble";
import TransportWebUSB from "@ledgerhq/hw-transport-webusb";

import type { HdPath } from "@cosmjs/crypto";
import type { State } from "@/stores/wallet/state";
import type { Window as KeplrWindow } from "@keplr-wallet/types/build/window";
import type { ReadonlyDateWithNanoseconds, TxSearchResponse } from "@cosmjs/tendermint-rpc";

import { WalletConnectMechanism } from "@/types";
import { defineStore } from "pinia";
import { WalletActionTypes } from "@/stores/wallet/action-types";
import { DirectSecp256k1Wallet } from "@cosmjs/proto-signing";
import { ChainConstants } from "@nolus/nolusjs/build/constants";
import { fromHex, toHex } from "@cosmjs/encoding";
import { RouteNames } from "@/router/RouterNames";
import { LedgerSigner } from "@cosmjs/ledger-amino";
import { decodeTxRaw, type DecodedTxRaw, Registry } from "@cosmjs/proto-signing";
import { NATIVE_ASSET, LedgerName } from "@/config/env";
import { ASSETS } from "@/config/assetsInfo";
import { ADAPTER_STATUS } from "@web3auth/base";
import { Buffer } from "buffer";
import { Lpp, Leaser } from "@nolus/nolusjs/build/contracts";
import { CONTRACTS } from "@/config/contracts";
import { Coin, Dec, Int } from "@keplr-wallet/unit";
import { coin, makeCosmoshubPath } from "@cosmjs/amino";
import { EncryptionUtils, EnvNetworkUtils, KeyUtils as KeyUtilities, WalletUtils, AssetUtils, Web3AuthProvider, WalletManager } from "@/utils";
import { CurrencyUtils, KeyUtils, NolusClient, NolusWalletFactory } from "@nolus/nolusjs";
import { useApplicationStore } from "../application";
import { defaultRegistryTypes, } from "@cosmjs/stargate";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { ApptUtils } from "@/utils/AppUtils";
import { getOfflineSigner, connectSnap, getSnap, experimentalSuggestChain } from "@leapwallet/cosmos-snap-provider";

const useWalletStore = defineStore("wallet", {
  state: () => {
    return {
      torusClient: null,
      wallet: null,
      privateKey: null,
      walletName: null,
      balances: [],
      currencies: {},
      stakingBalance: null,
      delegated_vesting: null,
      delegated_free: null,
      leaserConfig: null,
      suppliedBalance: "0",
      apr: 0,
      vest: [],
      lppPrice: new Dec(0)
    } as State;
  },
  actions: {
    [WalletActionTypes.DISCONNECT]() {
      this.wallet = null;
      this.walletName = null;
      this.privateKey = null;
    },
    async [WalletActionTypes.CONNECT_KEPLR](
      payload: { isFromAuth?: boolean } = {}
    ) {
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
          const networkConfig = await ApptUtils.fetchEndpoints(ChainConstants.CHAIN_KEY);
          NolusClient.setInstance(networkConfig.rpc);

          chainId = await NolusClient.getInstance().getChainId();
          await keplrWindow.keplr?.experimentalSuggestChain(
            KeplrEmbedChainInfo(
              EnvNetworkUtils.getStoredNetworkName(),
              chainId,
              networkConfig.rpc as string,
              networkConfig.api as string
            )
          );
        } catch (e) {
          console.log(e)

          throw new Error("Failed to fetch suggest chain.");
        }

        await keplrWindow.keplr?.enable(chainId);

        if (keplrWindow.getOfflineSignerOnlyAmino) {
          const offlineSigner = keplrWindow.getOfflineSignerOnlyAmino(
            chainId
          );
          const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(offlineSigner as any);
          await nolusWalletOfflineSigner.useAccount();

          WalletManager.saveWalletConnectMechanism(
            WalletConnectMechanism.EXTENSION
          );

          WalletManager.storeWalletAddress(
            nolusWalletOfflineSigner.address || ""
          );

          WalletManager.setPubKey(
            Buffer.from(nolusWalletOfflineSigner?.pubKey ?? "").toString("hex")
          );

          this.wallet = nolusWalletOfflineSigner;
          this.walletName = (await keplrWindow.keplr.getKey(chainId)).name;

          await this[WalletActionTypes.UPDATE_BALANCES]();

          if (payload?.isFromAuth) {
            await router.push({ name: RouteNames.DASHBOARD });
          }
        }
      }
    },
    async [WalletActionTypes.CONNECT_LEAP](
      payload: { isFromAuth?: boolean } = {}
    ) {
      await WalletUtils.getLeap();
      const leapWindow = window as any;

      if (!leapWindow.leap.getOfflineSignerOnlyAmino || !leapWindow.leap) {
        throw new Error("Leap wallet is not installed.");
      } else if (!leapWindow.leap.experimentalSuggestChain) {
        throw new Error(
          "Leap version is not latest. Please upgrade your Leap wallet"
        );
      } else {
        let chainId = "";

        try {

          const networkConfig = await ApptUtils.fetchEndpoints(ChainConstants.CHAIN_KEY);
          NolusClient.setInstance(networkConfig.rpc);

          chainId = await NolusClient.getInstance().getChainId();
          await leapWindow.leap?.experimentalSuggestChain(
            KeplrEmbedChainInfo(
              EnvNetworkUtils.getStoredNetworkName(),
              chainId,
              networkConfig.rpc as string,
              networkConfig.api as string
            )
          );
        } catch (e: Error | any) {
          throw new Error(e.message);
        }

        await leapWindow.leap?.enable(chainId);

        if (leapWindow.leap.getOfflineSignerOnlyAmino) {
          const offlineSigner = leapWindow.leap.getOfflineSignerOnlyAmino(
            chainId
          );
          const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(offlineSigner as any);
          await nolusWalletOfflineSigner.useAccount();

          WalletManager.saveWalletConnectMechanism(
            WalletConnectMechanism.LEAP
          );

          WalletManager.storeWalletAddress(
            nolusWalletOfflineSigner.address || ""
          );

          WalletManager.setPubKey(
            Buffer.from(nolusWalletOfflineSigner?.pubKey ?? "").toString("hex")
          );

          this.wallet = nolusWalletOfflineSigner;
          this.walletName = (await leapWindow.leap.getKey(chainId)).name;

          await this[WalletActionTypes.UPDATE_BALANCES]();

          if (payload?.isFromAuth) {
            await router.push({ name: RouteNames.DASHBOARD });
          }
        }
      }
    },
    async [WalletActionTypes.CONNECT_METAMASK](
      payload: { isFromAuth?: boolean } = {}
    ) {

      try {

        const snapInstalled = await getSnap();

        if (!snapInstalled) {
          await connectSnap(); // Initiates installation if not already present
        }

        let chainId = "";

        const networkConfig = await ApptUtils.fetchEndpoints(ChainConstants.CHAIN_KEY);
        NolusClient.setInstance(networkConfig.rpc);

        chainId = await NolusClient.getInstance().getChainId();
        await experimentalSuggestChain(
          KeplrEmbedChainInfo(
            EnvNetworkUtils.getStoredNetworkName(),
            chainId,
            networkConfig.rpc as string,
            networkConfig.api as string
          )
        );

        const offlineSigner = getOfflineSigner(
          chainId
        );

        const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(offlineSigner as any);
        await nolusWalletOfflineSigner.useAccount();

        WalletManager.saveWalletConnectMechanism(
          WalletConnectMechanism.METAMASK
        );

        WalletManager.storeWalletAddress(
          nolusWalletOfflineSigner.address || ""
        );

        WalletManager.setPubKey(
          Buffer.from(nolusWalletOfflineSigner?.pubKey ?? "").toString("hex")
        );

        this.wallet = nolusWalletOfflineSigner;
        this.walletName = WalletConnectMechanism.METAMASK;

        await this[WalletActionTypes.UPDATE_BALANCES]();

        if (payload?.isFromAuth) {
          await router.push({ name: RouteNames.DASHBOARD });
        }

      } catch (e: Error | any) {
        console.log(e)
        throw new Error(e.message);
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
      const networkConfig = await ApptUtils.fetchEndpoints(ChainConstants.CHAIN_KEY);

      NolusClient.setInstance(networkConfig.rpc);

      while (!ledgerWallet && !breakLoop) {
        try {
          const isConnectedViaLedgerBluetooth =
            WalletManager.getWalletConnectMechanism() ===
            WalletConnectMechanism.LEDGER_BLUETOOTH;
          const transport =
            payload.isBluetooth || isConnectedViaLedgerBluetooth
              ? await BluetoothTransport.create()
              : await TransportWebUSB.create();

          ledgerWallet = await NolusWalletFactory.nolusLedgerWallet(
            new LedgerSigner(transport, {
              prefix: ChainConstants.BECH32_PREFIX_ACC_ADDR,
              hdPaths: paths,
            })
          );

          await ledgerWallet.useAccount();
          this.wallet = ledgerWallet;

          WalletManager.saveWalletConnectMechanism(
            payload.isBluetooth
              ? WalletConnectMechanism.LEDGER_BLUETOOTH
              : WalletConnectMechanism.LEDGER
          );
          WalletManager.storeWalletAddress(ledgerWallet.address || "");
          WalletManager.setPubKey(
            Buffer.from(this.wallet?.pubKey ?? "").toString("hex")
          );
          this.walletName = LedgerName;

          if (payload?.isFromAuth) {
            await router.push({ name: RouteNames.DASHBOARD });
          }
        } catch (e) {
          breakLoop = true;
          throw new Error(e as string);
        }
      }
      await this[WalletActionTypes.UPDATE_BALANCES]();
      clearTimeout(to);
    },
    async [WalletActionTypes.CONNECT_VIA_MNEMONIC](mnemonic: string) {
      let privateKey: Uint8Array;

      if (KeyUtilities.isPrivateKey(mnemonic)) {
        privateKey = Buffer.from(mnemonic.trim().replace("0x", ""), "hex");
      } else {
        const accountNumbers = [0];
        const path: HdPath = accountNumbers.map(makeCosmoshubPath)[0];
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
      const privateKey = this.privateKey ?? "";
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
        WalletManager.storeWalletAddress(this.wallet?.address ?? "");
        WalletManager.setPubKey(
          Buffer.from(this.wallet?.pubKey ?? "").toString("hex")
        );
        WalletManager.storeEncryptedPubKey(encryptedPbKey);
        WalletManager.storeEncryptedPk(encryptedPk);
        this.privateKey = null;
      }
    },
    async [WalletActionTypes.UPDATE_BALANCES]() {
      try {
        const walletAddress = WalletManager.getWalletAddress() || "";
        const ibcBalances = [];
        const app = useApplicationStore();
        const currencies = app.currenciesData;

        if (!WalletUtils.isAuth()) {
          for (const key in currencies) {
            const currency = app.currenciesData![key];
            const ibcDenom = AssetUtils.makeIBCMinimalDenom(
              currency.ibc_route,
              currency.symbol
            );

            const data = {
              ticker: key,
              shortName: currency.shortName,
              name: currency.name,
              symbol: currency.symbol,
              decimal_digits: currency.decimal_digits
            };
            this.currencies[ibcDenom] = data;

            const item = {
              balance: CurrencyUtils.convertCosmosCoinToKeplCoin(coin('0', ibcDenom)),
            };

            ibcBalances.push(
              item
            );
          }

          this.balances = ibcBalances;

          return false;
        }

        for (const key in currencies) {
          const currency = app.currenciesData![key];
          const ibcDenom = AssetUtils.makeIBCMinimalDenom(
            currency.ibc_route,
            currency.symbol
          );

          ibcBalances.push(
            NolusClient.getInstance()
              .getBalance(walletAddress, ibcDenom)
              .then((item) => {
                const data = {
                  ticker: key,
                  shortName: currency.shortName,
                  name: currency.name,
                  symbol: currency.symbol,
                  decimal_digits: currency.decimal_digits
                };
                this.currencies[ibcDenom] = data;

                return {
                  balance: CurrencyUtils.convertCosmosCoinToKeplCoin(item),
                };
              })
          );
        }
        this.balances = await Promise.all(ibcBalances);

      } catch (e) {
        throw new Error(e as string);
      }
    },
    async [WalletActionTypes.LOAD_PRIVATE_KEY_AND_SIGN](payload: {
      password: string;
    }) {
      if (this.privateKey === null && payload.password !== "") {
        const encryptedPubKey = WalletManager.getEncryptedPubKey();
        const encryptedPk = WalletManager.getPrivateKey();
        const decryptedPubKey = EncryptionUtils.decryptEncryptionKey(
          encryptedPubKey,
          payload.password
        );
        const decryptedPrivateKey = EncryptionUtils.decryptPrivateKey(
          encryptedPk,
          decryptedPubKey,
          payload.password
        );
        const directSecrWallet = await DirectSecp256k1Wallet.fromKey(
          fromHex(decryptedPrivateKey),
          ChainConstants.BECH32_PREFIX_ACC_ADDR
        );
        const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(directSecrWallet);
        await nolusWalletOfflineSigner.useAccount();

        this.wallet = nolusWalletOfflineSigner;
        this.privateKey = null;
        await this[WalletActionTypes.UPDATE_BALANCES]();
      }
    },
    async [WalletActionTypes.SEARCH_TX]({
      sender_per_page = 5,
      sender_page = 1,
      load_sender = true,
      recipient_per_page = 5,
      recipient_page = 1,
      load_recipient = true,
    } = {}) {
      const address = WalletManager.getWalletAddress();
      const registry = new Registry(defaultRegistryTypes);
      registry.register("/cosmwasm.wasm.v1.MsgExecuteContract", MsgExecuteContract);

      if (address?.length > 0) {
        const client = await NolusClient.getInstance().getTendermintClient();
        const [sender, receiver]: any = await Promise.allSettled([
          load_sender
            ? client.txSearch({
              query: `message.sender='${address}'`,
              per_page: sender_per_page,
              page: sender_page,
              order_by: "desc",
            })
            : false,
          load_recipient
            ? client.txSearch({
              query: `transfer.recipient='${address}'`,
              per_page: recipient_per_page,
              page: recipient_page,
              order_by: "desc",
            })
            : false,
        ]);
        const data = [];
        let sender_total = 0;
        let receiver_total = 0;

        if (sender.value) {
          sender_total = (sender.value as TxSearchResponse).totalCount;
          for (const item of (sender.value as TxSearchResponse).txs) {
            const decodedTx: DecodedTxRaw = decodeTxRaw(item.tx);
            try {

              const msgs = []
              for (const m of decodedTx.body.messages) {
                msgs.push({
                  typeUrl: m.typeUrl,
                  data: registry.decode(m)
                });
              }

              const transactionResult = {
                id: item.hash ? toHex(item.hash) : "",
                height: item.height ?? "",
                msgs,
                type: "sender",
                blockDate: null as null | ReadonlyDateWithNanoseconds,
                memo: decodedTx.body.memo ?? "",
                log: item.result.log,
                fee: decodedTx?.authInfo?.fee?.amount.filter(
                  (coin) => coin.denom === ChainConstants.COIN_MINIMAL_DENOM
                ) ?? null,
              };

              data.push(transactionResult);
            } catch (error) {
              console.error(error);
            }
          }
        }

        if (receiver.value) {
          receiver_total = (receiver.value as TxSearchResponse).totalCount;
          for (const item of (receiver.value as TxSearchResponse).txs) {
            const decodedTx: DecodedTxRaw = decodeTxRaw(item.tx);
            try {

              const msgs = []
              for (const m of decodedTx.body.messages) {
                msgs.push({
                  typeUrl: m.typeUrl,
                  data: registry.decode(m)
                });
              }

              const transactionResult = {
                id: item.hash ? toHex(item.hash) : "",
                height: item.height ?? "",
                msgs,
                type: "receiver",
                blockDate: null as null | ReadonlyDateWithNanoseconds,
                memo: decodedTx.body.memo ?? "",
                log: item.result.log,
                fee: decodedTx?.authInfo?.fee?.amount.filter(
                  (coin) => coin.denom === ChainConstants.COIN_MINIMAL_DENOM
                ) ?? null,
              };

              data.push(transactionResult);
            } catch (error) {
              console.error(error);
            }
          }
        }

        const promises = data.map(async (item) => {
          try {
            const block = await client.block(item.height);
            item.blockDate = block.block.header.time;
            return item;
          } catch (error) {
            return item;
          }

        });

        const items = await Promise.all(promises);

        return {
          data: items,
          receiver_total,
          sender_total,
        };
      }

      return {
        data: [],
        receiver_total: 0,
        sender_total: 0,
      };
    },
    async [WalletActionTypes.LOAD_VESTED_TOKENS](): Promise<
      {
        endTime: string;
        amount: { amount: string; denom: string };
      }[]
    > {

      if (!WalletUtils.isAuth()) {
        this.vest = [];
        this.delegated_vesting = null;
        this.delegated_free = null;
        return [];
      }

      const url = (await ApptUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
      const data = await fetch(
        `${url}/cosmos/auth/v1beta1/accounts/${WalletManager.getWalletAddress()}`
      );

      const json = await data.json();
      const accData = json.account;
      const vesting_account = accData?.base_vesting_account;
      const items = [];
      const vest = [];

      if (vesting_account) {
        const start = new Date(accData.start_time * 1000);
        const end = new Date(vesting_account.end_time * 1000);

        const from = `${start.toLocaleDateString("en-US", {
          day: "2-digit",
        })}/${start.toLocaleDateString("en-US", {
          month: "2-digit",
        })}/${start.toLocaleDateString("en-US", { year: "numeric" })}`;
        const to = `${end.toLocaleDateString("en-US", {
          day: "2-digit",
        })}/${end.toLocaleDateString("en-US", {
          month: "2-digit",
        })}/${end.toLocaleDateString("en-US", { year: "numeric" })}`;

        items.push({
          endTime: `${from} - ${to}`,
          amount: vesting_account.original_vesting[0],
        });

        vest.push({
          start,
          end,
          amount: vesting_account.original_vesting[0],
        });

        this.vest = vest;
        this.delegated_vesting = vesting_account.delegated_vesting[0];
        this.delegated_free = vesting_account.delegated_free[0];;

      } else {
        this.vest = [];
        this.delegated_vesting = null;
        this.delegated_free = null;
      }

      return items;
    },
    async [WalletActionTypes.CONNECT_GOOGLE]() {
      const instance = await Web3AuthProvider.getInstance();

      if (instance.web3auth.status == ADAPTER_STATUS.CONNECTED) {
        const provider = instance.web3auth.provider;

        if (provider) {
          const privateKeyStr = await provider.request({
            method: "private_key",
          });

          if (KeyUtilities.isPrivateKey(privateKeyStr as string)) {
            const privateKey = Buffer.from(privateKeyStr as string, "hex");
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
    async [WalletActionTypes.LOAD_SUPPLIED_AMOUNT]() {
      const walletAddress = this?.wallet?.address ?? WalletManager.getWalletAddress();
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const lppClient = new Lpp(
        cosmWasmClient,
        CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].lpp.instance
      );
      const [depositBalance, lppPrice] = await Promise.all([
        lppClient.getLenderDeposit(
          walletAddress as string
        ),
        lppClient.getPrice()
      ]);
      const p = new Dec(lppPrice.amount_quote.amount).quo(new Dec(lppPrice.amount.amount));
      this.suppliedBalance = depositBalance.balance;
      this.lppPrice = p;
    },
    async [WalletActionTypes.LOAD_LEASER_CONFIG]() {
      if (!this.leaserConfig) {
        const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
        const leaserClient = new Leaser(
          cosmWasmClient,
          CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance
        );
        this.leaserConfig = await leaserClient.getLeaserConfig();
      }
      return this.leaserConfig;
    },
    async [WalletActionTypes.LOAD_WALLET_NAME]() {
      switch (WalletManager.getWalletConnectMechanism()) {
        case WalletConnectMechanism.EXTENSION: {
          break;
        }
        case WalletConnectMechanism.LEAP: {
          break;
        }
        case WalletConnectMechanism.LEDGER: {
          this.walletName = LedgerName;
          break;
        }
        case WalletConnectMechanism.LEDGER_BLUETOOTH: {
          this.walletName = LedgerName;
          break;
        }
        default: {
          this.walletName = WalletManager.getWalletName();
          break;
        }
      }
    },
    async [WalletActionTypes.LOAD_STAKED_TOKENS]() {

      if (!WalletUtils.isAuth()) {
        return false;
      }

      try {
        const url = (await ApptUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
        const data = await fetch(
          `${url}/cosmos/staking/v1beta1/delegations/${WalletManager.getWalletAddress()}`
        );
        const json = await data.json();

        if (json.delegation_responses) {
          const s = new Coin(NATIVE_ASSET.denom, new Int(0));
          let am = new Int(0);
          for (const item of json.delegation_responses) {
            am = am.add(new Int(item.balance.amount));
          }
          s.amount = am;
          this.stakingBalance = s;
        } else {
          this.stakingBalance = new Coin(NATIVE_ASSET.denom, new Int(0));;
        }
      } catch (e) {
        this.stakingBalance = new Coin(NATIVE_ASSET.denom, new Int(0));
      }
    },
    async [WalletActionTypes.LOAD_APR]() {

      try {
        const url = (await ApptUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
        const [stakingBalance, infolation_data] = await Promise.all([
          fetch(
            `${url}/cosmos/staking/v1beta1/pool`
          ).then((data) => data.json()),
          fetch(
            `${url}/nolus/mint/v1beta1/annual_inflation`
          ).then((data) => data.json())
        ]);
        const bonded = Number(stakingBalance.pool.bonded_tokens);
        const inflation = Number(infolation_data.annual_inflation ?? 0);
        this.apr = (inflation / bonded) * 100;
      } catch (error) {
        this.apr = 0;
      }

    },
    async [WalletActionTypes.LOAD_VALIDATORS]() {
      const url = (await ApptUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
      const limit = 100;
      const offset = 0;
      const walletAddress = WalletManager.getWalletAddress() || "";

      return await loadValidators(url, [], walletAddress, offset, limit);

    },
    async [WalletActionTypes.LOAD_DELEGATOR]() {

      if (!WalletUtils.isAuth()) {
        return [];
      }

      const url = (await ApptUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
      const walletAddress = WalletManager.getWalletAddress() || "";

      return await fetch(
        `${url}/cosmos/distribution/v1beta1/delegators/${walletAddress}/rewards`
      ).then((data) => data.json());
    },
    async [WalletActionTypes.LOAD_VALIDATOR](validatorAddress: string) {
      const url = (await ApptUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
      return await fetch(
        `${url}/cosmos/staking/v1beta1/validators/${validatorAddress}`
      ).then((data) => data.json());
    },
    async [WalletActionTypes.LOAD_DELEGATOR_VALIDATORS]() {
      const url = (await ApptUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
      const limit = 100;
      const offset = 0;
      const walletAddress = WalletManager.getWalletAddress() || "";

      return await loadDelegatorValidators(url, [], walletAddress, offset, limit);
    },
    async [WalletActionTypes.LOAD_UNBONDING_DELEGATIONS]() {

      if (!WalletUtils.isAuth()) {
        return [];
      }

      const url = (await ApptUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
      const limit = 100;
      const offset = 0;
      const walletAddress = WalletManager.getWalletAddress() || "";

      return await loadUnbondingDelegatoins(url, [], walletAddress, offset, limit);
    },
    async [WalletActionTypes.LOAD_DELEGATIONS]() {

      if (!WalletUtils.isAuth()) {
        return [];
      }

      const url = (await ApptUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
      const limit = 100;
      const offset = 0;
      const walletAddress = WalletManager.getWalletAddress() || "";

      return await loadDelegatoins(url, [], walletAddress, offset, limit);
    },
  },
  getters: {
    available: (state) => {
      let balance = new Dec(0, ChainConstants.COIN_DECIMALS);
      let notAvailable = new Dec(0, ChainConstants.COIN_DECIMALS);

      for (const b of state.balances) {
        if (b.balance.denom == ChainConstants.COIN_MINIMAL_DENOM) {
          balance = balance.add(new Dec(b.balance.amount, ChainConstants.COIN_DECIMALS));
          break;
        }
      }

      for (const b of state.vest) {
        const date = new Date();
        const diff = b.end.getTime() - b.start.getTime();
        const diffNow = date.getTime() - b.start.getTime();
        let q = diffNow / diff;

        if (q > 1) {
          q = 1;
        }

        if (q < 0) {
          q = 0;
        }

        const amount = new Dec(b.amount.amount, ChainConstants.COIN_DECIMALS);
        const navbl = amount.mul(new Dec(1 - q));
        notAvailable = notAvailable.add(navbl);
      }


      if (state.delegated_vesting) {
        const amount = new Dec(state.delegated_vesting?.amount?.toString() ?? '0', ChainConstants.COIN_DECIMALS);
        if (amount.lt(notAvailable)) {
          balance = balance.add(amount);
        }
      } else {
        balance = balance.sub(notAvailable);
      }

      if (balance.isNegative()) {
        balance = new Dec(0);
      }

      const int = new Int(balance.mul(new Dec(10).pow(new Int(ChainConstants.COIN_DECIMALS))).toString(0));

      return { amount: int, denom: ChainConstants.COIN_MINIMAL_DENOM };
    },
    vestTokens: (state) => {
      let balance = new Dec(0, ChainConstants.COIN_DECIMALS);

      for (const b of state.vest) {
        const date = new Date();
        const diff = b.end.getTime() - b.start.getTime();
        const diffNow = date.getTime() - b.start.getTime();
        let q = diffNow / diff;

        if (q > 1) {
          q = 1;
        }

        if (q < 0) {
          q = 0;
        }

        const amount = new Dec(b.amount.amount, ChainConstants.COIN_DECIMALS);
        const notAvailable = amount.sub(amount.mul(new Dec(q)));
        balance = balance.add(notAvailable);
      }


      const int = new Int(balance.mul(new Dec(10).pow(new Int(ChainConstants.COIN_DECIMALS))).toString(0));

      return { amount: int, denom: ChainConstants.COIN_MINIMAL_DENOM };
    },
    getCurrencyInfo: (state) => {
      return (denom: string) => {
        const currency = state.currencies[denom];
        const app = useApplicationStore();
        const assetIcons = app.assetIcons!;

        if (!currency) {
          return {
            ticker: app.native?.ticker as string,
            shortName: app.native?.shortName as string,
            coinDenom: app.native?.symbol as string,
            coinMinimalDenom: app.native?.symbol as string,
            coinDecimals: Number(0),
            coinAbbreviation: app.native?.name as string,
            coinGeckoId: ASSETS.NLS.coinGeckoId,
            coinIcon: app.assetIcons?.NLS as string,
          };
        }

        const key = currency?.ticker as keyof typeof ASSETS;
        return {
          ticker: key,
          shortName: currency.shortName,
          coinDenom: currency.name,
          coinMinimalDenom: denom,
          coinDecimals: Number(currency.decimal_digits),
          coinAbbreviation: currency.name,
          coinGeckoId: ASSETS[key].coinGeckoId,
          coinIcon: assetIcons[key]
        };
      };
    },
    getCurrencyByTicker: (state) => {
      const app = useApplicationStore();
      return (ticker: string) => {
        return app.currenciesData![
          ticker
        ];
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
    },
  },
});

const loadValidators: any = async (url: string, validators: any[], address: string, offset: number, limit: number) => {
  const data = await fetch(`${url}/cosmos/staking/v1beta1/validators?pagination.limit=${limit}&pagination.offset=${offset}&status=BOND_STATUS_BONDED`).then((data) => data.json());
  validators = [...validators, ...data.validators];
  offset += limit;
  if (data.pagination.next_key) {
    return await loadValidators(url, validators, address, offset, limit);
  }
  return validators;
}

const loadDelegatorValidators: any = async (url: string, validators: any[], address: string, offset: number, limit: number) => {
  const data = await fetch(`${url}/cosmos/staking/v1beta1/delegators/${address}/validators?pagination.limit=${limit}&pagination.offset=${offset}`).then((data) => data.json());
  validators = [...validators, ...data.validators];
  offset += limit;
  if (data.pagination.next_key) {
    return await loadDelegatorValidators(url, validators, address, offset, limit);
  }
  return validators;
}

const loadDelegatoins: any = async (url: string, delegations: any[], address: string, offset: number, limit: number) => {
  const data = await fetch(`${url}/cosmos/staking/v1beta1/delegations/${address}?pagination.limit=${limit}&pagination.offset=${offset}`).then((data) => data.json());
  delegations = [...delegations, ...data.delegation_responses];
  offset += limit;
  if (data.pagination.next_key) {
    return await loadDelegatoins(url, delegations, address, offset, limit);
  }
  return delegations;
}

const loadUnbondingDelegatoins: any = async (url: string, unbondingDelegations: any[], address: string, offset: number, limit: number) => {
  const data = await fetch(`${url}/cosmos/staking/v1beta1/delegators/${address}/unbonding_delegations?pagination.limit=${limit}&pagination.offset=${offset}`).then((data) => data.json());
  unbondingDelegations = [...unbondingDelegations, ...data.unbonding_responses];
  offset += limit;
  if (data.pagination.next_key) {
    return await loadUnbondingDelegatoins(url, unbondingDelegations, address, offset, limit);
  }
  return unbondingDelegations;
}

export { useWalletStore, WalletActionTypes };
