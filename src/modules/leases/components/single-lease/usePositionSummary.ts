import { computed, inject, ref } from "vue";
import { ToastType } from "web-components";
import { useRouter } from "vue-router";

import { RouteNames } from "@/router";
import { NATIVE_CURRENCY } from "@/config/global";
import { useConfigStore } from "@/common/stores/config";
import { usePricesStore } from "@/common/stores/prices";
import { useHistoryStore } from "@/common/stores/history";
import { useWalletStore } from "@/common/stores/wallet";
import { Dec } from "@keplr-wallet/unit";
import { formatNumber, getAdaptivePriceDecimals } from "@/common/utils/NumberFormatUtils";
import { getCurrencyByTicker, getCurrencyByDenom, getLpnByProtocol } from "@/common/utils/CurrencyLookup";
import type { NolusWallet } from "@nolus/nolusjs";
import { NolusClient } from "@nolus/nolusjs";
import { dateParser, isMobile, Logger, walletOperation } from "@/common/utils";
import { SingleLeaseDialog } from "@/modules/leases/enums";
import { TEMPLATES } from "../common";
import { Lease } from "@nolus/nolusjs/build/contracts";
import { useI18n } from "vue-i18n";
import type { AmountDisplayProps } from "@/common/components/BigNumber.vue";
import type { LeaseInfo } from "@/common/api";
import type { LeaseDisplayData } from "@/common/stores/leases";

export interface PositionSummaryProps {
  lease?: LeaseInfo | null | undefined;
  displayData?: LeaseDisplayData | null | undefined;
  loading: boolean;
}

