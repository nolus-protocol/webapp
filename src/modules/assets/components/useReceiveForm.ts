import type { AssetBalance } from "@/common/stores/wallet/types";
import type { Coin } from "@keplr-wallet/types";

import { SwapStatus } from "../enums";
import { NETWORK_DATA } from "@/networks/config";
import { IGNORED_NETWORKS } from "../../../config/global";

import type { Wallet } from "@/networks";
import { type BaseWallet } from "@/networks";
import type { NolusWallet } from "@nolus/nolusjs";
import type { AdvancedCurrencyFieldOption } from "web-components";
import { CONFIRM_STEP, type SkipRouteConfigType } from "@/common/types";
import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { computed, onUnmounted, ref, watch, inject } from "vue";
import { useI18n } from "vue-i18n";
import { classifyError, externalWallet, Logger, walletOperation, WalletAccess } from "@/common/utils";
import { formatDecAsUsd, formatUsd, formatTokenBalance } from "@/common/utils/NumberFormatUtils";
import {
  getCurrencyByTickerForNetwork,
  getPriceForCurrency,
  tryGetCurrencyByDenom
} from "@/common/utils/CurrencyLookup";
import { getSkipRouteConfig } from "@/common/utils/ConfigService";
import { coin } from "@cosmjs/stargate";
import { Decimal } from "@cosmjs/math";
import { SkipRouter, type SkipTxResult } from "@/common/utils/SkipRoute";
import type { NetworkInfo } from "@/common/api/types/config";
import { Dec } from "@keplr-wallet/unit";
import { useConfigStore } from "@/common/stores/config";
import { useHistoryStore } from "@/common/stores/history";
import { HISTORY_ACTIONS } from "@/modules/history/types";
import type { RouteResponse, Chain } from "@/common/types/skipRoute";

