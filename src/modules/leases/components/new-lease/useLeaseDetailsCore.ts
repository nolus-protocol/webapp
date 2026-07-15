import type { LeaseApply } from "@nolus/nolusjs/build/contracts";
import { computed, onUnmounted, ref, watch, type ComputedRef } from "vue";
import { MONTHS } from "@/config/global";
import { getAdaptivePriceDecimals, formatPrice } from "@/common/utils/NumberFormatUtils";
import { usePricesStore } from "@/common/stores/prices";
import { useConfigStore } from "@/common/stores/config";
import { getCurrencyByTicker, getLpnByProtocol } from "@/common/utils/CurrencyLookup";
import type { CurrencyInfo } from "@/common/api/types/config";

import { Dec } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { SkipRouter } from "@/common/utils/SkipRoute";

export interface LeaseDetailsProps {
  lease: LeaseApply | null | undefined;
  loanCurrency: string;
  downpaymenAmount: string;
  downpaymentCurrency: string;
}

// The Long-vs-Short residue the shared core wires into its reactive skeleton. Each
// field is a load-bearing asymmetry the two positions keep in their own clearly
// named composable rather than buried behind a mode conditional here.
export interface LeaseDetailsStrategy {
  // The lpn currency backing the borrow. Short reads it from the loan (shorted-asset)
  // protocol; Long from the down-payment protocol — different source, same shape.
  lpn: ComputedRef<CurrencyInfo | null>;
  // The Skip-route destination for both setSwapFee legs. Short settles into the
  // protocol stable (lease.total.ticker); Long swaps into the leased asset itself.
  // Returning null aborts the refresh (Short: stable currency not resolvable).
  resolveRouteTarget: (asset: CurrencyInfo, protocol: string, lease: LeaseApply) => string | null;
  // The liquidation price. The argument order is inverted between positions —
  // Short calls calculateLiquidationShort(stable, unit), Long calls
  // calculateLiquidation(unit, stable) — so the LeaseMath call itself is the hook.
  liquidate: (unitAsset: Dec, stableAsset: Dec) => Dec;
}

// Shared primitives both the per-position residue and the core read. Kept in one
// place so `asset`/`downPaymentAsset` are a single reactive source and the
// strategy (which needs them) can be built before the core is wired.
export function useLeaseDetailsBase(props: LeaseDetailsProps) {
  const pricesStore = usePricesStore();
  const configStore = useConfigStore();
  const swapStableFee = ref(0);

  const asset = computed(() => configStore.currenciesData?.[props.loanCurrency]);
  const downPaymentAsset = computed(() => configStore.currenciesData?.[props.downpaymentCurrency]);

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

  return { pricesStore, configStore, swapStableFee, asset, downPaymentAsset, getBorrowedAmount, getTotalAmount };
}

export function useLeaseDetailsCore(
  props: LeaseDetailsProps,
  base: ReturnType<typeof useLeaseDetailsBase>,
  strategy: LeaseDetailsStrategy
) {
  const { pricesStore, swapStableFee, asset, downPaymentAsset, getBorrowedAmount, getTotalAmount } = base;
  const { lpn, resolveRouteTarget, liquidate } = strategy;

  // Debounce window for the two Promise.all'd Skip API calls fired when the
  // lease quote changes. Must stay comfortably above the Leaser contract call
  // latency so rapid slider drags collapse to a single fire — a shorter window
  // let slow contract responses trigger back-to-back setSwapFee runs and hit
  // the backend's /api/swap/route strict rate limit (2 RPS, burst 5).
  const timeOut = 600;
  let time: NodeJS.Timeout;

  onUnmounted(() => {
    clearTimeout(time);
  });

  watch(
    () => [props.lease],
    () => {
      void setSwapFee();
    }
  );

  const isFreeLease = computed(() => {
    // Free interest is handled by a 3rd party service
    return false;
  });

  const annualInterestRate = computed(() => {
    return ((props.lease?.annual_interest_rate ?? 0) + (props.lease?.annual_interest_rate_margin ?? 0)) / MONTHS;
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
    const d = getLiquidation();
    if (d.isZero()) {
      return `${d.toString(2)}`;
    }
    return formatPrice(d.toString(8));
  });

  function getLiquidation() {
    const lease = props.lease;
    if (lease && lease.borrow.ticker && lease.total.ticker) {
      const unitAssetInfo = getCurrencyByTicker(lease.borrow.ticker);
      const stableAssetInfo = getCurrencyByTicker(lease.total.ticker);

      const unitAsset = new Dec(getBorrowedAmount(), Number(unitAssetInfo.decimal_digits));

      const stableAsset = new Dec(getTotalAmount(), Number(stableAssetInfo.decimal_digits));
      return liquidate(unitAsset, stableAsset);
    }

    return new Dec(0);
  }

  async function setSwapFee() {
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

        const target = resolveRouteTarget(a, p, lease);
        if (target === null) return;

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
          SkipRouter.getRoute(currency.ibcData, target, microAmount).then((data) => {
            amountIn += Number(data.usd_amount_in ?? 0);
            amountOut += Number(data.usd_amount_out ?? 0);

            return Number(data?.swap_price_impact_percent ?? 0);
          }),
          SkipRouter.getRoute(lpn.ibcData, target, lease.borrow.amount).then((data) => {
            amountIn += Number(data.usd_amount_in ?? 0);
            amountOut += Number(data.usd_amount_out ?? 0);

            return Number(data?.swap_price_impact_percent ?? 0);
          })
        ]);
        const out_a = Math.max(amountOut, amountIn);
        const in_a = Math.min(amountOut, amountIn);

        const diff = out_a - in_a;
        swapStableFee.value = diff;
      })();
    }, timeOut);
  }

  return {
    pricesStore,
    swapStableFee,
    asset,
    downPaymentAsset,
    lpn,
    borrowStable,
    downPaymentAmount,
    downPaymentStable,
    currentPriceDecimals,
    annualInterestRate,
    isFreeLease,
    getLiquidation,
    calculateLique
  };
}
