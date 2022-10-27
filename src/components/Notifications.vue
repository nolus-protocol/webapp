<template>
  <div
    class="box-open background notify shadow-modal c-navbar-qr__container transition duration-3 ease-2"
  >
    <div
      class="nolus-box notification block nls-border shadow-box radius-medium radius-0-sm overflow-hidden"
    >
      <div class="flex notification-header justify-between background">
        <div class="left w-full md:w-1/2 nls-font-500 text-18">
          <p class="dark-text nls-font-700 text-18 m-0">
            {{ $t("message.notifications") }}
          </p>
        </div>

        <div class="flex items-center w-full justify-end">
          <p class="text nls-font-500 text-12 color-light-blue cursor-pointer">
            {{ $t("message.clear-all") }}
          </p>
        </div>
      </div>

      <!-- Assets -->
      <div class="block">
        <div
          class="flex read border-b border-t nls-border py-4 px-4 items-center justify-between"
        >
        <div class="inline-flex items-center">
            <img
              src="/src/assets/icons/coins/btc.svg"
              class="inline-block m-0 mr-4"
              height="32"
              width="32"
            />

            <div class="inline-block">
              <p class="text-primary text-14 nls-font-500 text-left m-0">
                You've got BTC rewards
              </p>
              <p class="text-dark-grey text-12 text-left capitalize m-0">
                ~$5 (0.000000324 BTC)
              </p>
            </div>
          </div>

          <div class="block">
            <div
              class="flex items-center justify-end text-primary nls-font-700 text-12 text-right m-0"
            >
              <button class="btn-outline btn-large-outline">Claim</button>
            </div>
          </div>
        </div>

        <div
          class="flex read border-b border-t nls-border py-4 px-4 items-center justify-between"
        >
          <div class="inline-flex items-center">
            <img
              src="/src/assets/icons/coins/btc.svg"
              class="inline-block m-0 mr-4"
              height="32"
              width="32"
            />

            <div class="inline-block">
              <p class="text-primary text-14 nls-font-500 text-left m-0">
                You've got BTC rewards
              </p>
              <p class="text-dark-grey text-12 text-left capitalize m-0">
                ~$5 (0.000000324 BTC)
              </p>
            </div>
          </div>

          <div class="block">
            <div
              class="flex items-center justify-end text-primary nls-font-700 text-12 text-right m-0"
            >
              <button class="btn-outline btn-large-outline">Claim</button>
            </div>
          </div>
        </div>

        <div
          class="flex read border-b border-t nls-border py-4 px-4 items-center justify-between"
        >
          <div class="inline-flex items-center">
            <img
              src="/src/assets/icons/coins/nls.svg"
              class="inline-block m-0 mr-4"
              height="32"
              width="32"
            />

            <div class="inline-block">
              <p class="text-primary text-14 nls-font-700 text-left m-0">
                NLS claim approved
              </p>
              <p class="text-dark-grey text-12 text-left m-0">
                (~$5) 43.213 NLS
              </p>
            </div>
          </div>

          <!-- Earnings -->
          <div class="block">
            <div
              class="flex items-center justify-end text-primary nls-font-700 text-12 text-right m-0"
            >
              <button class="btn-outline btn-large-outline">Withdraw</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Assets Container -->
    </div>
  </div>
</template>
<script setup lang="ts"></script>
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
