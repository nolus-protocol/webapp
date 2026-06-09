import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Dialog } from "web-components";
import { ToastType } from "web-components";
import { RouteNames } from "@/router";

import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { useConfigStore } from "@/common/stores/config";
import { usePricesStore } from "@/common/stores/prices";
import { useHistoryStore } from "@/common/stores/history";
import { useLeasesStore, type LeaseDisplayData } from "@/common/stores/leases";
import { classifyError, getMicroAmount, Logger, walletOperation } from "@/common/utils";
import {
  formatDecAsUsd,
  formatUsd,
  formatPriceUsd,
  formatTokenBalance,
  formatPercent
} from "@/common/utils/NumberFormatUtils";
import { getLpnByProtocol } from "@/common/utils/CurrencyLookup";
import { NATIVE_CURRENCY } from "../../../../config/global/network";
import { MAX_DECIMALS, minimumLeaseAmount, PERCENT } from "@/config/global";
import { CoinPretty, Dec, Int } from "@keplr-wallet/unit";
import type { NolusWallet } from "@nolus/nolusjs";
import { CurrencyUtils, NolusClient } from "@nolus/nolusjs";
import { SkipRouter } from "@/common/utils/SkipRoute";
import { useI18n } from "vue-i18n";
import type { Coin } from "@cosmjs/proto-signing";
import { Lease } from "@nolus/nolusjs/build/contracts";
import { getLeasePositionSpec } from "@/common/utils/LeaseConfigService";
import type { AmountSpec } from "@/common/api/types/webapp";
import type { LeaseInfo } from "@/common/api";

