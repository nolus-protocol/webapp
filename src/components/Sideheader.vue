<template>
  <div id="notifications-nls">
    <button
      class="show-box-pop btn btn-header mr-2 c-navbar-qr__button"
      @click="this.showNotifications = !this.showNotifications"
    >
      <span
        class="icon-bell mr-0"
        style="font-size: 1.5em; margin-right: 0"
      ></span>
      <span class="counter">8</span>
    </button>

    <Notifications v-show="this.showNotifications" />
  </div>
  <div id="wallet-nls">
    <button
      class="show-box-wallet btn btn-header with-icon shadow-box rounded-r-none"
      @click="this.showWallet = !this.showWallet"
    >
      <span
        class="icon-wallet mr-0"
        style="font-size: 1.5em !important; margin-right: 0"
      ></span>

      <span class="nls-13 nls-font-400 text-primary">My precious</span>
    </button>

    <!-- <Notifications /> -->
    <WalletOpen v-show="this.showWallet" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import Notifications from "@/components/Notifications.vue";
import WalletOpen from "@/components/WalletOpen.vue";
export default defineComponent({
  name: "SidebarHeader",
  components: {
    Notifications,
    WalletOpen,
  },
  data() {
    return {
      showWallet: false,
      showNotifications: false,
    };
  },

  watch: {
    showWallet() {
      document.addEventListener("click", (event) => {
        if (
          //@ts-ignore
          event.target.closest("#wallet-nls")
        )
          return;
        this.showWallet = false;
      });
    },
    showNotifications() {
      document.addEventListener("click", (event) => {
        if (
          //@ts-ignore
          event.target.closest("#notifications-nls")
        ) {
          return;
        }

        this.showNotifications = false;
      });
    },
  },
});
</script>
