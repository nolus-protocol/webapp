<template>
  <button
    class="show-box-pop btn btn-header mr-2 c-navbar-qr__button"
    @click="togglePopup"
  >
    <span
      class="icon-bell mr-0"
      style="font-size: 1.5em; margin-right: 0"
    ></span>
    <span class="counter">8</span>
  </button>

  <div
    :class="notificationPopup ? 'active' : false"
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
          class="left w-full md:w-1/2 px-nolus-16 py-nolus-12 nls-font-500 nls-18"
        >
          <!--                <div class="loader">-->
          <!--                  <div class="loader__element"></div>-->
          <!--                </div>-->
          <p class="text nls-font-700 nls-18 m-0">Notifications</p>
        </div>
        <div
          class="right w-full md:w-1/2 mt-nolus-255 md:mt-0 inline-flex justify-start md:justify-end"
        >
          <div class="relative block checkbox-container">
            <div class="flex items-center w-full justify-end">
              <p
                class="text nls-font-500 nls-12 color-light-blue cursor-pointer"
              >
                Clear All
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
            <img
              :src="require('@/assets/icons/coins/btc.svg')"
              width="32"
              height="32"
              class="inline-block m-0 mr-4"
            />
            <div class="inline-block">
              <p
                class="text-primary nls-14 nls-font-700 text-left uppercase m-0"
              >
                BTC
              </p>
              <p class="text-dark-grey nls-12 text-left capitalize m-0">
                Bitcoin
              </p>
            </div>
          </div>

          <div class="hidden md:block">
            <div
              class="flex items-center justify-end text-primary nls-font-400 nls-12 text-right m-0"
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
              width="32"
              height="32"
              class="inline-block m-0 mr-4"
            />
            <div class="inline-block">
              <p
                class="text-primary nls-14 nls-font-700 text-left uppercase m-0"
              >
                BTC
              </p>
              <p class="text-dark-grey nls-12 text-left capitalize m-0">
                Bitcoin
              </p>
            </div>
          </div>

          <div class="hidden md:block">
            <div
              class="flex items-center justify-end text-primary nls-font-400 nls-12 text-right m-0"
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
              width="32"
              height="32"
              class="inline-block m-0 mr-4"
            />
            <div class="inline-block">
              <p
                class="text-primary nls-14 nls-font-700 text-left uppercase m-0"
              >
                NLS
              </p>
              <p class="text-dark-grey nls-12 text-left capitalize m-0">
                Nolus
              </p>
            </div>
          </div>

          <!-- Earnings -->
          <div class="hidden md:block">
            <div
              class="flex items-center justify-end text-primary nls-font-400 nls-12 text-right m-0"
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
import PickerDefault, {
  PickerDefaultOption,
} from "@/components/PickerDefault.vue";
import { defineComponent, PropType } from "vue";
import { EnvNetworks } from "@/config/envNetworks";
import { StringUtils } from "@/utils/StringUtils";
import { useStore } from "@/store";
import { ApplicationActionTypes } from "@/store/modules/application/action-types";

export default defineComponent({
  name: "Notifications",
  components: {
    PickerDefault,
  },
  data() {
    return {
      notificationPopup: false,
      // networks: [] as PickerDefaultOption[],
      // currentNetwork: {} as PickerDefaultOption,
    };
  },
  mounted() {
    const envNetwork = new EnvNetworks();
    // envNetwork.getEnvNetworks().forEach((network) => {
    //   (this.walletModel || {}).defaultOptions.push({
    //     label: StringUtils.capitalize(network),
    //     value: network,
    //   });
    // });
    console.log("curr: ", envNetwork.getStoredNetworkName());
    // (this.walletModel || {}).defaultOption = {
    //   label: StringUtils.capitalize(envNetwork.getStoredNetworkName() || ""),
    //   value: envNetwork.getStoredNetworkName() || "",
    // };
    //console.log((this.walletModel || {}).defaultOption);
  },
  methods: {
    togglePopup() {
      this.notificationPopup = !this.notificationPopup;
    },
    handleFocusOut() {
      alert("hi");
      this.notificationPopup = false;
    },
    onUpdateNetwork(value: PickerDefaultOption) {
      EnvNetworks.saveCurrentNetwork(value.value);
      useStore().dispatch(ApplicationActionTypes.CHANGE_NETWORK);
    },
  },
});
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
