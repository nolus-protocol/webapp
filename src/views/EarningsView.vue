<template>
  <div class="col-span-12 mb-sm-nolus-70">
    <!-- Header -->
    <div class="flex flex-wrap mt-[25px] items-center justify-between px-4 lg:px-0">
      <div class="left w-full md:w-1/2">
        <h1 class="text-20 nls-font-700 text-primary m-0 nls-sm-title">
          Earnings
        </h1>
      </div>
    </div>

    <div class="md:grid md:grid-cols-12 md:gap-4">
      <div class="md:col-span-7 lg:col-span-7">
        <!-- Portfolio -->
        <div
          class="nolus-box block order-2 order-1 bg-white border-y border-standart radius-medium md:col-span-7 md:mt-6"
        >
          <div
            class="lg:flex block items-center justify-between px-6 pt-6"
          >
            <h2 class="text-16 nls-font-500 text-left my-0">
              Your earning portfolio
            </h2>
            <button
              class="btn btn-label btn-large-label text-right nls-md-hidden"
            >
              View all earning assets
            </button>
          </div>
          <!-- Assets -->
          <div class="block mt-6 md:mt-[25px]">
            <!-- Assets Header -->
            <div
              class="grid grid-cols-2 gap-6 border-b border-standart pb-3 px-6"
            >
              <div
                class="nls-font-500 text-12 text-dark-grey text-left text-upper"
              >
                Asset
              </div>

              <div
                class="inline-flex items-center justify-end nls-font-500 text-12 text-dark-grey text-right text-upper"
              >
                <span class="inline-block">Current Balance</span>
              </div>
            </div>

            <!-- Assets Container -->
            <div class="block">
              <div
                :class="[
                  'grid gap-6 row-actions border-b flex border-t border-standart px-6 py-3 items-center justify-between',
                  this.cols
                    ? 'grid-cols-' + this.cols
                    : 'grid-cols-3 md:grid-cols-4',
                ]"
              >
                <!-- Ticker -->
                <div class="inline-flex items-center">
                  <img
                    :src="require('@/assets/icons/coins/btc.svg')"
                    class="inline-block m-0 mr-4"
                    height="32"
                    width="32"
                  />
                  <div class="inline-block">
                    <p
                      class="text-primary nls-font-500 text-18 text-left uppercase m-0"
                    >
                      BTC
                    </p>
                    <p
                      class="text-dark-grey text-12 nls-font-400 text-left capitalize m-0"
                    >
                      $32,430.22
                    </p>
                  </div>
                </div>

                <!-- Balance -->
                <!-- Balance -->
                <div class="block info-show">
                  <p
                    class="text-primary nls-font-500 text-16 nls-font-500 text-right m-0"
                  >
                    $14,978.35
                  </p>
                  <div
                    class="flex items-center justify-end text-dark-grey text-12 nls-font-400 text-right m-0"
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
                  'grid gap-6  row-actions border-b border-standart px-6 py-3  items-center justify-between',
                  this.cols
                    ? 'grid-cols-' + this.cols
                    : 'grid-cols-3 md:grid-cols-4',
                ]"
              >
                <!-- Ticker -->
                <div class="inline-flex items-center">
                  <img
                    :src="require('@/assets/icons/coins/nls.svg')"
                    class="inline-block m-0 mr-4"
                    height="32"
                    width="32"
                  />
                  <div class="inline-block">
                    <p
                      class="text-primary nls-font-500 text-18 text-left uppercase m-0"
                    >
                      NLS
                    </p>
                    <p
                      class="text-dark-grey text-12 nls-font-400 text-left capitalize m-0"
                    >
                      $0.10000
                    </p>
                  </div>
                </div>

                <!-- Balance -->
                <div class="block info-show">
                  <p
                    class="text-primary nls-font-500 text-12 nls-font-500 text-right m-0"
                  >
                    $14,978.35
                  </p>
                  <div
                    class="flex items-center justify-end text-dark-grey text-12 nls-font-400 text-right m-0"
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
                  'grid gap-6  row-actions border-b border-b border-standart px-6 py-3  items-center justify-between',
                  this.cols
                    ? 'grid-cols-' + this.cols
                    : 'grid-cols-3 md:grid-cols-4',
                ]"
              >
                <!-- Ticker -->
                <div class="inline-flex items-center">
                  <img
                    :src="require('@/assets/icons/coins/atom.svg')"
                    class="inline-block m-0 mr-4"
                    height="32"
                    width="32"
                  />
                  <div class="inline-block">
                    <p
                      class="text-primary nls-font-500 text-18 text-left uppercase m-0"
                    >
                      ATOM
                    </p>
                    <p
                      class="text-dark-grey text-12 nls-font-400 text-left capitalize m-0"
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
                    class="text-primary text-16 nls-font-500 text-right m-0"
                  >
                    $14,978.35
                  </p>
                  <div
                    class="flex items-center justify-end text-dark-grey text-13 nls-font-400 text-right m-0"
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

      <div class="md:col-span-5 lg:co-span-5">
        <!-- Rewards -->
        <div
          class="nolus-box block order-2 md:order-1 bg-white border-y border-standart radius-medium md:col-span-7 mt-6"
        >
          <div
            class="flex items-center justify-between px-6 pt-6"
          >
            <h2 class="text-16 nls-font-500 text-left my-0">
              Pending rewards
            </h2>
            <button class="btn btn-label btn-large-label">
              Claim all
            </button>
          </div>
          <!-- Assets -->
          <div class="block mt-4">
            <!-- Assets Container -->
            <div class="block">
              <div
                :class="[
                  'grid gap-6 border-b border-t border-standart px-6 py-3  items-center justify-between',
                  this.cols
                    ? 'grid-cols-' + this.cols
                    : 'grid-cols-3 md:grid-cols-4',
                ]"
              >
                <!-- Ticker -->
                <div class="inline-flex items-center">
                  <img
                    :src="require('@/assets/icons/coins/btc.svg')"
                    class="inline-block m-0 mr-4"
                    height="32"
                    width="32"
                  />
                  <div class="inline-block">
                    <p
                      class="text-primary nls-font-500 text-18 text-left uppercase m-0"
                    >
                      BTC
                    </p>
                    <p
                      class="text-dark-grey text-12 nls-font-400 text-left capitalize m-0"
                    >
                      ~$5
                    </p>
                  </div>
                </div>

                <!-- Balance -->
                <div class="flex justify-end">
                  <button
                    class="btn btn-secondary btn-medium-secondary btn-emphatized"
                    data-v-37958d79=""
                  >
                    None
                  </button>
                </div>
              </div>
            </div>
            SidebarContainer
            <div class="block">
              <div
                :class="[
                  'grid gap-6 border-b border-standart px-6 py-3  items-center justify-between',
                  this.cols
                    ? 'grid-cols-' + this.cols
                    : 'grid-cols-3 md:grid-cols-4',
                ]"
              >
                <!-- Ticker -->
                <div class="inline-flex items-center">
                  <img
                    :src="require('@/assets/icons/coins/btc.svg')"
                    class="inline-block m-0 mr-4"
                    height="32"
                    width="32"
                  />
                  <div class="inline-block">
                    <p
                      class="text-primary nls-font-500 text-18 text-left uppercase m-0"
                    >
                      BTC
                    </p>
                    <p
                      class="text-dark-grey text-13 nls-font-400 text-left capitalize m-0"
                    >
                      ~$5
                    </p>
                  </div>
                </div>

                <!-- Balance -->
                <div class="flex justify-end">
                  <button
                    class="btn btn-secondary btn-medium-secondary btn-emphatized"
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
                  'grid gap-6 border-b border-standart  px-6 py-3 items-center justify-between',
                  this.cols
                    ? 'grid-cols-' + this.cols
                    : 'grid-cols-3 md:grid-cols-4',
                ]"
              >
                <!-- Ticker -->
                <div class="inline-flex items-center">
                  <img
                    :src="require('@/assets/icons/coins/btc.svg')"
                    class="inline-block m-0 mr-4"
                    height="32"
                    width="32"
                  />
                  <div class="inline-block">
                    <p
                      class="text-primary nls-font-500 text-18 text-left uppercase m-0"
                    >
                      BTC
                    </p>
                    <p
                      class="text-dark-grey text-13 nls-font-400 text-left capitalize m-0"
                    >
                      ~$5
                    </p>
                  </div>
                </div>

                <!-- Balance -->
                <div class="flex justify-end">
                  <button
                    class="btn btn-secondary btn-medium-secondary js-loading"
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

  <ReceiveSendModal
    v-if="showSendModal"
    ref="ReceiveSendModal"
    @close-modal="showSendModal = false"
  />
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'EarningsView',
  data () {
    return {
      cols: 2 as number
    }
  }
})
</script>
<style scoped></style>
