import { computed, inject, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Dialog } from "web-components";
import { ToastType } from "web-components";
import { RouteNames } from "@/router";

import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { useHistoryStore } from "@/common/stores/history";
import { usePricesStore } from "@/common/stores/prices";
import { useLeasesStore, type LeaseDisplayData } from "@/common/stores/leases";
import { useConfigStore } from "@/common/stores/config";
import { classifyError, Logger, walletOperation } from "@/common/utils";
import { formatNumber, formatPriceUsd } from "@/common/utils/NumberFormatUtils";
import { getLpnByProtocol, getCurrencyByTicker } from "@/common/utils/CurrencyLookup";
import { NATIVE_CURRENCY } from "../../../../config/global/network";
import { Dec } from "@keplr-wallet/unit";
import type { NolusWallet } from "@nolus/nolusjs";
import { NolusClient } from "@nolus/nolusjs";
import { useI18n } from "vue-i18n";
import type { Coin } from "@cosmjs/proto-signing";
import { Lease } from "@nolus/nolusjs/build/contracts";
import { PERMILLE } from "@/config/global";
import type { LeaseInfo } from "@/common/api";

// Stop-loss and take-profit dialogs share the full form/quote/submit flow; they
// diverge only on trigger direction (which close-policy field the entered price
// drives), the price-comparison sign in validation, and the associated i18n
// keys. `mode` selects that residue; the SFCs stay verbatim templates over the
// returned bindings.
export type TriggerMode = "stop-loss" | "take-profit";

