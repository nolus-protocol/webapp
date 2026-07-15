import type { LeaseApply } from "@nolus/nolusjs/build/contracts";
import { computed, onUnmounted, ref, watch } from "vue";
import { MONTHS } from "@/config/global";
import { getAdaptivePriceDecimals, formatPrice } from "@/common/utils/NumberFormatUtils";
import { usePricesStore } from "@/common/stores/prices";
import { useConfigStore } from "@/common/stores/config";
import { LeaseMath } from "@/common/utils";
import { getCurrencyByTicker, getLpnByProtocol } from "@/common/utils/CurrencyLookup";

import { Dec } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { SkipRouter } from "@/common/utils/SkipRoute";

export interface ShortLeaseDetailsProps {
  lease: LeaseApply | null | undefined;
  loanCurrency: string;
  downpaymenAmount: string;
  downpaymentCurrency: string;
}

export function useShortLeaseDetails(props: ShortLeaseDetailsProps) {
  // Debounce window for the two Promise.all'd Skip API calls fired when the
  // lease quote changes. Must stay comfortably above the Leaser contract call
  // latency so rapid slider drags collapse to a single fire — a shorter window
  // let slow contract responses trigger back-to-back setSwapFee runs and hit
  // the backend's /api/swap/route strict rate limit (2 RPS, burst 5).
  const timeOut = 600;
  let time: NodeJS.Timeout;

  const pricesStore = usePricesStore();
  const configStore = useConfigStore();
  const swapFee = ref(0);
  const swapStableFee = ref(0);

  onUnmounted(() => {
    clearTimeout(time);
  });

  watch(
    () => [props.lease],
    (_value) => {
      void setSwapFee();
    }
  );

  /** The currency for lease.total (stable currency for shorts, e.g., USDC) */
  const totalAsset = computed(() => {
    const ticker = props.lease?.total?.ticker;
    if (!ticker) return null;
    return getCurrencyByTicker(ticker);
  });

  const sizeAmount = computed(() => {
    if (!props.lease?.total?.amount) {
      return "0";
    }
    // For shorts, lease.total is in the stable currency (e.g., USDC)
    const decimals = totalAsset.value?.decimal_digits ?? 6;
    const fee = new Dec(swapStableFee.value, decimals);
    const total = new Dec(props.lease?.total.amount ?? "0").sub(fee);
    return total.truncate().toString();
  });

  const isFreeLease = computed(() => {
    // Free interest is handled by a 3rd party service
    return false;
  });

  const annualInterestRate = computed(() => {
    return ((props.lease?.annual_interest_rate ?? 0) + (props.lease?.annual_interest_rate_margin ?? 0)) / MONTHS;
  });

  const totalLoan = computed(() => {
    if (!props.lease?.total?.amount) {
      return "0";
    }
    const a = asset.value;
    if (a === undefined) {
      return "0";
    }
    const price = new Dec(pricesStore.prices[a.key]?.price ?? 0);
    if (!price.isPositive()) {
      return "0";
    }
    const decimals = totalAsset.value?.decimal_digits ?? 6;
    const totalHuman = new Dec(props.lease.total.amount, decimals);
    const feeHuman = new Dec(swapStableFee.value).quo(price);
    const amount = totalHuman.quo(price).sub(feeHuman);
    return amount.toString(a.decimal_digits);
  });

  const asset = computed(() => {
    const currency = configStore.currenciesData?.[props.loanCurrency];
    return currency;
  });

  const lpn = computed(() => {
    const loan = loanAsset.value;
    if (loan === undefined) {
      return null;
    }
    const [_t, p] = loan.key.split("@");
    if (p === undefined) {
      return null;
    }
    return getLpnByProtocol(p);
  });

  const downPaymentAsset = computed(() => {
    const currency = configStore.currenciesData?.[props.downpaymentCurrency];
    return currency;
  });

  const loanAsset = computed(() => {
    const currency = configStore.currenciesData[props.loanCurrency];
    return currency;
  });

  const downPaymentAmount = computed(() => {
    const dpa = downPaymentAsset.value;
    if (dpa === undefined) {
      return "0";
    }
    const price = new Dec(pricesStore.prices[dpa.key]?.price ?? 0);
    const decimals = new Dec(10 ** dpa.decimal_digits);
    const v = downPaymentStable.value;
    const amount = v.quo(price).mul(decimals);
    return amount.truncate().toString();
  });

  const downPaymentStable = computed(() => {
    const dpa = downPaymentAsset.value;
    if (dpa === undefined) {
      return new Dec(0);
    }
    const price = new Dec(pricesStore.prices[dpa.key]?.price ?? 0);
    const v = props.downpaymenAmount.length === 0 ? "0" : props.downpaymenAmount;
    const stable = price.mul(new Dec(v));
    return stable;
  });

  const borrowAmount = computed(() => {
    const a = asset.value;
    const l = lpn.value;
    if (a === undefined || l === null) {
      return "0";
    }
    const price = new Dec(pricesStore.prices[a.key]?.price ?? 0);
    const decimals = new Dec(10 ** l.decimal_digits);
    const v = borrowStable.value;
    const amount = v.quo(price).mul(decimals);
    return amount.truncate().toString();
  });

  const swapFeeAmount = computed(() => {
    const a = asset.value;
    const l = lpn.value;
    if (a === undefined || l === null) {
      return new Dec(0);
    }
    const price = new Dec(pricesStore.prices[a.key]?.price ?? 0);
    const decimals = new Dec(10 ** l.decimal_digits);
    const v = new Dec(swapStableFee.value);
    const amount = v.quo(price).mul(decimals);
    return amount;
  });

  const borrowStable = computed(() => {
    const l = lpn.value;
    if (l === null) {
      return new Dec(0);
    }
    const price = new Dec(pricesStore.prices[l.key]?.price ?? 0);
    const v = props.lease?.borrow?.amount ?? "0";
    const stable = price.mul(new Dec(v, l.decimal_digits));
    return stable;
  });

  const currentPriceDecimals = computed(() => {
    return getAdaptivePriceDecimals(Number(pricesStore.prices[props.loanCurrency]?.price ?? 0));
  });

  const calculateLique = computed(() => {
    const d = getLquidation();
    if (d.isZero()) {
      return `${d.toString(2)}`;
    }
    return formatPrice(d.toString(8));
  });

  const percentLique = computed(() => {
    try {
      const a = asset.value;
      const [_, protocol] = a?.key?.split("@") ?? [];
      if (a === undefined || protocol === undefined) {
        return "0";
      }
      const lpn = getLpnByProtocol(protocol);
      if (lpn === null) {
        return "0";
      }

      const price = new Dec(pricesStore.prices[lpn.key]?.price ?? "0", a.decimal_digits);
      const lprice = getLquidation();

      if (lprice.isZero() || price.isZero()) {
        return `0`;
      }

      const p = price.sub(lprice).quo(price);

      return `${p.abs().mul(new Dec(100)).toString(0)}`;
    } catch {
      return "0";
    }
  });

  function getLquidation() {
    const lease = props.lease;
    if (lease && lease.borrow.ticker && lease.total.ticker) {
      const unitAssetInfo = getCurrencyByTicker(lease.borrow.ticker);
      const stableAssetInfo = getCurrencyByTicker(lease.total.ticker);

      const unitAsset = new Dec(getBorrowedAmount(), Number(unitAssetInfo.decimal_digits));

      const stableAsset = new Dec(getTotalAmount(), Number(stableAssetInfo.decimal_digits));
      return LeaseMath.calculateLiquidationShort(stableAsset, unitAsset);
    }

    return new Dec(0);
  }

  function getBorrowedAmount() {
    const borrow = props.lease?.borrow;

    if (borrow) {
      const amount = new Dec(borrow?.amount ?? 0).truncate();
      return amount;
    }

    return new Dec(0).truncate();
  }

  function getTotalAmount() {
    const total = props.lease?.total;
    return new Dec(total?.amount ?? 0).truncate();
  }

  const setSwapFee = async () => {
    clearTimeout(time);
    const lease = props.lease;
    if (!lease) return;
    time = setTimeout(() => {
      void (async () => {
        const currency = downPaymentAsset.value;
        const a = asset.value;
        if (currency === undefined || a === undefined) return;
        const [_, p] = a.key.split("@");
        if (p === undefined) return;

        // For a Short position the on-chain flow swaps both the down payment and
        // the borrowed LPN to the stable the position settles in (lease.total.ticker,
        // e.g. USDC_NOBLE) — NOT to asset.value (the borrowed/shorted asset, which
        // on a Short protocol is the same as the LPN). Routing source→source is a
        // no-op and Skip returns a zero fee, so the UI showed 0.00 BTC.
        const stableTicker = lease.total?.ticker;
        const stable = stableTicker ? configStore.currenciesData?.[`${stableTicker}@${p}`] : null;
        if (!stable) return;

        const microAmount = CurrencyUtils.convertDenomToMinimalDenom(
          props.downpaymenAmount,
          currency.ibcData,
          currency.decimal_digits
        ).amount.toString();

        const lpn = getLpnByProtocol(p);
        if (lpn === null) return;
        let amountIn = 0;
        let amountOut = 0;
        await Promise.all([
          SkipRouter.getRoute(currency.ibcData, stable.ibcData, microAmount).then((data) => {
            amountIn += Number(data.usd_amount_in ?? 0);
            amountOut += Number(data.usd_amount_out ?? 0);

            return Number(data?.swap_price_impact_percent ?? 0);
          }),
          SkipRouter.getRoute(lpn.ibcData, stable.ibcData, lease.borrow.amount).then((data) => {
            amountIn += Number(data.usd_amount_in ?? 0);
            amountOut += Number(data.usd_amount_out ?? 0);

            return Number(data?.swap_price_impact_percent ?? 0);
          })
        ]);
        const out_a = Math.max(amountOut, amountIn);
        const in_a = Math.min(amountOut, amountIn);

        const diff = out_a - in_a;
        swapStableFee.value = diff;
        let fee = 0;

        if (in_a > 0) {
          fee = diff / in_a;
        }
        swapFee.value = fee;
      })();
    }, timeOut);
  };

  return {
    pricesStore,
    swapStableFee,
    totalAsset,
    sizeAmount,
    isFreeLease,
    annualInterestRate,
    totalLoan,
    asset,
    downPaymentAsset,
    downPaymentAmount,
    downPaymentStable,
    borrowAmount,
    swapFeeAmount,
    borrowStable,
    currentPriceDecimals,
    calculateLique,
    percentLique
  };
}