export function useCloseLease() {
  // Debounce window for the Skip API call fired when inputs change. Must stay
  // comfortably above chain/contract latencies so rapid slider drags collapse
  // to a single fire — a shorter window lets slow responses trigger back-to-back
  // setSwapFee runs and hit the backend's /api/swap/route strict rate limit
  // (2 RPS, burst 5).
  const timeOut = 600;
  let time: NodeJS.Timeout;

  const route = useRoute();
  const router = useRouter();
  const pricesStore = usePricesStore();
  const walletStore = useWalletStore();
  const configStore = useConfigStore();
  const balancesStore = useBalancesStore();
  const historyStore = useHistoryStore();
  const leasesStore = useLeasesStore();
  const i18n = useI18n();

  const amount = ref("");
  const amountErrorMsg = ref("");
  const selectedCurrency = ref(0);
  const isLoading = ref(false);
  const swapFee = ref(0);
  const sliderValue = ref(0);
  const loading = ref(false);
  const disabled = ref(false);
  const reload = inject("reload", () => {});
  const onShowToast = inject("onShowToast", (_data: { type: ToastType; message: string }) => {});

  const dialog = ref<typeof Dialog | null>(null);
  const lease = ref<LeaseInfo | null>(null);
  const displayData = ref<LeaseDisplayData | null>(null);
  const minAsset = ref<AmountSpec | null>(null);

  async function initLease() {
    // Read from store cache — the parent already fetched this lease.
    // Avoid calling fetchLeaseDetails here: it mutates store state which
    // triggers the parent's watcher, re-renders, and unmounts this dialog.
    const cached = leasesStore.getLease(route.params.id as string);
    if (cached) {
      lease.value = cached;
      displayData.value = leasesStore.getLeaseDisplayData(cached);
      if (cached.status === "closed") {
        void router.push(`/${RouteNames.LEASES}`);
        return;
      }
      try {
        const positionSpec = await getLeasePositionSpec(cached.protocol);
        minAsset.value = positionSpec.min_asset;
      } catch (error) {
        Logger.error(error);
      }
    }
  }

  onMounted(() => {
    dialog?.value?.show();
    void initLease();
  });

  onBeforeUnmount(() => {
    clearTimeout(time);
    dialog?.value?.close();
  });

  const unknownAssetReported = ref(false);

  const assets = computed(() => {
    const data = [];

    if (lease.value && lease.value.status === "opened") {
      const ticker = lease.value.amount.ticker;
      const asset = configStore.currenciesData[`${ticker}@${lease.value.protocol}`];

      // Version skew / config lag: chain returned a ticker we don't know about locally.
      // Bail out with empty assets so the component doesn't crash. The matching watcher
      // surfaces the user-facing toast; we must not do side effects in a computed.
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

  // Surface the unknown-asset condition exactly once per dialog open.
  watch(
    () => {
      if (!lease.value || lease.value.status !== "opened") return false;
      const ticker = lease.value.amount.ticker;
      return !configStore.currenciesData?.[`${ticker}@${lease.value.protocol}`];
    },
    (isUnknown) => {
      if (isUnknown && !unknownAssetReported.value) {
        unknownAssetReported.value = true;
        onShowToast({
          type: ToastType.error,
          message: i18n.t("message.close-unknown-asset")
        });
      }
    },
    { immediate: true }
  );

  const currency = computed(() => {
    return assets.value[selectedCurrency.value];
  });

  const price = computed(() => {
    if (!lease.value) return "0";
    const positionType = configStore.getPositionType(lease.value.protocol);
    if (positionType === "Short") {
      const lpn = getLpnByProtocol(lease.value.protocol);
      return new Dec(pricesStore.prices[lpn?.key]?.price, lpn?.decimal_digits).toString(lpn?.decimal_digits);
    } else {
      return new Dec(pricesStore.prices[currency.value?.key]?.price, currency.value?.decimal_digits).toString(
        currency.value?.decimal_digits
      );
    }
  });

  const priceUsd = computed(() => formatPriceUsd(price.value));

  const remaining = computed(() => {
    if (!lease.value) return "";
    const data = getAmountValue(amount.value === "" ? "0" : amount.value);
    const positionType = configStore.getPositionType(lease.value.protocol);
    const lpn = getLpnByProtocol(lease.value.protocol);

    if (positionType === "Short") {
      const price = new Dec(pricesStore.prices[lpn.key]?.price ?? 0);
      const stable = data.amount.toDec().quo(price);
      return `${formatTokenBalance(stable)} ${lpn.shortName}`;
    } else {
      return `${formatTokenBalance(data.amountInStable.toDec())} ${lpn.shortName}`;
    }
  });

  const paidDebt = computed(() => {
    if (!lease.value) return formatUsd(0);
    const positionType = configStore.getPositionType(lease.value.protocol);
    const lpn = getLpnByProtocol(lease.value.protocol);

    if (positionType === "Short") {
      const price = new Dec(pricesStore.prices[lpn.key]?.price ?? 0);
      const v = amount?.value?.length ? amount?.value : "0";
      const stable = new Dec(v).quo(price);
      return `${formatTokenBalance(stable)} ${lpn.shortName}`;
    } else {
      const asset = assets.value[selectedCurrency.value];
      if (!asset) {
        return formatUsd(0);
      }
      const price = new Dec(pricesStore.prices[asset.key]?.price ?? 0);
      const v = amount?.value?.length ? amount?.value : "0";
      const stable = price.mul(new Dec(v));
      return `${formatTokenBalance(stable)} ${lpn.shortName}`;
    }
  });

  const debtData = computed(() => {
    const price = getPrice();
    const debt = getRepayment(100);
    const d = debt?.repayment;
    if (price && d && lease.value) {
      const positionType = configStore.getPositionType(lease.value.protocol);

      if (positionType === "Short") {
        const sd = shortDebtAtom.value;
        if (!sd) return { debt: "", price: "", asset: "", fee: "" };
        const debtTicker = lease.value.debt.ticker;
        const debtCurrency = configStore.currenciesData[`${debtTicker}@${lease.value.protocol}`];
        const currentDebtPrice = new Dec(pricesStore.prices[`${debtTicker}@${lease.value.protocol}`]?.price ?? "1");
        const value = new Dec(amount.value.length ? amount.value : "0").mul(new Dec(swapFee.value));
        return {
          fee: `${formatPercent(swapFee.value * PERCENT, NATIVE_CURRENCY.maximumFractionDigits)} (${formatDecAsUsd(value)})`,
          asset: debtCurrency?.shortName ?? debtTicker,
          price: formatPriceUsd(currentDebtPrice.toString(MAX_DECIMALS)),
          debt: `${formatTokenBalance(sd.amount)} ${sd.symbol}`
        };
      } else {
        const ticker = lease.value.etl_data?.lease_position_ticker ?? lease.value.amount.ticker;
        const currecy = configStore.currenciesData[`${ticker}@${lease.value.protocol}`];
        if (!currecy) {
          return { debt: "", price: "", asset: "", fee: "" };
        }
        const asset = d.mul(price);
        const amountStr = amount.value.length ? amount.value : "0";
        const value = new Dec(amountStr).mul(price).mul(new Dec(swapFee.value));
        const lpn = getLpnByProtocol(lease.value.protocol);
        return {
          fee: `${formatPercent(swapFee.value * PERCENT, NATIVE_CURRENCY.maximumFractionDigits)} (${formatDecAsUsd(value)})`,
          asset: currecy.shortName,
          price: formatPriceUsd(price.toString(MAX_DECIMALS)),
          debt: ` ${formatTokenBalance(asset)} ${lpn.shortName}`
        };
      }
    }

    return { debt: "", price: "", asset: "", fee: "" };
  });

  const total = computed(() => {
    if (!lease.value || lease.value.status !== "opened") return new Dec(0);
    return new Dec(lease.value.amount.amount ?? 0, currency.value?.decimal_digits);
  });

  const debt = computed(() => {
    const selectedCurrency = currency.value;
    if (selectedCurrency) {
      const repaymentData = getRepayment(100);
      if (!repaymentData) {
        return undefined;
      }
      const { repayment, repaymentInStable } = repaymentData;
      const repaymentInt = repayment.mul(new Dec(10).pow(new Int(selectedCurrency.decimal_digits))).truncate();

      return {
        amountInStable: new CoinPretty(
          {
            coinDenom: selectedCurrency.shortName,
            coinMinimalDenom: selectedCurrency.ibcData,
            coinDecimals: selectedCurrency.decimal_digits
          },
          repaymentInStable
        )
          .trim(true)
          .maxDecimals(4)
          .hideDenom(true),
        amount: new CoinPretty(
          {
            coinDenom: selectedCurrency.shortName,
            coinMinimalDenom: selectedCurrency.ibcData,
            coinDecimals: selectedCurrency.decimal_digits
          },
          repaymentInt
        ).hideDenom(true)
      };
    }
    return undefined;
  });

  const lpn = computed(() => {
    // currency.value can be undefined during transient states (no assets yet,
    // unknown ticker bail-out, etc.). Fall back to the lease's own protocol
    // to resolve the LPN — same intent as below, just without crashing on null.
    const key = currency.value?.key;
    const protocol = key ? key.split("@")[1] : (lease.value?.protocol ?? "");
    if (!protocol) {
      return "";
    }
    const lpnData = getLpnByProtocol(protocol);

    for (const lpn of configStore.lpn ?? []) {
      const [_, p] = lpn.key.split("@");
      if (p === protocol) {
        return lpn.shortName;
      }
    }
    return lpnData?.shortName ?? "";
  });

  const payout = computed(() => {
    if (!lease.value || lease.value.status !== "opened") return "0.00";
    const ticker = lease.value.amount.ticker;
    const currencyData = configStore.currenciesData[`${ticker}@${lease.value.protocol}`];
    if (!currencyData) return "0.00";
    const price = new Dec(pricesStore.prices[currencyData.key as string]?.price ?? 0);
    const value = new Dec(amount.value.length === 0 ? 0 : amount.value).mul(price);

    const outStanding = getAmountValue("0").amountInStable.toDec();
    let payOutValue = value.sub(outStanding);

    if (payOutValue.isNegative()) {
      return "0.00";
    }

    const positionType = configStore.getPositionType(lease.value.protocol);
    const lpnData = getLpnByProtocol(lease.value.protocol);

    if (positionType === "Short") {
      const lpnPrice = new Dec(pricesStore.prices[lpnData.key as string].price);
      payOutValue = payOutValue.quo(lpnPrice);
    }

    return payOutValue.toString(Number(lpnData.decimal_digits));
  });

  const positionLeft = computed(() => {
    if (!lease.value || lease.value.status !== "opened") return "0.00";

    const ticker = lease.value.amount.ticker;
    const currencyData = configStore.currenciesData[`${ticker}@${lease.value.protocol}`];
    if (!currencyData) return "0.00";
    const a = new Dec(lease.value.amount.amount, Number(currencyData.decimal_digits));
    const value = new Dec(amount.value.length === 0 ? 0 : amount.value);
    const left = a.sub(value);

    if (left.isNegative()) {
      return "0.00";
    }

    return `${left.toString(Number(currencyData.decimal_digits))} ${currencyData.shortName}`;
  });

  // For short positions: stable values derived directly from chain data and current
  // price — intentionally NOT using getRepayment/swapFee so the preview doesn't flash
  // when the async fee arrives.

  // Outstanding debt in ATOM (human-readable), taken from displayData which is already
  // correctly computed with decimal_digits applied — same source as the Summary widget.
  const shortDebtAtom = computed(() => {
    const positionType = configStore.getPositionType(lease.value?.protocol as string);
    if (positionType !== "Short" || !lease.value || !displayData.value || lease.value.status !== "opened") return null;

    const debtTicker = lease.value.debt.ticker;
    const debtCurrency = configStore.currenciesData[`${debtTicker}@${lease.value.protocol}`];

    return { amount: displayData.value.totalDebt, symbol: debtCurrency.shortName };
  });

  // For Short positions: does the entered USDC amount buy enough ATOM to fully cover the debt?
  // Uses chain-based debt and current market price — no dependency on swapFee or getRepayment,
  // so the result is stable from the first render (no flashing when swapFee arrives).
  const coversFullDebt = computed(() => {
    if (!shortDebtAtom.value || !lease.value) return false;
    const v = amount.value;
    if (!v || v.length === 0) return false;

    const debtTicker = lease.value.debt.ticker;
    const priceEntry = pricesStore.prices[`${debtTicker}@${lease.value.protocol}`];
    if (!priceEntry?.price) return false;

    const currentDebtPrice = new Dec(priceEntry.price);
    const amountUsdc = new Dec(v);
    const atomBought = amountUsdc.quo(currentDebtPrice);
    return atomBought.gte(shortDebtAtom.value.amount);
  });

  // ATOM the user gets back: input USDC buys X ATOM at current price, minus the debt.
  // Uses amount.value directly — no dependency on swapFee or getRepayment.
  const shortReturnAtom = computed(() => {
    if (!shortDebtAtom.value || !lease.value) return null;
    const v = amount.value;
    if (!v || v.length === 0) return null;

    const debtTicker = lease.value.debt.ticker;
    const priceEntry = pricesStore.prices[`${debtTicker}@${lease.value.protocol}`];
    if (!priceEntry?.price) return null;

    const currentDebtPrice = new Dec(priceEntry.price);
    const amountUsdc = new Dec(v);
    const atomBought = amountUsdc.quo(currentDebtPrice);
    const excess = atomBought.sub(shortDebtAtom.value.amount);

    if (excess.isNegative() || excess.isZero()) return null;
    return `${formatTokenBalance(excess)} ${shortDebtAtom.value.symbol}`;
  });

  function onSetAmount(percent: number) {
    sliderValue.value = percent;
    const selected = currency.value;
    if (!selected) return;
    const a = total.value.mul(new Dec(percent).quo(new Dec(100)));
    amount.value = a.toString(selected.decimal_digits);
  }

  function onSelectFullPosition() {
    onSetAmount(100);
  }

  function onSelectZero() {
    onSetAmount(0);
  }

  function onSelectDebt() {
    handleAmountChange(debt.value?.amount?.toString() ?? "0");
  }

  const calculatedBalance = computed(() => {
    const asset = assets.value[selectedCurrency.value];
    if (!asset) {
      return formatUsd(0);
    }
    const price = new Dec(pricesStore.prices[asset.key]?.price ?? 0);
    const v = amount?.value?.length ? amount?.value : "0";
    const stable = price.mul(new Dec(v));
    return formatDecAsUsd(stable);
  });
  const midPosition = computed(() => {
    const d = debt.value?.amount.toDec() ?? new Dec(0);

    if (total.value.isZero()) {
      return 0;
    }

    return Number(d.quo(total.value).mul(new Dec(100)).toString());
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
      sliderValue.value = Number(percent);
    }
  }

  function outStandingDebt() {
    if (!lease.value || lease.value.status !== "opened") return new Dec(0);

    const debt = new Dec(lease.value.debt.principal)
      .add(new Dec(lease.value.debt.overdue_margin))
      .add(new Dec(lease.value.debt.overdue_interest))
      .add(new Dec(lease.value.debt.due_margin))
      .add(new Dec(lease.value.debt.due_interest));

    return debt;
  }

  async function setSwapFee() {
    clearTimeout(time);
    time = setTimeout(() => {
      void (async () => {
        const lease_currency = currency.value;
        const lpnCurrency = getLpnByProtocol(lease.value?.protocol as string);
        const debtValue = debt.value;
        if (!debtValue || !lpnCurrency || !lease_currency) {
          return;
        }
        // The Skip route call (and the Dec conversions) run inside a debounced timer
        // detached from the render cycle: an unhandled rejection here would surface
        // as a console error and leave the preview fee silently stale. Catch and log
        // so a transient route/price failure degrades gracefully instead.
        try {
          let microAmount = CurrencyUtils.convertDenomToMinimalDenom(
            debtValue.amount.toDec().toString(),
            lease_currency.ibcData,
            lease_currency.decimal_digits
          ).amount.toString();

          let amountIn = 0;
          let amountOut = 0;

          const positionType = configStore.getPositionType(lease.value?.protocol as string);
          if (positionType === "Short") {
            microAmount = CurrencyUtils.convertDenomToMinimalDenom(
              debtValue.amount.toDec().toString(),
              lpnCurrency.ibcData,
              lpnCurrency.decimal_digits
            ).amount.toString();
          }

          await Promise.all([
            SkipRouter.getRoute(lease_currency.ibcData, lpnCurrency.ibcData, microAmount).then((data) => {
              amountIn += Number(data.usd_amount_in ?? 0);
              amountOut += Number(data.usd_amount_out ?? 0);

              return Number(data?.swap_price_impact_percent ?? 0);
            })
          ]);

          const out_a = Math.max(amountOut, amountIn);
          const in_a = Math.min(amountOut, amountIn);

          const diff = out_a - in_a;
          let fee = 0;
          if (in_a > 0) {
            fee = diff / in_a;
          }

          swapFee.value = fee;
        } catch (e) {
          Logger.error(e);
        }
      })();
    }, timeOut);
  }

  function isAmountValid() {
    let isValid = true;
    amountErrorMsg.value = "";
    if (lease.value && lease.value.status === "opened") {
      const a = amount.value;
      const currencyData = configStore.getCurrencyByKey(`${lease.value.amount.ticker}@${lease.value.protocol}`);
      const minAssetSpec = minAsset.value;
      const minAmountCurrency = minAssetSpec ? configStore.getCurrencyByTicker(minAssetSpec.ticker) : undefined;
      const positionType = configStore.getPositionType(lease.value.protocol);
      const currencyPriceEntry = currencyData ? pricesStore.prices[currencyData.key as string] : undefined;
      const shortMinAssetPrice =
        positionType === "Short" && minAssetSpec
          ? pricesStore.prices[`${minAssetSpec.ticker}@${lease.value.protocol}`]?.price
          : undefined;

      // Price/currency feeds can lag the form (late WS price, config skew). Without
      // them validation cannot run; surface a specific message rather than
      // force-unwrapping a missing entry and throwing inside the reactive watch.
      if (
        !currencyData ||
        !minAssetSpec ||
        !minAmountCurrency ||
        !currencyPriceEntry?.price ||
        (positionType === "Short" && !shortMinAssetPrice)
      ) {
        amountErrorMsg.value = i18n.t("message.unexpected-error");
        return false;
      }

      const debtAmount = new Dec(lease.value.amount.amount, Number(currencyData.decimal_digits));
      let minAmont = new Dec(minAssetSpec.amount, Number(minAmountCurrency.decimal_digits));
      if (positionType === "Short" && shortMinAssetPrice) {
        minAmont = minAmont.mul(new Dec(shortMinAssetPrice));
      }
      const price = new Dec(currencyPriceEntry.price);

      const minAmountTemp = new Dec(minimumLeaseAmount);
      const amountInStable = new Dec(a.length === 0 ? "0" : a).mul(price);
      if (amount.value || amount.value !== "") {
        const amountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
          a,
          "",
          Number(currencyData.decimal_digits)
        );
        const value = new Dec(amountInMinimalDenom.amount, Number(currencyData.decimal_digits));

        const isLowerThanOrEqualsToZero = new Dec(amountInMinimalDenom.amount || "0").lte(new Dec(0));

        if (isLowerThanOrEqualsToZero) {
          amountErrorMsg.value = i18n.t("message.invalid-balance-low");
          isValid = false;
        }

        if (amountInStable.lt(minAmountTemp)) {
          amountErrorMsg.value = i18n.t("message.min-amount-allowed", {
            amount: formatTokenBalance(minAmountTemp.quo(price)),
            currency: currencyData.shortName
          });
          isValid = false;
        } else if (value.gt(debtAmount)) {
          amountErrorMsg.value = i18n.t("message.lease-only-max-error", {
            maxAmount: formatTokenBalance(debtAmount),
            symbol: currencyData.shortName
          });
          isValid = false;
        } else if (!value.equals(debtAmount) && debtAmount.sub(value).mul(price).lte(minAmont)) {
          amountErrorMsg.value = i18n.t("message.lease-min-amount", {
            amount: formatTokenBalance(minAmont.quo(price)),
            symbol: currencyData.shortName
          });
          isValid = false;
        }
      } else {
        amountErrorMsg.value = i18n.t("message.missing-amount");
        isValid = false;
      }
    }

    return isValid;
  }

  function getPrice() {
    if (!lease.value || !displayData.value) return undefined;
    return displayData.value.openingPrice;
  }

  function getRepayment(p: number) {
    if (!lease.value || lease.value.status !== "opened") return undefined;

    const amount = outStandingDebt();
    const ticker = lease.value.debt.ticker;
    const c = configStore.currenciesData[`${ticker}@${lease.value.protocol}`];

    const amountToRepay = CurrencyUtils.convertMinimalDenomToDenom(
      amount.toString(),
      c.shortName,
      c.ibcData,
      c.decimal_digits
    ).toDec();

    const percent = new Dec(p).quo(new Dec(100));
    let repaymentInStable = amountToRepay.mul(percent);
    const selectedCurrency = currency.value;

    if (swapFee.value) {
      repaymentInStable = repaymentInStable.add(repaymentInStable.mul(new Dec(swapFee.value)));
    }

    const positionType = configStore.getPositionType(lease.value.protocol);
    const price = getPrice();

    if (positionType === "Short") {
      // For short positions, debt is in the debt asset (e.g. ATOM).
      // Convert to the position currency (e.g. USDC) using the current market price.
      // Add a 1% price buffer so the suggested amount covers the debt even if the
      // volatile asset price rises slightly between now and transaction execution.
      const SHORT_PRICE_BUFFER = new Dec("1.01");
      const debtTicker = lease.value.debt.ticker;
      const debtAssetPrice = new Dec(pricesStore.prices[`${debtTicker}@${lease.value.protocol}`]?.price ?? "1");
      const selectedPriceEntry = pricesStore.prices[selectedCurrency.key as string];
      // A missing selected-currency price would divide by zero and throw inside a
      // render computed, freezing it. Bail so callers render an empty preview —
      // mirrors the Long branch below and the guarded RepayDialog.
      if (!selectedPriceEntry?.price) {
        return undefined;
      }
      const selected_asset_price = new Dec(selectedPriceEntry.price);
      const repayment = repaymentInStable.mul(debtAssetPrice).mul(SHORT_PRICE_BUFFER);
      return {
        repayment: repayment.quo(selected_asset_price),
        repaymentInStable: repayment,
        selectedCurrencyInfo: selectedCurrency
      };
    } else {
      // Oracle hiccup / missing feed: dividing by zero throws `RangeError: Division by zero`.
      // The calling action surfaces a user-facing toast; here we just bail out safely.
      if (!price || price.isZero()) {
        return undefined;
      }
      const repayment = repaymentInStable.quo(price);
      return {
        repayment,
        repaymentInStable,
        selectedCurrencyInfo: selectedCurrency
      };
    }
  }
  async function onSendClick() {
    try {
      disabled.value = true;
      await walletOperation(marketCloseLease);
    } catch (e: unknown) {
      Logger.error(e);
      amountErrorMsg.value = i18n.t(classifyError(e));
    } finally {
      disabled.value = false;
    }
  }

  async function marketCloseLease() {
    const wallet = walletStore.wallet as NolusWallet;
    // Oracle hiccup / missing feed: without a valid opening price we cannot compute
    // the repayment split, and the tx would either revert on-chain or crash the
    // client's division-by-zero. Bail out with a toast before any other validation
    // so the user sees the root cause, not a downstream balance error.
    if (wallet && lease.value) {
      const openingPrice = getPrice();
      if (!openingPrice || openingPrice.isZero()) {
        onShowToast({
          type: ToastType.error,
          message: i18n.t("message.close-invalid-price")
        });
        return;
      }
    }
    if (wallet && isAmountValid() && lease.value) {
      try {
        loading.value = true;
        const funds: Coin[] = [];

        const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
        const leaseClient = new Lease(cosmWasmClient, lease.value.address);

        const {
          txHash: _txHash,
          txBytes,
          usedFee: _usedFee
        } = await leaseClient.simulateClosePositionLeaseTx(wallet, getCurrency(), funds);
        await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
        leasesStore.markLeaseInProgress(lease.value.address, "close");
        void balancesStore.fetchBalances();
        reload();
        dialog?.value?.close();
        void historyStore.loadActivities();
        onShowToast({
          type: ToastType.success,
          message: i18n.t("message.toast-closed")
        });
      } catch (e: unknown) {
        Logger.error(e);
        amountErrorMsg.value = i18n.t(classifyError(e));
      } finally {
        loading.value = false;
      }
    }
  }

  function getCurrency() {
    if (!lease.value || lease.value.status !== "opened") return undefined;

    const microAmount = getMicroAmount(currency.value.ibcData, amount.value);
    const a = new Int(lease.value.amount.amount ?? 0);

    if (a.equals(microAmount.mAmount.amount)) {
      return undefined;
    }

    const c = currency.value;

    return {
      amount: microAmount.mAmount.amount.toString(),
      ticker: c.ticker
    };
  }

  // Reacts to: the typed amount and the selected close currency.
  // Re-firing on the same input is safe — isAmountValid is idempotent (it resets
  // amountErrorMsg on each run). The try/catch is the backstop for any residual
  // throw from a lagging price/currency feed so the field never silently freezes.
  watch(
    () => [amount.value, selectedCurrency.value],
    () => {
      try {
        isAmountValid();
      } catch (e) {
        Logger.error(e);
        amountErrorMsg.value = i18n.t("message.unexpected-error");
      }
    }
  );

  watch(
    () => [currency.value?.key],
    () => {
      void setSwapFee();
    },
    {
      deep: true
    }
  );

  function getAmountValue(a: string) {
    const selectedCurrency = assets.value[0];
    if (!selectedCurrency) {
      return {
        amountInStable: new CoinPretty({ coinDenom: "", coinMinimalDenom: "", coinDecimals: 0 }, new Int(0))
          .trim(true)
          .hideDenom(true),
        amount: new CoinPretty({ coinDenom: "", coinMinimalDenom: "", coinDecimals: 0 }, new Int(0))
      };
    }
    const [_, protocolKey] = selectedCurrency.key.split("@");
    const lpnData = getLpnByProtocol(protocolKey);

    const amount = new Dec(a);
    const price = new Dec(pricesStore.prices[selectedCurrency.key as string]?.price ?? 0);
    const repaymentData = getRepayment(100);
    const repayment = repaymentData?.repayment ?? new Dec(0);
    const repaymentInStable = repaymentData?.repaymentInStable ?? new Dec(0);

    const amountInStableInt = amount
      .mul(price)
      .mul(new Dec(10).pow(new Int(lpnData.decimal_digits)))
      .truncate();
    const amountInt = amount.mul(new Dec(10).pow(new Int(selectedCurrency.decimal_digits))).truncate();

    const repaymentInt = repayment.mul(new Dec(10).pow(new Int(selectedCurrency.decimal_digits))).truncate();
    const repaymentInStableInt = repaymentInStable.mul(new Dec(10).pow(new Int(lpnData.decimal_digits))).truncate();

    let vStable = repaymentInStableInt.sub(amountInStableInt);
    let v = repaymentInt.sub(amountInt);

    if (vStable.isNegative()) {
      vStable = new Int(0);
    }

    if (v.isNegative()) {
      v = new Int(0);
    }

    return {
      amountInStable: new CoinPretty(
        {
          coinDenom: lpnData.shortName,
          coinMinimalDenom: lpnData.ibcData,
          coinDecimals: Number(lpnData.decimal_digits)
        },
        vStable
      )
        .trim(true)
        .hideDenom(true),
      amount: new CoinPretty(
        {
          coinDenom: selectedCurrency.shortName,
          coinMinimalDenom: selectedCurrency.ibcData,
          coinDecimals: selectedCurrency.decimal_digits
        },
        v
      )
    };
  }

  function closeDialog() {
    const path =
      route.matched[2].path === `/${RouteNames.LEASES}`
        ? `/${RouteNames.LEASES}`
        : `/${RouteNames.LEASES}/${route.params.id}`;
    void router.push(path);
  }

  return {
    dialog,
    lease,
    assets,
    currency,
    isLoading,
    loading,
    disabled,
    amount,
    amountErrorMsg,
    sliderValue,
    midPosition,
    calculatedBalance,
    debt,
    priceUsd,
    remaining,
    paidDebt,
    debtData,
    lpn,
    payout,
    positionLeft,
    coversFullDebt,
    shortReturnAtom,
    onSetAmount,
    onSelectFullPosition,
    onSelectZero,
    onSelectDebt,
    handleAmountChange,
    onSendClick,
    closeDialog
  };
}