export function useTriggerDialog(mode: TriggerMode) {
  const route = useRoute();
  const router = useRouter();
  const pricesStore = usePricesStore();
  const walletStore = useWalletStore();
  const balancesStore = useBalancesStore();
  const historyStore = useHistoryStore();

  const leasesStore = useLeasesStore();
  const configStore = useConfigStore();
  const i18n = useI18n();

  const error_percent = 0.9;
  const amount = ref("");
  const amountErrorMsg = ref("");
  const selectedCurrency = ref(0);
  const isLoading = ref(false);
  const sliderValue = ref(0);
  const loading = ref(false);
  const disabled = ref(false);
  const reload = inject("reload", () => {});
  const onShowToast = inject("onShowToast", (_data: { type: ToastType; message: string }) => {});

  const dialog = ref<typeof Dialog | null>(null);
  const lease = ref<LeaseInfo | null>(null);
  // shallowRef: a deep ref's UnwrapRef proxies the Dec class instances inside
  // LeaseDisplayData and strips their nominal type; the value is only ever
  // replaced wholesale, never mutated in place, so shallow tracking suffices.
  const displayData = shallowRef<LeaseDisplayData | null>(null);

  function initLease() {
    // Read from store cache — the parent already fetched this lease.
    // Avoid calling fetchLeaseDetails here: it mutates store state which
    // triggers the parent's watcher, re-renders, and unmounts this dialog.
    const cached = leasesStore.getLease(route.params.id as string);
    if (cached) {
      lease.value = cached;
      displayData.value = leasesStore.getLeaseDisplayData(cached);
      if (cached.status === "closed") {
        void router.push(`/${RouteNames.LEASES}`);
      }
    }
  }

  onMounted(() => {
    dialog?.value?.show();
    initLease();
  });

  onBeforeUnmount(() => {
    dialog?.value?.close();
  });

  const price = computed(() => {
    return formatPriceUsd(amount.value.length === 0 ? 0 : amount.value);
  });

  const currency = computed(() => {
    return assets.value[selectedCurrency.value];
  });

  // Conditional spread keeps `undefined` out of the optional prop
  // (exactOptionalPropertyTypes) while preserving the "no selection" render.
  const selectedCurrencyBinding = computed(() => {
    const first = assets.value[0];
    return first !== undefined ? { selectedCurrencyOption: first } : {};
  });

  const currentPrice = computed(() => {
    if (!lease.value) return "";
    const asset = getCurrency();
    if (!asset) return "";
    return formatPriceUsd(pricesStore.prices[asset.key]?.price ?? 0);
  });

  const assets = computed(() => {
    const data: {
      name: string;
      icon: string;
      value: string;
      label: string;
      ibcData: string;
      shortName: string;
      decimal_digits: number;
      key: string;
      ticker: string;
    }[] = [];

    if (lease.value) {
      const asset = getCurrency();
      if (!asset) {
        return data;
      }
      const denom = asset.ibcData;

      data.push({
        name: asset.name,
        icon: asset.icon,
        value: denom,
        label: asset.shortName,
        ibcData: asset.ibcData,
        shortName: asset.shortName,
        decimal_digits: asset.decimal_digits,
        key: asset.key,
        ticker: asset.ticker
      });
    }

    return data;
  });

  function getCurrency() {
    if (!lease.value || lease.value.status !== "opened") return undefined;
    const positionType = configStore.getPositionType(lease.value.protocol);

    if (positionType === "Long") {
      const ticker = lease.value.amount.ticker;
      return configStore.currenciesData[`${ticker}@${lease.value.protocol}`];
    } else {
      return getLpnByProtocol(lease.value.protocol);
    }
  }

  function getPrice() {
    if (!lease.value || !displayData.value) return undefined;
    return displayData.value.openingPrice;
  }

  const payout = computed(() => {
    const selected = currency.value;
    if (!lease.value || !displayData.value || !selected) return "0";
    const end_price = new Dec(amount.value.length === 0 ? 0 : amount.value);
    const positionType = configStore.getPositionType(lease.value.protocol);
    const debt = displayData.value.totalDebt ?? new Dec(0);

    if (positionType === "Long") {
      const end = totalAmount.value.mul(end_price);
      return formatNumber(end.sub(debt).toString(), selected.decimal_digits, NATIVE_CURRENCY.symbol);
    } else {
      // Short: payout = position_USDC - (debt_in_asset × target_price)
      const lpn = getLpnByProtocol(lease.value.protocol);
      const positionUsdc = new Dec(lease.value.amount.amount ?? "0", lpn?.decimal_digits ?? 0);
      const debtAtTargetPrice = debt.mul(end_price);
      return formatNumber(
        positionUsdc.sub(debtAtTargetPrice).toString(),
        selected.decimal_digits,
        NATIVE_CURRENCY.symbol
      );
    }
  });

  const totalAmount = computed(() => {
    if (!lease.value || lease.value.status !== "opened") return new Dec(0);
    const positionType = configStore.getPositionType(lease.value.protocol);

    if (mode === "stop-loss") {
      const selected = currency.value;
      if (!selected) return new Dec(0);

      if (positionType === "Long") {
        return new Dec(lease.value.amount.amount ?? "0", selected.decimal_digits);
      } else {
        const ticker = lease.value.etl_data?.lease_position_ticker ?? lease.value.amount.ticker;
        const asset = configStore.currenciesData?.[`${ticker}@${lease.value.protocol}`];
        if (!asset) return new Dec(0);
        const price = pricesStore.prices[asset.key];
        if (!price) return new Dec(0);
        return new Dec(lease.value.amount.amount ?? 0, selected.decimal_digits).quo(new Dec(price.price));
      }
    } else {
      if (positionType === "Long") {
        const selected = currency.value;
        if (!selected) return new Dec(0);
        return new Dec(lease.value.amount.amount ?? "0", selected.decimal_digits);
      } else {
        const ticker = lease.value.etl_data?.lease_position_ticker ?? lease.value.amount.ticker;
        const asset = configStore.currenciesData?.[`${ticker}@${lease.value.protocol}`];
        if (!asset) return new Dec(0);
        const price = pricesStore.prices[asset.key];
        if (!price) return new Dec(0);
        // Use LPN for decimal digits for short positions
        const lpn = getLpnByProtocol(lease.value.protocol);
        return new Dec(lease.value.amount.amount ?? 0, lpn?.decimal_digits ?? 0).quo(new Dec(price.price));
      }
    }
  });

  const total = computed(() => {
    if (!lease.value || lease.value.status !== "opened") return new Dec(0);
    return new Dec(lease.value.amount.amount ?? 0, currency.value?.decimal_digits);
  });

  function handleAmountChange(event: string) {
    amount.value = event;
    if (amount.value !== "") {
      let percent = new Dec(amount.value).quo(total.value).mul(new Dec(100));
      if (percent.isNegative()) {
        percent = new Dec(0);
      }
      if (percent.gt(new Dec(100))) {
        percent = new Dec(100);
      }
      sliderValue.value = Number(percent.toString(0));
    }
  }

  function isAmountValid() {
    let isValid = true;
    amountErrorMsg.value = "";
    if (lease.value && lease.value.status === "opened") {
      const a = new Dec(amount.value.length > 0 ? amount.value : 0);
      const price = getPrice();

      if (mode === "stop-loss") {
        const currencyData = getCurrency();
        if (!currencyData || !price) {
          return isValid;
        }

        if (amount.value || amount.value !== "") {
          const isLowerThanOrEqualsToZero = a.lte(new Dec(0));

          if (isLowerThanOrEqualsToZero) {
            amountErrorMsg.value = i18n.t("message.invalid-balance-low");
            isValid = false;
          }

          if (getPercent().gte(new Dec(error_percent))) {
            amountErrorMsg.value = i18n.t("message.stop-loss-error");
            return false;
          }

          const positionType = configStore.getPositionType(lease.value.protocol);
          if (positionType === "Long") {
            if (a.gt(price)) {
              amountErrorMsg.value = i18n.t("message.lease-only-max-error", {
                maxAmount: formatPriceUsd(price.toString(Number(currencyData.decimal_digits))),
                symbol: ""
              });
              isValid = false;
            }
          } else {
            if (price.gt(a)) {
              amountErrorMsg.value = i18n.t("message.take-profit-min-amount-error", {
                amount: formatPriceUsd(price.toString(Number(currencyData.decimal_digits))),
                symbol: ""
              });
              isValid = false;
            }
          }
        } else {
          amountErrorMsg.value = i18n.t("message.missing-amount");
          isValid = false;
        }
      } else {
        const currencyData = getCurrencyByTicker(lease.value.amount.ticker);
        if (!price) {
          return isValid;
        }

        if (amount.value || amount.value !== "") {
          const isLowerThanOrEqualsToZero = a.lte(new Dec(0));

          if (isLowerThanOrEqualsToZero) {
            amountErrorMsg.value = i18n.t("message.invalid-balance-low");
            isValid = false;
          }

          const positionType = configStore.getPositionType(lease.value.protocol);
          if (positionType === "Long") {
            if (a.lte(price)) {
              amountErrorMsg.value = i18n.t("message.take-profit-min-amount-error", {
                amount: formatPriceUsd(price.toString(Number(currencyData.decimal_digits))),
                symbol: ""
              });
              isValid = false;
            }
          } else {
            if (a.gt(price)) {
              amountErrorMsg.value = i18n.t("message.lease-only-max-error", {
                maxAmount: formatPriceUsd(price.toString(Number(currencyData.decimal_digits))),
                symbol: ""
              });
              isValid = false;
            }
          }
        } else {
          amountErrorMsg.value = i18n.t("message.missing-amount");
          isValid = false;
        }
      }
    }

    return isValid;
  }

  async function onSendClick() {
    try {
      disabled.value = true;
      await walletOperation(operation);
    } catch {
      // intentionally empty - wallet operation errors are handled internally
    } finally {
      disabled.value = false;
    }
  }

  async function operation() {
    const wallet = walletStore.wallet as NolusWallet;
    if (wallet && isAmountValid() && lease.value && lease.value.status === "opened") {
      try {
        loading.value = true;
        const funds: Coin[] = [];

        const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
        const leaseClient = new Lease(cosmWasmClient, lease.value.address);
        const price = getPrice();

        if (!price) {
          return;
        }

        const percent = getPercent();
        const trigger = Number(percent.mul(new Dec(PERMILLE)).round().toString());
        const takeProfit = mode === "stop-loss" ? lease.value.close_policy?.take_profit : trigger;
        const stopLoss = mode === "stop-loss" ? trigger : lease.value.close_policy?.stop_loss;

        const {
          txHash: _txHash,
          txBytes,
          usedFee: _usedFee
        } = await leaseClient.simulateChangeClosePolicyTx(wallet, stopLoss, takeProfit, funds);
        await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
        void balancesStore.fetchBalances();
        void historyStore.loadActivities();
        reload();
        dialog?.value?.close();
        onShowToast({
          type: ToastType.success,
          message: i18n.t("message.stop-loss-toast")
        });
      } catch (error: unknown) {
        Logger.error(error);
        amountErrorMsg.value = i18n.t(classifyError(error));
      } finally {
        loading.value = false;
      }
    }
  }

  function getPercent() {
    if (!lease.value || !displayData.value) return new Dec(0);
    const positionType = configStore.getPositionType(lease.value.protocol);

    if (mode === "stop-loss") {
      const value = new Dec(amount.value.length === 0 ? 0 : amount.value);
      if (positionType === "Long") {
        const v = value.mul(displayData.value.unitAsset);
        if (v.isZero()) {
          return new Dec(0);
        }
        return displayData.value.stableAsset.quo(v);
      } else {
        if (displayData.value.unitAsset.isZero()) {
          return new Dec(0);
        }
        return displayData.value.stableAsset.quo(displayData.value.unitAsset).mul(value);
      }
    } else {
      const value = new Dec(amount.value);
      if (positionType === "Long") {
        return displayData.value.stableAsset.quo(value.mul(displayData.value.unitAsset));
      } else {
        return displayData.value.stableAsset.quo(displayData.value.unitAsset).mul(value);
      }
    }
  }

  function closeDialog() {
    void router.push(`/${RouteNames.LEASES}/${route.params.id}`);
  }

  watch(
    () => [amount.value, selectedCurrency.value],
    () => {
      isAmountValid();
    }
  );

  return {
    dialog,
    closeDialog,
    amount,
    amountErrorMsg,
    isLoading,
    loading,
    disabled,
    assets,
    currency,
    currentPrice,
    selectedCurrencyBinding,
    price,
    payout,
    handleAmountChange,
    onSendClick
  };
}
