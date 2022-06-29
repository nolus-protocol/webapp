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
          <div class="flex flex-wrap items-center justify-between px-4 lg:px-0">
            <div class="left w-full md:w-1/2">
              <h1 class="nls-20 nls-font-700 text-primary m-0">Earnings</h1>
            </div>
          </div>

          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-7">
              <!-- Portfolio -->
              <div
                class="nolus-box block order-2 md:order-1 bg-white border-y border-standart radius-medium md:col-span-7 mt-6"
              >
                <div
                  class="flex items-center justify-between px-nolus-24 px-nolus-24 pt-nolus-24"
                >
                  <h2 class="nls-16 nls-font-500 text-left my-0">
                    Your earning portfolio
                  </h2>
                  <button class="btn btn-label btn-large-label">
                    View all earning assets
                  </button>
                </div>
                <!-- Assets -->
                <div class="block mt-6 md:mt-4">
                  <!-- Assets Header -->
                  <div
                    class="grid grid-cols-2 gap-6 border-b border-standart pb-3 px-6"
                  >
                    <div
                      class="nls-font-500 nls-12 text-dark-grey text-left text-upper"
                    >
                      Asset
                    </div>

                    <div
                      class="inline-flex items-center justify-end nls-font-500 nls-font-500 nls-12 text-dark-grey text-right text-upper"
                    >
                      <span class="inline-block">Current Balance</span>
                    </div>
                  </div>

                  <!-- Assets Container -->
                  <div class="block">
                    <div
                      :class="[
                        'grid gap-6 row-actions border-b flex border-t border-standart px-nolus-24 py-nolus-12 items-center justify-between',
                        this.cols
                          ? 'grid-cols-' + this.cols
                          : 'grid-cols-3 md:grid-cols-4',
                      ]"
                    >
                      <!-- Ticker -->
                      <div class="inline-flex items-center">
                        <img
                          :src="require('@/assets/icons/coins/btc.svg')"
                          width="32"
                          height="32"
                          class="inline-block m-0 mr-4"
                        />
                        <div class="inline-block">
                          <p
                            class="text-primary nls-font-500 nls-18 text-left uppercase m-0"
                          >
                            BTC
                          </p>
                          <p
                            class="text-dark-grey nls-13 nls-font-400 text-left capitalize m-0"
                          >
                            $32,430.22
                          </p>
                        </div>
                      </div>

                      <!-- Balance -->
                      <!-- Balance -->
                      <div class="block info-show">
                        <p
                          class="text-primary nls-font-500 nls-16 nls-font-500 text-right m-0"
                        >
                          $14,978.35
                        </p>
                        <div
                          class="flex items-center justify-end text-dark-grey nls-13 nls-font-400 text-right m-0"
                        >
                          521.21 ATOM
                        </div>
                      </div>
                      <div class="flex justify-end nls-btn-show">
                        <button
                          class="btn btn-secondary btn-medium-secondary"
                          data-v-37958d79=""
                        >
                          Supply / Withdraw
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="block">
                    <div
                      :class="[
                        'grid gap-6  row-actions border-b border-standart px-nolus-24 py-nolus-12  items-center justify-between',
                        this.cols
                          ? 'grid-cols-' + this.cols
                          : 'grid-cols-3 md:grid-cols-4',
                      ]"
                    >
                      <!-- Ticker -->
                      <div class="inline-flex items-center">
                        <img
                          :src="require('@/assets/icons/coins/nls.svg')"
                          width="32"
                          height="32"
                          class="inline-block m-0 mr-4"
                        />
                        <div class="inline-block">
                          <p
                            class="text-primary nls-font-500 nls-18 text-left uppercase m-0"
                          >
                            NLS
                          </p>
                          <p
                            class="text-dark-grey nls-13 nls-font-400 text-left capitalize m-0"
                          >
                            $0.10000
                          </p>
                        </div>
                      </div>

                      <!-- Balance -->
                      <div class="block info-show">
                        <p
                          class="text-primary nls-font-500 nls-16 nls-font-500 text-right m-0"
                        >
                          $14,978.35
                        </p>
                        <div
                          class="flex items-center justify-end text-dark-grey nls-13 nls-font-400 text-right m-0"
                        >
                          521.21 ATOM
                        </div>
                      </div>

                      <div class="flex justify-end nls-btn-show">
                        <button
                          class="btn btn-secondary btn-medium-secondary"
                          data-v-37958d79=""
                        >
                          Supply / Withdraw
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="block">
                    <div
                      :class="[
                        'grid gap-6  row-actions border-b border-b border-standart px-nolus-24 py-nolus-12  items-center justify-between',
                        this.cols
                          ? 'grid-cols-' + this.cols
                          : 'grid-cols-3 md:grid-cols-4',
                      ]"
                    >
                      <!-- Ticker -->
                      <div class="inline-flex items-center">
                        <img
                          :src="require('@/assets/icons/coins/atom.svg')"
                          width="32"
                          height="32"
                          class="inline-block m-0 mr-4"
                        />
                        <div class="inline-block">
                          <p
                            class="text-primary nls-font-500 nls-18 text-left uppercase m-0"
                          >
                            ATOM
                          </p>
                          <p
                            class="text-dark-grey nls-13 nls-font-400 text-left capitalize m-0"
                          >
                            $28.74
                          </p>
                        </div>
                      </div>

                      <!-- Balance -->
                      <div class="flex justify-end nls-btn-show">
                        <button
                          class="btn btn-secondary btn-medium-secondary"
                          data-v-37958d79=""
                        >
                          Supply / Withdraw
                        </button>
                      </div>
                      <div class="block info-show">
                        <p
                          class="text-primary nls-font-500 nls-16 nls-font-500 text-right m-0"
                        >
                          $14,978.35
                        </p>
                        <div
                          class="flex items-center justify-end text-dark-grey nls-13 nls-font-400 text-right m-0"
                        >
                          521.21 ATOM
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- Assets Container -->
                </div>
              </div>
              <!-- Portfolio -->
            </div>

            <div class="col-span-5">
              <!-- Rewards -->
              <div
                class="nolus-box block order-2 md:order-1 bg-white border-y border-standart radius-medium md:col-span-7 mt-6"
              >
                <div
                  class="flex items-center justify-between px-nolus-24 pt-nolus-24"
                >
                  <h2 class="nls-16 nls-font-500 text-left my-0">
                    Pending rewards
                  </h2>
                  <button class="btn btn-label btn-large-label">
                    Claim all
                  </button>
                </div>
                <!-- Assets -->
                <div class="block mt-nolus-16">
                  <!-- Assets Container -->
                  <div class="block">
                    <div
                      :class="[
                        'grid gap-6 border-b border-t border-standart px-nolus-24 py-nolus-12  items-center justify-between',
                        this.cols
                          ? 'grid-cols-' + this.cols
                          : 'grid-cols-3 md:grid-cols-4',
                      ]"
                    >
                      <!-- Ticker -->
                      <div class="inline-flex items-center">
                        <img
                          :src="require('@/assets/icons/coins/btc.svg')"
                          width="32"
                          height="32"
                          class="inline-block m-0 mr-4"
                        />
                        <div class="inline-block">
                          <p
                            class="text-primary nls-font-500 nls-18 text-left uppercase m-0"
                          >
                            BTC
                          </p>
                          <p
                            class="text-dark-grey nls-13 nls-font-400 text-left capitalize m-0"
                          >
                            ~$5
                          </p>
                        </div>
                      </div>

                      <!-- Balance -->
                      <div class="flex justify-end">
                        <button
                          class="btn btn-secondary btn-medium-secondary btn-emphatized mr-4"
                          data-v-37958d79=""
                        >
                          None
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="block">
                    <div
                      :class="[
                        'grid gap-6 border-b border-standart px-nolus-24 py-nolus-12  items-center justify-between',
                        this.cols
                          ? 'grid-cols-' + this.cols
                          : 'grid-cols-3 md:grid-cols-4',
                      ]"
                    >
                      <!-- Ticker -->
                      <div class="inline-flex items-center">
                        <img
                          :src="require('@/assets/icons/coins/btc.svg')"
                          width="32"
                          height="32"
                          class="inline-block m-0 mr-4"
                        />
                        <div class="inline-block">
                          <p
                            class="text-primary nls-font-500 nls-18 text-left uppercase m-0"
                          >
                            BTC
                          </p>
                          <p
                            class="text-dark-grey nls-13 nls-font-400 text-left capitalize m-0"
                          >
                            ~$5
                          </p>
                        </div>
                      </div>

                      <!-- Balance -->
                      <div class="flex justify-end">
                        <button
                          class="btn btn-secondary btn-medium-secondary btn-emphatized mr-4"
                          data-v-37958d79=""
                        >
                          None
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="block">
                    <div
                      :class="[
                        'grid gap-6 border-b border-b border-standart  px-nolus-24 py-nolus-12 items-center justify-between',
                        this.cols
                          ? 'grid-cols-' + this.cols
                          : 'grid-cols-3 md:grid-cols-4',
                      ]"
                    >
                      <!-- Ticker -->
                      <div class="inline-flex items-center">
                        <img
                          :src="require('@/assets/icons/coins/btc.svg')"
                          width="32"
                          height="32"
                          class="inline-block m-0 mr-4"
                        />
                        <div class="inline-block">
                          <p
                            class="text-primary nls-font-500 nls-18 text-left uppercase m-0"
                          >
                            BTC
                          </p>
                          <p
                            class="text-dark-grey nls-13 nls-font-400 text-left capitalize m-0"
                          >
                            ~$5
                          </p>
                        </div>
                      </div>

                      <!-- Balance -->
                      <div class="flex justify-end">
                        <button
                          class="btn btn-secondary btn-medium-secondary js-loading mr-4"
                          data-v-37958d79=""
                        >
                          None
                        </button>
                      </div>
                    </div>
                  </div>
                  <!-- Assets Container -->
                </div>
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
import Notifications from "@/components/Notifications.vue";
import WalletOpen from "@/components/WalletOpen.vue";

export default defineComponent({
  name: "EarningsView",
  components: {
    SidebarContainer,
    AssetPartial,
    Notifications,
    WalletOpen,
  },
  data() {
    return {
      cols: 2 as number,
    };
  },
});
</script>
