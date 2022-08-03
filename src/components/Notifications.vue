<template>
  <div
    class="box-open bg-white notify shadow-modal c-navbar-qr__container transition duration-3 ease-2"
  >
    <!-- Notifications Body -->

    <div
      class="nolus-box notification block border-standart shadow-box radius-medium radius-0-sm overflow-hidden"
    >
      <!-- Top -->
      <div
        class="flex notification-header flex-wrap items-baseline justify-between px-6 bg-white"
      >
        <div
          class="left w-full md:w-1/2 px-4 py-3 nls-font-500 text-18"
        >
          <p class="text nls-font-700 text-18 m-0">{{ $t('message.notifications') }}</p>
        </div>
        <div
          class="right w-full md:w-1/2 mt-[25px] md:mt-0 inline-flex justify-start md:justify-end"
        >
          <div class="relative block checkbox-container">
            <div class="flex items-center w-full justify-end">
              <p
                class="text nls-font-500 text-12 color-light-blue cursor-pointer"
              >
                {{ $t('message.clear-all') }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Assets -->

      <!-- Assets Container -->
      <div class="block bg-white">
        <div
          class="flex read border-b border-t border-standart py-4 px-6 items-center justify-between"
        >
          <!-- Ticker -->
          <div class="inline-flex items-center">
            <!-- <imgtogglePopup class="inline-block m-0 mr-4" height="32"/> -->
            <div class="inline-block">
              <p
                class="text-primary text-14 nls-font-700 text-left uppercase m-0"
              >
                BTC
              </p>
              <p class="text-dark-grey text-12 text-left capitalize m-0">
                Bitcoin
              </p>
            </div>
          </div>

          <div class="hidden md:block">
            <div
              class="flex items-center justify-end text-primary nls-font-400 text-12 text-right m-0"
            >
              <button class="btn btn-outline btn-large-outline">Claim</button>
            </div>
          </div>
        </div>

        <div
          class="flex read border-b border-standart py-4 bg-white px-6 items-center justify-between"
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
                class="text-primary text-14 nls-font-700 text-left uppercase m-0"
              >
                BTC
              </p>
              <p class="text-dark-grey text-12 text-left capitalize m-0">
                Bitcoin
              </p>
            </div>
          </div>

          <div class="hidden md:block">
            <div
              class="flex items-center justify-end text-primary nls-font-400 text-12 text-right m-0"
            >
              <button class="btn btn-outline btn-large-outline">Claim</button>
            </div>
          </div>
        </div>

        <div
          class="unread flex block border-b border-standart py-4 px-6 items-center justify-between"
        >
          <div class="inline-flex items-center">
            <img
              :src="require('@/assets/icons/coins/nls.svg')"
              class="inline-block m-0 mr-4"
              height="32"
              width="32"
            />
            <div class="inline-block">
              <p
                class="text-primary text-14 nls-font-700 text-left uppercase m-0"
              >
                NLS
              </p>
              <p class="text-dark-grey text-12 text-left capitalize m-0">
                Nolus
              </p>
            </div>
          </div>

          <!-- Earnings -->
          <div class="hidden md:block">
            <div
              class="flex items-center justify-end text-primary nls-font-400 text-12 text-right m-0"
            >
              <button class="btn btn-outline btn-large-outline">
                Withdraw
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Assets Container -->
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'Notifications',
  props: ['isActive'],
  data () {
    return {
      notificationPopup: false
    }
  },
  mounted () {
  },
  methods: {
    togglePopup () {
      this.notificationPopup = !this.notificationPopup
    },
    handleFocusOut () {
      this.notificationPopup = false
    }
  }
})
</script>
<style scoped>
.icon-wallet {
  font-size: 2em !important;
  margin-right: 0 !important;
}

.bg-light-grey {
  background: #f7f9fc;
  padding: 14px 11px;
  margin-top: 11px;
}

.justify-content {
  justify-content: space-between !important;
}
</style>
