<template>
  <h1 class="text-to-big-number text-primary text-center relative">
    <button
      type="button"
      v-on:click="clickBack"
      class="inline-block align-baseline absolute left-0 top-2/4 -mt-2.5"
    >
      <ArrowLeftIcon class="h-5 w-5" aria-hidden="true" />
    </button>
    <span class="inline-block align-baseline"> Connecting to Kepler </span>
  </h1>

  <div
    class="block rounded-2xl bg-white mt-8 p-10 border border-standart shadow-box"
  >
    <p class="nls-14 nls-font-400 text-primary">
      Continue by approving the connection in the extension
    </p>
    <div class="flex mt-6">
      <button class="btn btn-primary btn-large-primary mr-4 js-loading">
        Connecting to Kepler
      </button>

      <button
        v-on:click="clickBack"
        class="btn btn-secondary btn-large-secondary"
      >
        Cancel
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { ArrowLeftIcon } from "@heroicons/vue/solid";
import router from "@/router";
import { useStore } from "@/store";
import { WalletActionTypes } from "@/store/modules/wallet/action-types";

export default defineComponent({
  name: "ConnectingKeplr",
  components: {
    ArrowLeftIcon,
  },
  data() {
    return {
      showModal: false,
    };
  },
  methods: {
    clickBack: () => {
      router.go(-1);
    },
  },
  mounted() {
    useStore().dispatch(WalletActionTypes.CONNECT_KEPLR, { isFromAuth: true });
  },
});
</script>
