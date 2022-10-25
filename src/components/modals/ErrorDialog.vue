<template>
  <div
    class="block rounded-2xl background md:pb-10 pt-6 pb-[210px] mt-[52px] md:border border-standart shadow-box w-screen md:w-[516px]"
    @click.stop
  >
    <div class="flex flex-col items-center">
      <XMarkIcon
        class="h-14 w-14 bg-light-red/30 radius-circle p-2 text-dark-red z-[5]"
      />
      <h1 class="nls-font-700 text-28 md:text-32 text-primary text-center mt-4 z-[5]">
        {{ title }}
      </h1>
    </div>

    <div class="separator-line py-6 relative z-[5]"></div>

    <div class="flex flex-col items-center">
      <p class="text-18 text-primary text-center nls-font-400 z-[5] px-4 md:px-10">
        {{ message }}
      </p>

      <div class="gap-2 mt-6 flex">
        <button
          class="btn btn-primary btn-large-primary"
          @click="
            tryButton();
            parseRoute();
          "
        >
          {{ $t("message.try-again") }}
        </button>

        <button
          class="btn btn-secondary btn-large-secondary"
          @click="onModalClose()"
        >
          {{ $t("message.cancel") }}
        </button>
        <div class="background h-[600px] absolute inset-x-0 z-[0] md:hidden"></div>
      </div>

      <div class="background h-[430px] absolute inset-x-0 bottom-0 z-[0] md:hidden"></div>
      <div class="md:hidden flex align-center justify-center md:pt-7 p-4 text-center mx-auto background absolute inset-x-0 bottom-0 md:relative shadow-modal">
        <button
          class="btn btn-primary btn-large-primary mr-4 w-40"
          @click="
            tryButton();
            parseRoute();
          "
        >
          {{ $t("message.try-again") }}
        </button>

        <button
          class="btn btn-secondary btn-large-secondary w-40"
          @click="onModalClose()"
        >
          {{ $t("message.cancel") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/solid';
import { inject } from 'vue';

const onModalClose: Function = inject('onModalClose', () => {});
const parseRoute: Function = inject('parseRoute', () => {});

defineProps({
  title: {
    type: String,
  },
  message: {
    type: String,
  },
  tryButton: {
    type: Function,
    required: true,
  },
});
</script>