export function useReceiveForm() {
  const i18n = useI18n();

  const assets = computed(() => {
    const data = [];

    for (const asset of networkCurrencies.value ?? []) {
      const currency = tryGetCurrencyByDenom(asset.from);
      if (!currency) continue; // Skip deprecated/removed denoms

      const assetBalance = asset.balance;
      if (assetBalance === undefined) {
        console.error(`Missing balance for asset ${asset.from}`);
        continue;
      }

      const value = new Dec(assetBalance.amount.toString(), asset.decimal_digits);
      const balance = formatTokenBalance(value);
      const exactBalance = value.isZero() ? "0" : value.toString(asset.decimal_digits).replace(/\.?0+$/, "");

      const price = new Dec(getPriceForCurrency(currency));
      const stable = price.mul(value);
      data.push({
        name: currency.name,
        value: asset.from,
        label: currency.shortName,
        shortName: currency.shortName,
        icon: currency.icon,
        decimal_digits: currency.decimal_digits,
        balance: {
          value: exactBalance,
          customLabel: `${balance} ${currency.shortName}`,
          ticker: currency.shortName,
          denom: assetBalance.denom,
          amount: assetBalance.amount
        },
        from: asset.from,
        native: asset.native,
        symbol: asset.symbol,
        ticker: asset.ticker,
        stable,
        price: formatDecAsUsd(stable)
      });
    }
    return data.sort((a, b) => {
      return Number(b.stable.sub(a.stable).toString(8));
    });
  });

  let client: Wallet;
  let timeOut!: NodeJS.Timeout;
  let route: RouteResponse | null;

  const walletStore = useWalletStore();
  const balancesStore = useBalancesStore();
  const configStore = useConfigStore();
  const historyStore = useHistoryStore();
  const networks = ref(NETWORK_DATA.list);

  const selectedNetwork = ref(0);
  const networkCurrencies = ref<AssetBalance[]>([]);
  const selectedCurrency = ref(0);
  const amount = ref("");
  const amountErrorMsg = ref("");
  const txHashes = ref<{ hash: string; status: SwapStatus; url: string | null }[]>([]);

  const step = ref(CONFIRM_STEP.CONFIRM);
  const fee = ref<Coin>();
  const isLoading = ref(false);
  const disablePicker = ref(false);
  const isDisabled = ref(false);
  const tempRoute = ref<RouteResponse | null>(null);
  let chainsData: Chain[] = [];

  const wallet = ref(walletStore.wallet?.address);
  let skipRouteConfig: SkipRouteConfigType | null;
  const id = Date.now();
  const onClose = inject("close", () => {});

  // Repopulate when the store is ready AND whenever the wallet-driven network
  // filter changes. protocolFilter starts "" and is set to the owned network
  // (e.g. "OSMOSIS") only after the async wallet reconnect completes — later than
  // `initialized` flips — so reacting to `initialized` alone snapshots an empty
  // list and never recovers.
  //
  // Reacts to: configStore.initialized + configStore.protocolFilter.
  // Idempotency: onInit() recomputes the receive currency list from the current
  // store snapshot, so the immediate run and every re-fire are safe.
  watch(
    [() => configStore.initialized, () => configStore.protocolFilter],
    () => {
      if (configStore.initialized) {
        void onInit();
      }
    },
    {
      immediate: true
    }
  );

  async function onInit() {
    try {
      const [config, chns] = await Promise.all([getSkipRouteConfig(), SkipRouter.getChains()]);
      skipRouteConfig = config;
      chainsData = chns;

      const n = NETWORK_DATA.list.filter((item) => {
        if (config.transfers[item.key]) {
          return true;
        }
        return false;
      });

      networks.value = [...n].filter((item) => {
        return !IGNORED_NETWORKS.includes(item.key);
      });
      const index = networks.value.findIndex((item) => item.key === configStore.protocolFilter);
      if (index < 0) {
        selectedNetwork.value = 0;
      } else {
        selectedNetwork.value = index;
      }
      const selected = networks.value[selectedNetwork.value];
      if (selected === undefined) {
        throw new Error("No transfer networks available");
      }
      await onUpdateNetwork(selected);
    } catch (error) {
      Logger.error(error);
    }
  }

  onUnmounted(() => {
    if (client && step.value !== CONFIRM_STEP.PENDING) {
      destroyClient();
    }

    clearTimeout(timeOut);
  });

  const network = computed(() => {
    return networks.value[selectedNetwork.value];
  });

  const currency = computed(() => {
    return assets.value[selectedCurrency.value];
  });

  const calculatedBalance = computed(() => {
    const asset = assets.value[selectedCurrency.value];
    if (!asset) {
      return formatUsd(0);
    }

    const currency = tryGetCurrencyByDenom(asset.from);
    if (!currency) return formatUsd(0);

    const price = new Dec(getPriceForCurrency(currency));
    const v = amount?.value?.length ? amount?.value : "0";
    const stable = price.mul(new Dec(v));
    return formatDecAsUsd(stable);
  });

  function destroyClient() {
    try {
      client.destroy();
    } catch {
      // intentionally empty - destroy errors are non-critical
    }
  }

  function setHistory() {
    if (!tempRoute.value) return;
    const chains = getChainIds(tempRoute.value);

    if (route == null) {
      throw new Error("Route not available");
    }
    const selectedAsset = currency.value;
    if (selectedAsset === undefined) {
      throw new Error("Selected currency not available");
    }
    const nolusWallet = walletStore.wallet;
    if (nolusWallet === undefined) {
      throw new Error("Wallet not connected");
    }

    // Spread copy: `RouteResponse` is an interface without an index signature, so it
    // is not assignable to IObjectKeys; the anonymous spread type is.
    const data = {
      id,
      chains,
      skipRoute: { ...route },
      fromAddress: wallet.value,
      currency: selectedAsset.from,
      receiverAddress: nolusWallet.address,
      type: HISTORY_ACTIONS.RECEIVE
    };
    historyStore.addPendingTransfer(data, i18n);
  }

  // Reacts to: selected currency, amount, and wallet address. validateAmount()
  // runs first (idempotent — resets amountErrorMsg each call) and gates the
  // debounced route fetch. This subsumes the previous amount/currency-only watch,
  // which fired validateAmount() redundantly on the same dependency changes.
  watch(
    () => [selectedCurrency.value, amount.value, wallet.value],
    () => {
      if (amount.value.length > 0) {
        if (validateAmount() && (wallet.value?.length ?? 0) > 0) {
          clearTimeout(timeOut);
          tempRoute.value = null;
          timeOut = setTimeout(() => {
            void (async () => {
              try {
                tempRoute.value = await getRoute();
              } catch (e: unknown) {
                amountErrorMsg.value = i18n.t(classifyError(e));
              }
            })();
          });
        }
      }
    }
  );

  async function onUpdateNetwork(event: (typeof networks.value)[number]) {
    tempRoute.value = null;
    selectedNetwork.value = networks.value.findIndex((item) => item === event);
    if (!event.native) {
      await setCosmosNetwork();
    }
  }

  function handleAmountChange(event: string) {
    amount.value = event;
  }

  function onSelectCurrency(option: AdvancedCurrencyFieldOption) {
    selectedCurrency.value = assets.value.findIndex((item) => item === option);
  }

  async function onSubmitCosmos() {
    try {
      amountErrorMsg.value = "";
      const isValid = validateAmount();

      if (isValid) {
        route = await getRoute();
        const currentNetwork = network.value;
        if (currentNetwork === undefined) {
          throw new Error("Network not selected");
        }
        const networkdata = NETWORK_DATA?.supportedNetworks[currentNetwork.key];
        if (networkdata === undefined) {
          throw new Error(`Unsupported network: ${currentNetwork.key}`);
        }
        const currency = getCurrencyByTickerForNetwork(networkdata.ticker);
        fee.value = coin(networkdata.fees.transfer_amount, currency.ibcData);
      }
    } catch (e: unknown) {
      amountErrorMsg.value = i18n.t(classifyError(e));
    }
  }

  async function setCosmosNetwork() {
    networkCurrencies.value = [];
    amount.value = "";
    amountErrorMsg.value = "";
    destroyClient();

    disablePicker.value = true;
    try {
      const ntwrk = NETWORK_DATA;
      const currentNetwork = network.value;
      if (currentNetwork === undefined) {
        throw new Error("Network not selected");
      }

      const currencies = [];
      const promises = [];
      const data = skipRouteConfig?.transfers?.[currentNetwork.key]?.currencies;
      for (const c of data ?? []) {
        if (c.visible && configStore.protocolFilter !== c.visible) continue;

        const currency = tryGetCurrencyByDenom(c.from);
        if (!currency) continue; // Skip deprecated/removed denoms

        currencies.push({ ...currency, balance: coin(0, c.to) });
      }

      const mappedCurrencies = currencies.map((item) => {
        return {
          balance: item.balance,
          shortName: item.shortName,
          ticker: item.ticker,
          name: item.shortName,
          icon: item.icon,
          decimal_digits: item.decimal_digits,
          symbol: item.symbol,
          native: item.native,
          from: item.ibcData
        };
      });

      const networkData = ntwrk?.supportedNetworks[currentNetwork.key];
      if (networkData === undefined) {
        throw new Error(`Unsupported network: ${currentNetwork.key}`);
      }
      client = await WalletAccess.getWallet(currentNetwork.key);
      const baseWallet = (await externalWallet(client, networkData)) as BaseWallet;
      wallet.value = baseWallet?.address as string;

      if (WalletAccess.isAuth()) {
        for (const c of mappedCurrencies) {
          async function fn() {
            const balance = await client.getBalance(wallet.value as string, c.balance.denom);
            c.balance = balance;
          }
          promises.push(fn());
        }
      }

      await Promise.all(promises);

      networkCurrencies.value = mappedCurrencies;
      selectedCurrency.value = 0;
    } finally {
      disablePicker.value = false;
    }
  }

  function validateAmount() {
    amountErrorMsg.value = "";

    if (!WalletAccess.isAuth()) {
      return false;
    }

    if (!amount.value) {
      amountErrorMsg.value = i18n.t("message.invalid-amount");
      return false;
    }
    const asset = assets.value[selectedCurrency.value];

    const decimals = asset?.decimal_digits;
    if (decimals) {
      try {
        const balance = asset.balance;
        const walletBalance = Decimal.fromAtomics(balance.amount.toString(), decimals);
        const transferAmount = Decimal.fromUserInput(amount.value, decimals);
        const isGreaterThanWalletBalance = transferAmount.isGreaterThan(walletBalance);
        const isLowerThanOrEqualsToZero = transferAmount.isLessThanOrEqual(Decimal.fromUserInput("0", decimals));

        if (isLowerThanOrEqualsToZero) {
          amountErrorMsg.value = i18n.t("message.invalid-balance-low");
          return false;
        }

        if (isGreaterThanWalletBalance) {
          amountErrorMsg.value = i18n.t("message.invalid-balance-big");
          return false;
        }
      } catch (e) {
        Logger.error(e);
      }
    } else {
      amountErrorMsg.value = i18n.t("message.unexpected-error");
      return false;
    }

    return true;
  }

  async function onSwap() {
    try {
      isDisabled.value = true;
      await onSubmitCosmos();
      await onSubmit();
    } catch {
      step.value = CONFIRM_STEP.ERROR;
    } finally {
      isDisabled.value = false;
    }
  }

  async function onSubmit() {
    if (!route || !WalletAccess.isAuth() || amountErrorMsg.value.length > 0) {
      return false;
    }

    try {
      step.value = CONFIRM_STEP.PENDING;

      await walletOperation(async () => {
        try {
          isLoading.value = true;

          const wallets = await getWallets();

          for (const [key, chainWallet] of Object.entries(wallets)) {
            const walletAddress = chainWallet.address;
            if (!walletAddress) {
              throw new Error(`Wallet address not available for ${key}`);
            }
          }

          setHistory();
          await submit(wallets);
          await balancesStore.fetchBalances();

          void historyStore.loadActivities();
          step.value = CONFIRM_STEP.SUCCESS;
          const entry = walletStore.history[id];
          if (entry === undefined) {
            throw new Error("Pending transfer entry not found");
          }
          const { route: entryRoute, routeDetails } = entry.historyData;
          if (entryRoute === undefined || routeDetails === undefined) {
            throw new Error("Pending transfer entry is missing route data");
          }
          entryRoute.activeStep = entryRoute.steps.length;
          routeDetails.activeStep = routeDetails.steps.length;
          entry.historyData.status = CONFIRM_STEP.SUCCESS;
        } catch (error) {
          step.value = CONFIRM_STEP.ERROR;
          amountErrorMsg.value = i18n.t(classifyError(error));

          const entry = walletStore.history[id];
          if (entry) {
            entry.historyData.errorMsg = amountErrorMsg.value;

            const entryRoute = entry.historyData.route;
            if (entryRoute !== undefined) {
              const routeStep = entryRoute.steps[entryRoute.activeStep];
              if (routeStep !== undefined) {
                routeStep.approval = true;
              }
            }

            const routeDetails = entry.historyData.routeDetails;
            if (routeDetails !== undefined) {
              const detailsStep = routeDetails.steps[routeDetails.activeStep];
              if (detailsStep !== undefined) {
                detailsStep.approval = true;
              }
            }

            entry.historyData.status = CONFIRM_STEP.ERROR;
          }
          Logger.error(error);
        } finally {
          isLoading.value = false;
        }
      });
    } catch (e) {
      Logger.error(e);
    } finally {
      destroyClient();
    }
  }

  async function submit(wallets: { [key: string]: BaseWallet | NolusWallet }) {
    if (!route) {
      throw new Error("Route not available");
    }
    await SkipRouter.submitRoute(
      route,
      wallets,
      async (tx: SkipTxResult, wallet: BaseWallet | NolusWallet, chainId: string) => {
        const entry = walletStore.history[id];
        if (entry === undefined) {
          throw new Error("Pending transfer entry not found");
        }
        const { route: entryRoute, routeDetails } = entry.historyData;
        if (entryRoute === undefined || routeDetails === undefined) {
          throw new Error("Pending transfer entry is missing route data");
        }
        entryRoute.activeStep++;
        routeDetails.activeStep++;

        const element = {
          hash: tx.txHash,
          status: SwapStatus.pending,
          url: "explorer" in wallet ? wallet.explorer : null
        };

        txHashes.value.push(element);

        historyStore.setTransferTxHashes(
          String(id),
          txHashes.value.map((t) => t.hash)
        );

        await wallet.broadcastTx(tx.txBytes);
        await SkipRouter.track(chainId, tx.txHash);
        await SkipRouter.fetchStatus(tx.txHash, chainId);

        element.status = SwapStatus.success;
      }
    );
    onClose();
  }

  async function getWallets(): Promise<{ [key: string]: BaseWallet | NolusWallet }> {
    if (!route) {
      throw new Error("Route not available");
    }
    const nolusWallet = walletStore.wallet;
    if (nolusWallet == null) {
      throw new Error("Wallet not connected");
    }
    const w: unknown = nolusWallet;
    const signer = typeof w === "object" && w !== null && "signer" in w ? w.signer : undefined;
    const native =
      typeof signer === "object" && signer !== null && "chainId" in signer && typeof signer.chainId === "string"
        ? signer.chainId
        : undefined;
    if (native === undefined) {
      throw new Error("Native chain id not available from wallet signer");
    }
    const addrs: { [key: string]: BaseWallet | NolusWallet } = {
      [native]: nolusWallet
    };
    const chainToParse: { [key: string]: NetworkInfo } = getChains(route);
    const promises = [];

    for (const chain in chainToParse) {
      const fn = async function () {
        const client = await WalletAccess.getWallet(chain);
        const network = NETWORK_DATA;
        const networkData = network?.supportedNetworks[chain];
        if (networkData === undefined) {
          throw new Error(`Unsupported network: ${chain}`);
        }
        const baseWallet = (await externalWallet(client, networkData)) as BaseWallet;
        const chainId = await baseWallet.getChainId();
        addrs[chainId] = baseWallet;
      };
      promises.push(fn());
    }

    await Promise.all(promises);

    return addrs;
  }

  async function getRoute() {
    const chainId = await client.getChainId();
    const asset = assets.value[selectedCurrency.value];
    if (asset === undefined) {
      throw new Error("Selected asset not available");
    }

    const transferAmount = Decimal.fromUserInput(amount.value, asset.decimal_digits as number);

    const route = await SkipRouter.getRoute(asset.balance.denom, asset.from, transferAmount.atomics, false, chainId);
    return route;
  }

  function getChains(route: RouteResponse) {
    const chainToParse: { [key: string]: NetworkInfo } = {};
    const nolusWallet = walletStore.wallet;
    if (nolusWallet == null) {
      throw new Error("Wallet not connected");
    }
    const w: unknown = nolusWallet;
    const signer = typeof w === "object" && w !== null && "signer" in w ? w.signer : undefined;
    const native =
      typeof signer === "object" && signer !== null && "chainId" in signer && typeof signer.chainId === "string"
        ? signer.chainId
        : undefined;
    if (native === undefined) {
      throw new Error("Native chain id not available from wallet signer");
    }

    const chains = chainsData.filter((item) => {
      if (item.chain_id === native) {
        return false;
      }
      return route.chain_ids.includes(item.chain_id);
    });

    const supportedNetworks = configStore.supportedNetworksData;
    for (const chain of chains) {
      for (const key in supportedNetworks) {
        const networkData = supportedNetworks[key];
        if (networkData?.value === chain.chain_name.toLowerCase()) {
          chainToParse[key] = networkData;
        }
      }
    }

    return chainToParse;
  }

  function getChainIds(route: RouteResponse) {
    const chainToParse: { [key: string]: NetworkInfo } = {};
    const chains = chainsData.filter((item) => {
      return route.chain_ids.includes(item.chain_id);
    });

    const supportedNetworks = configStore.supportedNetworksData;
    for (const chain of chains) {
      for (const key in supportedNetworks) {
        const networkData = supportedNetworks[key];
        if (networkData?.value === chain.chain_name.toLowerCase()) {
          chainToParse[chain.chain_id] = networkData;
        }
      }
    }

    return chainToParse;
  }

  return {
    assets,
    currency,
    amount,
    amountErrorMsg,
    calculatedBalance,
    disablePicker,
    isDisabled,
    isLoading,
    walletStore,
    handleAmountChange,
    onSelectCurrency,
    onSwap
  };
}
