import { computed } from "vue";
import { LeaseMath } from "@/common/utils";
import { getLpnByProtocol } from "@/common/utils/CurrencyLookup";
import type { CurrencyInfo } from "@/common/api/types/config";

import { Dec } from "@keplr-wallet/unit";
import { useLeaseDetailsBase, useLeaseDetailsCore, type LeaseDetailsProps } from "./useLeaseDetailsCore";

export type LongLeaseDetailsProps = LeaseDetailsProps;

export function useLongLeaseDetails(props: LeaseDetailsProps) {
  const base = useLeaseDetailsBase(props);
  const { pricesStore, swapStableFee, asset, downPaymentAsset } = base;

  // Long: the lpn/protocol comes from the down-payment key.
  const lpn = computed<CurrencyInfo | null>(() => {
    const dpa = downPaymentAsset.value;
    if (dpa === undefined) {
      return null;
    }
    const [, p] = dpa.key.split("@");
    if (p === undefined) {
      return null;
    }
    return getLpnByProtocol(p);
  });

  const core = useLeaseDetailsCore(props, base, {
    lpn,
    // Long swaps the down payment and the borrowed LPN into the leased asset itself.
    resolveRouteTarget: (a) => a.ibcData,
    liquidate: (unitAsset, stableAsset) => LeaseMath.calculateLiquidation(unitAsset, stableAsset)
  });

  const swapFeeAmount = computed(() => {
    const a = asset.value;
    if (a === undefined) {
      return new Dec(0);
    }
    const price = new Dec(pricesStore.prices[a.key]?.price ?? 0);
    const decimals = new Dec(10 ** a.decimal_digits);
    const v = new Dec(swapStableFee.value);
    const amount = v.quo(price).mul(decimals);
    return amount;
  });

  const sizeAmount = computed(() => {
    if (!props.lease?.total?.amount) {
      return "0";
    }

    const total = new Dec(props.lease?.total.amount ?? "0").sub(swapFeeAmount.value);
    return total.truncate().toString();
  });

  const stable = computed(() => {
    const price = new Dec(pricesStore.prices[asset.value?.key as string]?.price ?? 0);
    const v = props.lease?.total?.amount ?? "0";
    const stable = price.mul(new Dec(v, asset.value?.decimal_digits ?? 0)).sub(new Dec(swapStableFee.value));

    return stable.toString();
  });

  const borrowAmount = computed(() => {
    const a = asset.value;
    if (a === undefined) {
      return "0";
    }
    const price = new Dec(pricesStore.prices[a.key]?.price ?? 0);
    const decimals = new Dec(10 ** a.decimal_digits);
    const v = core.borrowStable.value;
    const amount = v.quo(price).mul(decimals);
    return amount.truncate().toString();
  });

  const percentLique = computed(() => {
    const a = asset.value;
    // Use the currency key to get the price, not ibcData
    const price = new Dec(pricesStore.prices[a?.key as string]?.price ?? "0", a?.decimal_digits ?? 0);
    const lprice = core.getLiquidation();

    if (lprice.isZero() || price.isZero()) {
      return `0`;
    }

    const p = price.sub(lprice).quo(price);
    return `-${p.abs().mul(new Dec(100)).toString(0)}`;
  });

  return {
    pricesStore,
    swapStableFee,
    sizeAmount,
    asset,
    stable,
    borrowStable: core.borrowStable,
    borrowAmount,
    downPaymentStable: core.downPaymentStable,
    downPaymentAmount: core.downPaymentAmount,
    downPaymentAsset,
    annualInterestRate: core.annualInterestRate,
    isFreeLease: core.isFreeLease,
    percentLique,
    calculateLique: core.calculateLique,
    currentPriceDecimals: core.currentPriceDecimals,
    lpn,
    swapFeeAmount
  };
}
