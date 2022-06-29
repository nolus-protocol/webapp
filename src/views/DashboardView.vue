<template>
  <div class="container w-full grid grid-cols-12 mx-auto grid-parent">
    <div class="lg:col-span-3">
      <SidebarContainer />
    </div>
    <div class="lg:col-span-9 pb-8">
      <div class="grid grid-cols-10 grid-child">
        <div class="col-span-12 mt-nolus-60">
          <div class="col-span-12">
            <div class="sidebar-header">
              <!-- <Notifications /> -->
              <Notifications />
              <WalletOpen />
            </div>
          </div>
        </div>
        <div class="col-span-12">
          <!-- Header -->
          <div
            class="flex flex-wrap items-center justify-between items-baseline px-4 lg:px-0"
          >
            <div class="left w-full md:w-1/2">
              <h1 class="nls-20 nls-font-700 text-primary m-0">Assets</h1>
            </div>
            <div
              class="right w-full md:w-1/2 mt-nolus-255 md:mt-0 inline-flex justify-start md:justify-end"
            >
              <button
                class="btn btn-secondary btn-large-secondary mr-4"
                v-on:click="showSendModal = true"
              >
                Send / Receive
              </button>
              <button class="btn btn-primary btn-large-primary">
                Buy Tokens
              </button>
            </div>
          </div>
          <!-- Wallet -->
          <div
            class="flex items-center justify-start bg-white mt-6 border-standart shadow-box radius-medium radius-0-sm py-5 px-6"
          >
            <div class="left inline-block w-1/3">
              <p class="text-large-copy text-primary nls-font-400 m-0">
                Wallet Balance
              </p>
              <p class="text-big-number text-primary m-0 mt-1">
                {{ calculateTotalBalance() }}
              </p>
            </div>
            <div class="right inline-block w-2/3">
              <NolusChart />
            </div>
          </div>

          <!-- Existing Assets -->
          <div
            class="block bg-white mt-6 border-standart shadow-box radius-medium radius-0-sm"
          >
            <!-- Top -->
            <div
              class="flex flex-wrap items-baseline justify-between pt-5 px-6"
            >
              <div class="loader-boxed" v-show="showLoading">
                <div class="loader__element"></div>
              </div>
              <div class="left w-full md:w-1/2">
                <p class="nls-16 nls-font-500 m-0">Existing assets</p>
              </div>
              <div
                class="right w-full md:w-1/2 mt-nolus-255 md:mt-0 inline-flex justify-start md:justify-end"
              >
                <div class="relative block checkbox-container">
                  <div class="flex items-center w-full justify-end">
                    <input
                      id="hide-small-balances"
                      aria-describedby="hide-small-balances"
                      name="hide-small-balances"
                      type="checkbox"
                      checked="checked"
                      v-model="hideLowerBalances"
                    />
                    <label for="hide-small-balances">Hide small balances</label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Assets -->
            <div class="block mt-6 md:mt-nolus-255">
              <!-- Assets Header -->
              <div
                class="grid grid-cols-3 md:grid-cols-4 gap-6 border-b border-standart pb-3 px-6"
              >
                <div
                  class="nls-font-500 nls-12 text-left text-dark-grey text-upper"
                >
                  Assets
                </div>

                <div
                  class="nls-font-500 nls-12 text-right text-dark-grey text-upper"
                >
                  Price
                </div>

                <div
                  class="inline-flex items-center justify-end nls-font-500 text-dark-grey nls-12 text-right text-upper"
                >
                  <span class="inline-block">Balance</span>
                  <TooltipComponent content="Content goes here" />
                </div>

                <div
                  class="hidden md:inline-flex items-center justify-end nls-font-500 text-dark-grey nls-12 text-right text-upper"
                >
                  <span class="inline-block">Earnings</span>
                  <TooltipComponent content="Content goes here" />
                </div>
              </div>

              <!-- Assets Container -->
              <div class="block">
                <AssetPartial
                  v-for="asset in this.manipulatedAssets"
                  :key="asset"
                  :asset-info="getAssetInfo(asset.udenom)"
                  :price="getMarketPrice(asset.udenom)"
                  change="4.19"
                  :changeDirection="true"
                  balance="0"
                  :assetBalance="asset.balance.amount.toString()"
                  earnings="24"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="page-container home">
    <div class="container mx-auto pt-24 lg:pt-16">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-start-3 lg:col-span-9"></div>
      </div>
    </div>

    <ReceiveSendModal
      ref="ReceiveSendModal"
      v-show="showSendModal"
      @close-modal="showSendModal = false"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import SidebarContainer from "@/components/SidebarContainer.vue";
import AssetPartial from "@/components/AssetPartial.vue";
import { AssetUtils } from "@/utils/AssetUtils";
import { Coin, Dec, Int } from "@keplr-wallet/unit";
import { AssetBalance } from "@/store/modules/wallet/state";
import ReceiveSendModal from "@/components/modals/ReceiveSendModal.vue";
import { useStore } from "@/store";
import { CurrencyUtils } from "@nolus/nolusjs";
import { assetInfo } from "@/config/assetInfo";
import { StringUtils } from "@/utils/StringUtils";
import LogoLink from "@/components/LogoLink.vue";
import SidebarElement from "@/components/SidebarElement.vue";
import TooltipComponent from "@/components/TooltipComponent.vue";
import Notifications from "@/components/Notifications.vue";
import WalletOpen from "@/components/WalletOpen.vue";
import NolusChart from "@/components/templates/utils/NolusChart.vue";
export default defineComponent({
  name: "DashboardView",
  components: {
    SidebarContainer,
    AssetPartial,
    ReceiveSendModal,
    LogoLink,
    SidebarElement,
    TooltipComponent,
    Notifications,
    WalletOpen,
    NolusChart,
  },
  data() {
    return {
      manipulatedAssets: [] as AssetBalance[],
      mainAssets: [] as AssetBalance[],
      hideLowerBalances: false,
      showSendModal: false,
      showLoading: true,
    };
  },
  watch: {
    "$store.state.wallet.balances"(balances) {
      this.mainAssets = balances;
      this.manipulatedAssets = balances;
      if (this.hideLowerBalances) {
        this.filterSmallBalances();
      }
      this.showLoading = false;
    },
    hideLowerBalances() {
      if (this.hideLowerBalances) {
        this.filterSmallBalances();
      } else {
        this.manipulatedAssets = this.mainAssets;
      }
    },
  },
  methods: {
    getAssetInfo(minimalDenom: string) {
      return AssetUtils.getAssetInfoByAbbr(minimalDenom);
    },
    getMarketPrice(minimalDenom: string) {
      const prices = useStore().state.oracle.prices;
      if (prices) {
        return (
          prices[StringUtils.getDenomFromMinimalDenom(minimalDenom)]?.amount ||
          "0"
        );
      }
      return "0";
    },
    filterSmallBalances() {
      this.manipulatedAssets = this.manipulatedAssets.filter((asset) =>
        asset.balance.amount.gt(new Int("1"))
      );
    },
    calculateTotalBalance() {
      let totalBalance = new Dec(0);
      this.mainAssets.forEach((asset) => {
        const decimals = assetInfo[asset.udenom].coinDecimals;
        const assetBalance = CurrencyUtils.calculateBalance(
          this.getMarketPrice(asset.udenom),
          new Coin(asset.udenom, asset.balance.amount.toString()),
          decimals
        );
        totalBalance = totalBalance.add(assetBalance.toDec());
      });

      return CurrencyUtils.formatPrice(totalBalance.toString()).toString();
    },
  },
});
</script>
