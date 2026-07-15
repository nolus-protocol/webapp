import { computed, inject, onUnmounted, ref, watch } from "vue";
import { type AdvancedCurrencyFieldOption, ToastType } from "web-components";
import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { classifyError, externalWallet, Logger, validateAmountV2, walletOperation, WalletAccess } from "@/common/utils";
import { getSkipRouteConfig } from "@/common/utils/ConfigService";
import { getPriceForCurrency, tryGetCurrencyByDenom } from "@/common/utils/CurrencyLookup";
import { formatDecAsUsd, formatTokenBalance } from "@/common/utils/NumberFormatUtils";
import type { Coin } from "@keplr-wallet/unit";
import { Dec, Int } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { MultipleCurrencyEventType, type SkipRouteConfigType } from "@/common/types";
import { useI18n } from "vue-i18n";
import { type BaseWallet } from "@/networks";
import type { NolusWallet } from "@nolus/nolusjs";
import { SwapStatus } from "../enums";
import { NETWORK_DATA } from "@/networks/config";
import { SkipRouter, type SkipTxResult } from "@/common/utils/SkipRoute";
import { useConfigStore } from "@/common/stores/config";
import { useHistoryStore } from "@/common/stores/history";
import type { RouteResponse } from "@/common/types/skipRoute";
import type { NetworkInfo } from "@/common/api/types/config";
import { WalletTypes } from "@/networks/types";