export function usePositionSummary(props: PositionSummaryProps) {
  const mobile = isMobile();

  const configStore = useConfigStore();
  const pricesStore = usePricesStore();
  const historyStore = useHistoryStore();
  const router = useRouter();
  const walletStore = useWalletStore();
  const loadingStopLoss = ref(false);
  const loadingTakeProfit = ref(false);
  const i18n = useI18n();
  const reload = inject("reload", () => {});
  const onShowToast = inject("onShowToast", (_data: { type: ToastType; message: string }) => {});

  const pnl = computed(() => {
    if (!props.displayData) {
      return { percent: "0.00", amount: "0.00", status: true, neutral: true };
    }
    return {
      percent: props.displayData.pnlPercent.toString(2),
      amount: props.displayData.pnlAmount.toString(2),
      status: props.displayData.pnlPositive,
      neutral: false
    };
  });

  const status = computed(() => {
    if (!props.lease) return TEMPLATES.opening;
    switch (props.lease.status) {
      case "opening":
        return TEMPLATES.opening;
      case "opened":
        return TEMPLATES.opened;
      case "paid_off":
        return TEMPLATES.paid;
      case "closing":
        return TEMPLATES.paid;
      case "closed":
        return TEMPLATES.closed;
      case "liquidated":
        return TEMPLATES.liquidated;
      default:
        return TEMPLATES.opening;
    }
  });

  const amount = computed(() => {
    return props.lease?.amount?.amount ?? "0";
  });

  const isShort = computed(() => props.displayData?.positionType === "short");

  // SHORT positions store the size in the stable (USDC) while the volatile
  // side (BTC) is the sub-number. LONGs are the opposite: size is in the
  // crypto, sub is the USD value. The rounding convention follows the asset
  // class — stable values always at 2 dp, crypto values always adaptive via
  // TokenAmount.
  const sizePrimary = computed<AmountDisplayProps>(() => {
    if (isShort.value) {
      const stableDec = new Dec(props.lease?.amount?.amount ?? "0", asset.value?.decimal_digits ?? 0);
      return {
        value: stableDec.toString(NATIVE_CURRENCY.maximumFractionDigits),
        denom: NATIVE_CURRENCY.symbol,
        decimals: NATIVE_CURRENCY.maximumFractionDigits,
        fontSize: 24,
        animatedReveal: true,
        compact: mobile
      };
    }
    return {
      microAmount: amount.value,
      denom: asset.value?.shortName ?? "",
      decimals: assetLoan.value?.decimal_digits ?? 0,
      fontSize: 24,
      animatedReveal: true,
      compact: mobile
    };
  });

  const sizeSecondary = computed<AmountDisplayProps>(() => {
    if (!isShort.value) {
      return stable.value;
    }
    const cryptoAsset = lpn.value;
    const stableDec = new Dec(props.lease?.amount?.amount ?? "0", asset.value?.decimal_digits ?? 0);
    const price = pricesStore.prices[cryptoAsset?.key as string];
    const priceDec = new Dec(price?.price ?? "0");
    if (!cryptoAsset || priceDec.isZero()) {
      return {
        value: "0",
        denom: cryptoAsset?.shortName ?? "",
        isDenomPrefix: false,
        hasSpace: true,
        fontSize: 16
      };
    }
    const cryptoDec = stableDec.quo(priceDec);
    const cryptoMicro = cryptoDec.mul(new Dec(10 ** cryptoAsset.decimal_digits)).truncate();
    return {
      microAmount: cryptoMicro.toString(),
      denom: cryptoAsset.shortName ?? "",
      decimals: cryptoAsset.decimal_digits,
      fontSize: 16
    };
  });

  const assetLoan = computed(() => {
    const posType = props.displayData?.positionType;
    if (posType === "long") {
      return asset.value;
    } else if (posType === "short") {
      // For short positions, use LPN
      const lpnCurrency = lpn.value;
      return lpnCurrency ?? asset.value;
    }
    return asset.value;
  });

  const pricerPerAsset = computed(() => {
    const posType = props.displayData?.positionType;
    if (posType === "long") {
      return asset.value;
    } else if (posType === "short") {
      const p = props.lease?.protocol as string;
      const debtTicker = props.lease?.debt?.ticker;
      const currency = configStore.currenciesData[`${debtTicker}@${p}`];
      return currency;
    }
    return asset.value;
  });

  const stopLoss = computed(() => {
    const decimals = asset.value?.decimal_digits ?? 0;
    return props.displayData?.stopLoss
      ? {
          percent: props.displayData.stopLoss.percent,
          amount: formatNumber(props.displayData.stopLoss.price.toString(decimals), decimals, NATIVE_CURRENCY.symbol)
        }
      : null;
  });

  const takeProfit = computed(() => {
    const decimals = asset.value?.decimal_digits ?? 0;
    return props.displayData?.takeProfit
      ? {
          percent: props.displayData.takeProfit.percent,
          amount: formatNumber(props.displayData.takeProfit.price.toString(decimals), decimals, NATIVE_CURRENCY.symbol)
        }
      : null;
  });

  const asset = computed(() => {
    if (!props.lease) return undefined;
    const ticker = props.lease.amount.ticker;
    const item = getCurrencyByTicker(ticker);
    return item ? getCurrencyByDenom(item.ibcData as string) : undefined;
  });

  const stable = computed<AmountDisplayProps>(() => {
    const dflt: AmountDisplayProps = {
      value: "0",
      denom: NATIVE_CURRENCY.symbol,
      fontSize: 16
    };

    if (!props.lease || !props.displayData) {
      return dflt;
    }

    const posType = props.displayData.positionType;
    const assetAmount = new Dec(props.lease.amount.amount, assetLoan.value?.decimal_digits ?? 0);

    if (posType === "long") {
      const ticker = props.lease.amount.ticker;
      const protocol = props.lease.protocol;
      const price = pricesStore.prices[`${ticker}@${protocol}`];
      const value = assetAmount.mul(new Dec(price?.price ?? "0"));

      return {
        value: value.toString(NATIVE_CURRENCY.maximumFractionDigits),
        denom: NATIVE_CURRENCY.symbol,
        fontSize: 16
      } as AmountDisplayProps;
    } else if (posType === "short") {
      const debtTicker = props.lease.debt?.ticker;
      const protocol = props.lease.protocol;
      const debtAsset = configStore.currenciesData?.[`${debtTicker}@${protocol}`];
      const price = pricesStore.prices[debtAsset?.key as string];
      const value = assetAmount.quo(new Dec(price?.price ?? "1"));
      return {
        value: value.toString(NATIVE_CURRENCY.maximumFractionDigits),
        denom: debtAsset?.shortName ?? "",
        isDenomPrefix: false,
        hasSpace: true,
        fontSize: 16
      } as AmountDisplayProps;
    }

    return dflt;
  });

  const lpn = computed(() => {
    if (props.lease) {
      return getLpnByProtocol(props.lease.protocol);
    }
    return undefined;
  });

  const debt = computed(() => {
    if (props.lease && lpn.value) {
      const totalDebt = props.displayData?.totalDebt ?? new Dec(0);
      return totalDebt
        .mul(new Dec(10 ** lpn.value.decimal_digits))
        .truncate()
        .toString();
    }
    return "0";
  });

  const downPayment = computed(() => {
    if (props.displayData) {
      const amount = props.displayData.downPayment.add(props.displayData.repaymentValue);
      return amount.toString(NATIVE_CURRENCY.maximumFractionDigits);
    }
    return "0";
  });

  const fee = computed(() => {
    if (props.displayData) {
      return props.displayData.fee.toString(NATIVE_CURRENCY.maximumFractionDigits);
    }
    return "0";
  });

  const openedPrice = computed(() => {
    if (props.displayData) {
      return props.displayData.openingPrice.toString(8);
    }
    return "0";
  });

  const openedPriceDecimals = computed(() => {
    return getAdaptivePriceDecimals(Number(props.displayData?.openingPrice.toString(8) ?? 0));
  });

  const interestDue = computed(() => {
    if (props.displayData && props.lease?.status === "opened") {
      const due = props.displayData.interestDue;
      return due
        .mul(new Dec(10 ** (lpn.value?.decimal_digits ?? 6)))
        .truncate()
        .toString();
    }
    return "0";
  });

  const interestDueStatus = computed(() => {
    return props.displayData?.interestDueWarning ?? false;
  });

  const interest = computed(() => {
    if (props.displayData) {
      return props.displayData.interestRateMonthly.toString(2);
    }
    return "0.00";
  });

  const liquidation = computed(() => {
    if (props.displayData && props.lease?.status === "opened") {
      return props.displayData.liquidationPrice.toString(8);
    }
    return "0";
  });

  const liquidationDecimals = computed(() => {
    return getAdaptivePriceDecimals(Number(props.displayData?.liquidationPrice.toString(8) ?? 0));
  });

  const interestDueDate = computed(() => {
    if (props.displayData?.interestDueDate) {
      return dateParser(props.displayData.interestDueDate.toISOString(), true);
    }
    return dateParser(new Date().toISOString(), true);
  });

  async function onRemoveStopLoss() {
    await walletOperation(onSetStopLoss);
  }

  async function onSetStopLoss() {
    const wallet = walletStore.wallet as NolusWallet;
    if (wallet && props.lease) {
      try {
        loadingStopLoss.value = true;

        const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
        const leaseClient = new Lease(cosmWasmClient, props.lease.address);

        const takeProfitValue = props.lease.close_policy?.take_profit;
        const { txBytes } = await leaseClient.simulateChangeClosePolicyTx(wallet, null, takeProfitValue);
        await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
        void historyStore.loadActivities();
        reload();
        onShowToast({
          type: ToastType.success,
          message: i18n.t("message.stop-loss-toast")
        });
      } catch (error: unknown) {
        Logger.error(error);
      } finally {
        loadingStopLoss.value = false;
      }
    }
  }

  async function onRemoveTakeProfit() {
    await walletOperation(onSetTakeProfit);
  }

  async function onSetTakeProfit() {
    const wallet = walletStore.wallet as NolusWallet;
    if (wallet && props.lease) {
      try {
        loadingTakeProfit.value = true;

        const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
        const leaseClient = new Lease(cosmWasmClient, props.lease.address);

        const stopLossValue = props.lease.close_policy?.stop_loss;
        const { txBytes } = await leaseClient.simulateChangeClosePolicyTx(wallet, stopLossValue, null);
        await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
        void historyStore.loadActivities();
        reload();
        onShowToast({
          type: ToastType.success,
          message: i18n.t("message.stop-loss-toast")
        });
      } catch (error: unknown) {
        Logger.error(error);
      } finally {
        loadingTakeProfit.value = false;
      }
    }
  }

  function onEditStopLoss() {
    void router.push({ path: `/${RouteNames.LEASES}/${props.lease?.address}/${SingleLeaseDialog.STOP_LOSS}` });
  }

  function onEditTakeProfit() {
    void router.push({ path: `/${RouteNames.LEASES}/${props.lease?.address}/${SingleLeaseDialog.TAKE_PROFIT}` });
  }

  return {
    mobile,
    pnl,
    status,
    sizePrimary,
    sizeSecondary,
    pricerPerAsset,
    stopLoss,
    takeProfit,
    lpn,
    debt,
    downPayment,
    fee,
    openedPrice,
    openedPriceDecimals,
    interestDue,
    interestDueStatus,
    interest,
    liquidation,
    liquidationDecimals,
    interestDueDate,
    loadingStopLoss,
    loadingTakeProfit,
    onRemoveStopLoss,
    onRemoveTakeProfit,
    onEditStopLoss,
    onEditTakeProfit
  };
}
