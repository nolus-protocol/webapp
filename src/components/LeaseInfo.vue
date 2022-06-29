<template>
  <!-- Leases -->
  <div
    class="bg-white mt-6 border-standart shadow-box radius-medium radius-0-sm pb-5"
  >
    <div class="grid grid-cols-1 lg:grid-cols-3">
      <div
        class="lg:col-span-1 px-6 border-standart border-b lg:border-b-0 lg:border-r pt-5 pb-5"
      >
        <div class="flex">
          <img
            :src="require('@/assets/icons/coins/btc.svg')"
            width="36"
            height="36"
            class="inline-block m-0 mr-3"
          />
          <h1 class="text-primary nls-font-700 nls-32 nls-font-700">
            {{ this.assetInfo.amount.amount || "" }}
            <span
              class="inline-block ml-2 text-primary text-large-copy nls-14 nls-font-400"
              >{{ formatLeaseDenom(this.assetInfo.amount) }}</span
            >
          </h1>
        </div>
        {{
          calculateBalance(
            this.assetInfo.amount.amount,
            this.assetInfo.amount.denom
          )
        }}

        <div class="block mt-4 pl-12">
          <div class="block">
            <p class="text-detail text-primary m-0">Outstanding Loan Amount</p>
            <p class="text-primary nls-20 nls-font-700 nls-font-400 m-0 mt-1">
              {{
                calculateBalance(
                  this.assetInfo.principal_due.amount,
                  this.assetInfo.principal_due.denom
                )
              }}
            </p>
          </div>
          <div class="block mt-4">
            <p class="text-detail text-primary m-0">Interest Due</p>
            <p
              class="flex items-center text-primary nls-20 nls-font-700 nls-font-400 m-0 mt-1"
            >
              {{
                calculateBalance(
                  this.assetInfo.interest_due.amount,
                  this.assetInfo.interest_due.denom
                )
              }}
            </p>
          </div>
          <div class="block mt-4">
            <p class="text-detail text-primary m-0">Interest Rate</p>
            <p
              class="flex items-center text-primary nls-20 nls-font-700 nls-font-400 m-0 mt-1"
            >
              {{ formatInterestRate(this.assetInfo.annual_interest) }}
            </p>
          </div>
        </div>
      </div>
      <div class="lg:col-span-2 px-6 pt-5">
        <!-- Graph -->
      </div>
    </div>
    <div
      class="flex items-center justify-end border-t border-standart pt-4 px-6"
    >
      <button class="btn btn-secondary btn-large-secondary mr-4">Claim</button>
      <button class="btn btn-secondary btn-large-secondary">Repay</button>
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { Asset, LeaseStatus } from "@nolus/nolusjs/build/contracts";
import { assetInfo } from "@/config/assetInfo";
import { CurrencyUtils } from "@nolus/nolusjs";
import { Coin, Dec, Int } from "@keplr-wallet/unit";
import { useStore } from "@/store";

export default {
  name: "LeaseInfo",
  props: {
    assetInfo: {
      type: Object as PropType<LeaseStatus>,
    },
  },
  data() {
    return {};
  },
  methods: {
    formatLeaseDenom(asset: Asset) {
      if (asset) {
        const assetInf = assetInfo[asset.denom];
        return assetInf.coinDenom;
      }

      return "";
    },
    formatInterestRate(interestRatePromile: number) {
      return new Dec(interestRatePromile).quo(new Dec(10)).toString(1) + "%";
    },
    calculateBalance(tokenAmount: string, minimalDenom: string) {
      const prices = useStore().getters.getPrices;
      const assetInf = assetInfo[minimalDenom];
      if (prices && assetInf) {
        const coinPrice = prices[assetInf.coinDenom];
        console.log(tokenAmount);
        const tokenDecimals = assetInf.coinDecimals;
        const coinAmount = new Coin(minimalDenom, new Int(tokenAmount));
        return CurrencyUtils.calculateBalance(
          coinPrice.amount,
          coinAmount,
          0
        ).toString();
      }

      return "0";
    },
  },
};
</script>