export function useSwapForm() {
  let time: NodeJS.Timeout;
  let route: RouteResponse | null;
  const timeOut = 600;
  const id = Date.now();

  const wallet = useWalletStore();
  const balancesStore = useBalancesStore();
  const configStore = useConfigStore();
  const historyStore = useHistoryStore();
  const i18n = useI18n();

  const blacklist = ref<string[]>([]);
  const swapCurrencies = ref<{ from: string; to: string; native: boolean; visible?: string }[]>([]);
  const selectedFirstCurrencyOption = ref<AdvancedCurrencyFieldOption | undefined>();
  const selectedSecondCurrencyOption = ref<AdvancedCurrencyFieldOption | undefined>();
  const amount = ref("0");
  const swapToAmount = ref("0");
  const error = ref("");
  const txHashes = ref<{ hash: string; status: SwapStatus; url: string | null }[]>([]);

  const firstInputAmount = ref();
  const secondInputAmount = ref();

  const swapFee = ref("");
  const loading = ref(false);
  const disabled = ref(false);
  const loadingTx = ref(false);
  const priceImapact = ref(0);
  const onClose = inject("close", () => {});
  const onShowToast = inject("onShowToast", (_data: { type: ToastType; message: string }) => {});

  const errorInsufficientBalance = computed(() => error.value === i18n.t("message.invalid-balance-big"));

  const disabledByWallet = computed(() => {
    const w: unknown = wallet.wallet;
    const signer = typeof w === "object" && w !== null && "signer" in w ? w.signer : undefined;
    const signerType =
      typeof signer === "object" && signer !== null && "type" in signer && typeof signer.type === "string"
        ? signer.type
        : undefined;
    switch (signerType) {
      case WalletTypes.evm: {
        return true;
      }
      default: {
        return false;
      }
    }
  });

  const assets = computed(() => {
    const data = [];

    for (const c of swapCurrencies.value) {
      if (c.visible && configStore.protocolFilter !== c.visible) continue;
      if (blacklist.value.includes(c.from)) continue;

      const currency = tryGetCurrencyByDenom(c.from);
      if (!currency) continue;

      if (balancesStore.ignoredCurrencies.includes(currency.ticker as string)) continue;

      const amount = balancesStore.getBalance(currency.ibcData);
      const value = new Dec(amount, currency.decimal_digits);
      const balance = formatTokenBalance(value);

      const price = new Dec(getPriceForCurrency(currency));
      const stable = price.mul(value);

      data.push({
        name: currency.name,
        value: currency.key,
        label: currency.shortName,
        icon: currency.icon,
        ibcData: currency.ibcData,
        decimal_digits: currency.decimal_digits,
        balance: {
          value: value.isZero() ? "0" : value.toString(currency.decimal_digits).replace(/\.?0+$/, ""),
          customLabel: `${balance} ${currency.shortName}`,
          ticker: currency.shortName
        },
        stable,
        price: formatDecAsUsd(stable)
      });
    }

    return data.sort((a, b) => {
      return Number(b.stable.sub(a.stable).toString(8));
    });
  });

  const firstCalculatedBalance = computed(() => {
    const ibcData = selectedFirstCurrencyOption.value?.ibcData;
    const currency = ibcData ? tryGetCurrencyByDenom(ibcData) : null;
    const price = new Dec(currency ? getPriceForCurrency(currency) : "0");
    const v = amount?.value?.length ? amount?.value : "0";
    const stable = price.mul(new Dec(v));
    return formatDecAsUsd(stable);
  });

  const secondCalculatedBalance = computed(() => {
    const ibcData = selectedSecondCurrencyOption.value?.ibcData;
    const currency = ibcData ? tryGetCurrencyByDenom(ibcData) : null;
    const price = new Dec(currency ? getPriceForCurrency(currency) : "0");
    const v = swapToAmount?.value?.length ? swapToAmount?.value : "0";
    const stable = price.mul(new Dec(v));
    return formatDecAsUsd(stable);
  });

  const selectedAsset = computed(() => {
    if (!selectedFirstCurrencyOption.value) return undefined;
    return (
      assets.value.find((item) => item.value === selectedFirstCurrencyOption.value?.value) ??
      assets.value.find((item) => item.ibcData === selectedFirstCurrencyOption.value?.ibcData) ??
      selectedFirstCurrencyOption.value
    );
  });

  // Repopulate when the store is ready AND whenever the wallet-driven network
  // filter changes. protocolFilter starts "" and is set to the owned network
  // (e.g. "OSMOSIS") only after the async wallet reconnect completes — later than
  // `initialized` flips — so reacting to `initialized` alone snapshots an empty
  // `config.transfers[""]` and never recovers.
  //
  // Reacts to: configStore.initialized + configStore.protocolFilter.
  // Idempotency: onInit() recomputes the full swap currency/blacklist set from the
  // current store snapshot, so the immediate run and every re-fire are safe.
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
      const config = await getSkipRouteConfig();
      const protocol = configStore.protocolFilter.toLowerCase();
      blacklist.value = config.blacklist;

      const networkTransfers = config.transfers?.[configStore.protocolFilter]?.currencies ?? [];
      swapCurrencies.value = networkTransfers;

      const firstCurrency = assets.value.find(
        (item) => item.ibcData === config[`swap_currency_${protocol}` as keyof SkipRouteConfigType]
      );
      const secondCurrency = assets.value.find((item) => item.ibcData === config.swap_to_currency);

      if (!firstCurrency || !secondCurrency) {
        Logger.error(
          `Swap config mismatch: first=${firstCurrency?.ibcData ?? "missing"}, second=${secondCurrency?.ibcData ?? "missing"}`
        );
        onShowToast({
          type: ToastType.error,
          message: i18n.t("message.swap-config-mismatch")
        });
        return;
      }

      selectedFirstCurrencyOption.value = firstCurrency;
      selectedSecondCurrencyOption.value = secondCurrency;

      void setSwapFee();
    } catch (error) {
      Logger.error(error);
    }
  }

  async function onNextClick() {
    if (validateInputs().length === 0) {
      try {
        disabled.value = true;
        await walletOperation(onSwap);
      } catch (e) {
        Logger.error(e);
      } finally {
        disabled.value = false;
      }
    }
  }

  function updateAmount(value: {
    input: { value: string };
    currency: { value: string };
    type: MultipleCurrencyEventType;
  }) {
    amount.value = value.input.value ?? 0;
    const match = assets.value.find((item) => item.value === value.currency.value);
    if (!match) {
      Logger.error(`Swap currency not available (first side): ${value.currency.value}`);
      onShowToast({
        type: ToastType.error,
        message: i18n.t("message.swap-currency-not-available")
      });
      return;
    }
    selectedFirstCurrencyOption.value = match;
    updateRoute();
  }

  function updateSwapToAmount(value: {
    input: { value: string };
    currency: { value: string };
    type: MultipleCurrencyEventType;
  }) {
    swapToAmount.value = value.input.value;
    const match = assets.value.find((item) => item.value === value.currency.value);
    if (!match) {
      Logger.error(`Swap currency not available (second side): ${value.currency.value}`);
      onShowToast({
        type: ToastType.error,
        message: i18n.t("message.swap-currency-not-available")
      });
      return;
    }
    selectedSecondCurrencyOption.value = match;

    switch (value.type) {
      case MultipleCurrencyEventType.select: {
        updateRoute();
        break;
      }
      case MultipleCurrencyEventType.input: {
        updateSwapToRoute();
        break;
      }
    }
  }

  function onSwapItems() {
    const secondItem = selectedSecondCurrencyOption.value;
    selectedSecondCurrencyOption.value = selectedFirstCurrencyOption.value;
    selectedFirstCurrencyOption.value = secondItem;
    updateRoute();
  }

  async function setSwapFee() {
    const amount = swapToAmount.value;
    const asset = selectedSecondCurrencyOption.value;

    if (asset) {
      const config = await getSkipRouteConfig();
      const fee = new Dec(config.fee).quo(new Dec(10000)).mul(new Dec(amount, asset.decimal_digits));
      const coin = CurrencyUtils.convertDenomToMinimalDenom(fee.toString(), asset.ibcData, asset.decimal_digits);
      swapFee.value = CurrencyUtils.convertMinimalDenomToDenom(
        coin.amount.toString(),
        asset.ibcData,
        asset.label,
        asset.decimal_digits
      )
        .trim(true)
        .toString();
    }
  }

  function updateRoute() {
    if (!amount.value.length || amount.value.length === 0) {
      return false;
    }

    const first = selectedFirstCurrencyOption.value;
    if (!first) return;

    if (validateInputs().length === 0) {
      const token = CurrencyUtils.convertDenomToMinimalDenom(
        amount.value.toString(),
        first.ibcData,
        first.decimal_digits
      );
      if (token.amount.gt(new Int(0))) {
        void setRoute(token, false);
      }
    }
  }

  function updateSwapToRoute() {
    const second = selectedSecondCurrencyOption.value;
    if (!second) return;

    if (validateSwapToInputs().length === 0) {
      const token = CurrencyUtils.convertDenomToMinimalDenom(
        swapToAmount.value.toString(),
        second.ibcData,
        second.decimal_digits
      );
      if (token.amount.gt(new Int(0))) {
        void setRoute(token, true);
      }
    }
  }

  async function setRoute(token: Coin, revert = false) {
    clearTimeout(time);

    time = setTimeout(() => {
      void (async () => {
        try {
          loading.value = true;
          error.value = "";

          const first = selectedFirstCurrencyOption.value;
          const second = selectedSecondCurrencyOption.value;
          if (!first || !second) return;

          const network = configStore.protocolFilter.toLowerCase();

          if (revert) {
            route = await SkipRouter.getRoute(
              first.ibcData,
              second.ibcData,
              token.amount.toString(),
              revert,
              undefined,
              undefined,
              network
            );
            firstInputAmount.value = new Dec(route?.amount_in, first.decimal_digits).toString(first.decimal_digits);
            amount.value = secondInputAmount.value;
          } else {
            route = await SkipRouter.getRoute(
              first.ibcData,
              second.ibcData,
              token.amount.toString(),
              revert,
              undefined,
              undefined,
              network
            );
            secondInputAmount.value = new Dec(route?.amount_out, second.decimal_digits).toString(second.decimal_digits);
            swapToAmount.value = secondInputAmount.value;
          }
          priceImapact.value = Number(route?.swap_price_impact_percent ?? "0");
          void setSwapFee();
        } catch (e) {
          error.value = i18n.t(classifyError(e));
          route = null;
          Logger.error(e);
        } finally {
          loading.value = false;
        }
      })();
    }, timeOut);
  }

  onUnmounted(() => {
    clearTimeout(time);
  });

  function validateInputs() {
    const first = selectedFirstCurrencyOption.value;
    const second = selectedSecondCurrencyOption.value;
    if (!first || !second || !first.balance) return error.value;

    error.value = validateAmountV2(amount.value, first.balance.value);
    if (first.ibcData === second.ibcData) {
      error.value = i18n.t("message.swap-same-error");
    }
    return error.value;
  }

  function validateSwapToInputs() {
    const first = selectedFirstCurrencyOption.value;
    const second = selectedSecondCurrencyOption.value;
    if (!first || !second || !second.balance) return error.value;

    error.value = validateAmountV2(swapToAmount.value, second.balance.value);
    if (first.ibcData === second.ibcData) {
      error.value = i18n.t("message.swap-same-error");
    }
    return error.value;
  }

  async function onSwap(): Promise<void> {
    if (!WalletAccess.isAuth() || !route) {
      return;
    }

    try {
      loadingTx.value = true;

      const wallets = await getWallets();

      for (const [key, chainWallet] of Object.entries(wallets)) {
        const walletAddress = chainWallet.address;
        if (!walletAddress) {
          throw new Error(`Wallet address not available for ${key}`);
        }
      }

      if (!route) {
        throw new Error("Route not available");
      }
      await SkipRouter.submitRoute(route, wallets, async (tx: SkipTxResult, baseWallet: BaseWallet | NolusWallet) => {
        const element = {
          hash: tx.txHash,
          status: SwapStatus.pending,
          url: "explorer" in baseWallet ? baseWallet.explorer : null
        };

        txHashes.value.push(element);
        await baseWallet.broadcastTx(tx.txBytes);
        const chainid = await baseWallet.getChainId();
        await SkipRouter.track(chainid, tx.txHash);
        await SkipRouter.fetchStatus(tx.txHash, chainid);

        element.status = SwapStatus.success;
        await balancesStore.fetchBalances();
        void historyStore.loadActivities();
      });

      onClose();

      historyStore.setTransferTxHashes(
        String(id),
        txHashes.value.map((t) => t.hash)
      );
    } catch (e) {
      error.value = i18n.t(classifyError(e));
      Logger.error(error);

      historyStore.failPendingTransfer(String(id), error.value);
    } finally {
      loadingTx.value = false;
    }
  }

  async function getWallets(): Promise<{ [key: string]: BaseWallet | NolusWallet }> {
    if (!route) {
      throw new Error("Route not available");
    }
    const currentRoute = route;
    const nolusWallet = wallet.wallet;
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

    const chainToParse: { [key: string]: NetworkInfo } = {};
    const chains = (await SkipRouter.getChains()).filter((item) => {
      if (item.chain_id === native) {
        return false;
      }
      return currentRoute.chain_ids.includes(item.chain_id);
    });

    const supportedNetworks = configStore.supportedNetworksData;
    for (const chain of chains) {
      for (const key in supportedNetworks) {
        const networkData = supportedNetworks[key];
        if (networkData?.value === chain.chain_name) {
          chainToParse[key] = networkData;
        }
      }
    }
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

  return {
    assets,
    selectedAsset,
    selectedSecondCurrencyOption,
    disabledByWallet,
    disabled,
    loadingTx,
    loading,
    firstInputAmount,
    secondInputAmount,
    firstCalculatedBalance,
    secondCalculatedBalance,
    error,
    errorInsufficientBalance,
    swapFee,
    priceImapact,
    updateAmount,
    updateSwapToAmount,
    onSwapItems,
    onNextClick
  };
}
