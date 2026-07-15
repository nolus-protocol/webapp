import { computed } from "vue";
import { LeaseMath } from "@/common/utils";
import { getCurrencyByTicker, getLpnByProtocol } from "@/common/utils/CurrencyLookup";
import type { CurrencyInfo } from "@/common/api/types/config";

import { Dec } from "@keplr-wallet/unit";
import { useLeaseDetailsBase, useLeaseDetailsCore, type LeaseDetailsProps } from "./useLeaseDetailsCore";

export type ShortLeaseDetailsProps = LeaseDetailsProps;

export function useShortLeaseDetails(props: LeaseDetailsProps) {
  const base = useLeaseDetailsBase(props);
  const { pricesStore, configStore, swapStableFee, asset, downPaymentAsset } = base;

  // Short: the lpn/protocol comes from the loan (shorted-asset) key.
  const lpn = computed<CurrencyInfo | null>(() => {
    const loan = asset.value;
    if (loan === undefined) {
      return null;
    }
    const [_t, p] = loan.key.split("@");
    if (p === undefined) {
      return null;
    }
    return getLpnByProtocol(p);
  });

  const core = useLeaseDetailsCore(props, base, {
    lpn,
    resolveRouteTarget: (_a, p, lease) => {
      // For a Short position the on-chain flow swaps both the down payment and
      // the borrowed LPN to the stable the position settles in (lease.total.ticker,
      // e.g. USDC_NOBLE) — NOT to asset.value (the borrowed/shorted asset, which
      // on a Short protocol is the same as the LPN). Routing source→source is a
      // no-op and Skip returns a zero fee, so the UI showed 0.00 BTC.
      const stableTicker = lease.total?.ticker;
      const stable = stableTicker ? configStore.currenciesData?.[`${stableTicker}@${p}`] : null;
      return stable?.ibcData ?? null;
    },
    liquidate: (unitAsset, stableAsset) => LeaseMath.calculateLiquidationShort(stableAsset, unitAsset)
  });

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

  const borrowAmount = computed(() => {
    const a = asset.value;
    const l = lpn.value;
    if (a === undefined || l === null) {
      return "0";
    }
    const price = new Dec(pricesStore.prices[a.key]?.price ?? 0);
    const decimals = new Dec(10 ** l.decimal_digits);
    const v = core.borrowStable.value;
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
      const lprice = core.getLiquidation();

      if (lprice.isZero() || price.isZero()) {
        return `0`;
      }

      const p = price.sub(lprice).quo(price);

      return `${p.abs().mul(new Dec(100)).toString(0)}`;
    } catch {
      return "0";
    }
  });

  return {
    pricesStore,
    swapStableFee,
    totalAsset,
    sizeAmount,
    isFreeLease: core.isFreeLease,
    annualInterestRate: core.annualInterestRate,
    totalLoan,
    asset,
    downPaymentAsset,
    downPaymentAmount: core.downPaymentAmount,
    downPaymentStable: core.downPaymentStable,
    borrowAmount,
    swapFeeAmount,
    borrowStable: core.borrowStable,
    currentPriceDecimals: core.currentPriceDecimals,
    calculateLique: core.calculateLique,
    percentLique
  };
}
