<template>
  <!-- Header -->
  <div class="flex modal-send-receive-header no-border">
    <div class="navigation-header wrap">
      <h1 class="nls-font-700 nls-32 text-center text-primary w-full mt-3">
        Pending
      </h1>
    </div>
  </div>

  <!-- Input Area -->
  <div class="modal-send-receive-input-area pt-0">
    <div class="block bg-light-grey radius-rounded p-4 text-left break-words">
      <div class="block">
        <p class="nls-14 nls-font-400 text-primary m-0">Send to:</p>
        <!-- <p class="nls-14 nls-font-400 text-primary nls-font-700 m-0">{{ currentComponent.receiverAddress }}</p> -->
        <p class="nls-14 text-primary nls-font-700 m-0">
          0x3371e0F5bF7c5DD1d9A7eF8366E633283759951a
        </p>
      </div>

      <div class="block mt-3">
        <p class="nls-14 nls-font-400 text-primary m-0">Memo:</p>
        <!-- <p class="nls-14 nls-font-400 text-primary nls-font-700 m-0"> {{ currentComponent.memo }}</p> -->
        <p class="nls-14 text-primary nls-font-700 m-0">emey95ya</p>
      </div>

      <div class="block mt-3">
        <p class="nls-14 nls-font-400 text-primary m-0">Amount:</p>
        <p class="nls-14 text-primary nls-font-700 m-0">
          <!-- {{ formatAmount(currentComponent.amount) }} -->
          1.023994 NLS
        </p>
      </div>

      <div class="block mt-3">
        <p class="nls-14 nls-font-400 text-primary m-0">Tx Id:</p>
        <p class="nls-14 text-primary nls-font-700 m-0">
          <!-- {{ currentComponent.txHash }} -->
          C1FAC987E9515B…63BE5162B4A00310244A
        </p>
        <button class="btn btn-secondary btn-medium-secondary btn-icon mt-2">
          <DuplicateIcon class="icon w-4 h-4" />
          Copy
        </button>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary js-loading"
      data-v-37958d79=""
    >
      Buy Tokens
    </button>
  </div>
</template>

<script lang="ts">
import { CheckIcon, DuplicateIcon } from "@heroicons/vue/solid";
import { defineComponent, PropType } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { SendComponentProps } from "./SendComponent.vue";

export default defineComponent({
  name: "SendingPendingComponent",
  components: {
    CheckIcon,
    DuplicateIcon,
  },
  props: {
    modelValue: {
      type: Object as PropType<SendComponentProps>,
    },
  },
  methods: {
    formatAmount(value: string) {
      const amountInUNls = CurrencyUtils.convertNolusToUNolus(value);
      return CurrencyUtils.convertUNolusToNolus(amountInUNls.amount.toString());
    },
  },
});
</script>
