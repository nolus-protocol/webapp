<template>
  <div
    class="background z-[101] mt-[52px] block h-full w-screen rounded-t-2xl border-border-color pb-[210px] pt-6 shadow-field-normal md:h-auto md:w-[516px] md:rounded-2xl md:border md:pb-10"
    @click.stop
  >
    <div class="flex flex-col items-center">
      <XMarkIcon class="radius-circle z-[5] h-14 w-14 bg-light-red/30 p-2 text-dark-red" />
      <h1 class="z-[5] mt-4 text-center text-28 font-semibold text-neutral-typography-200 md:text-32">
        {{ $t("message.session-timeout") }}
      </h1>
    </div>

    <div class="separator-line relative z-[5] py-6"></div>

    <div class="flex flex-col items-center">
      <p class="z-[5] px-4 text-center text-18 font-normal text-neutral-typography-200 md:px-10">
        {{ $t("message.session-timeout-message") }}
      </p>

      <div class="mt-6 hidden gap-2 md:flex">
        <button
          class="btn btn-primary btn-large-primary"
          @click="close()"
        >
          {{ $t("message.refresh") }}
        </button>
      </div>

      <div
        class="align-center background inset-x-0 bottom-0 mx-auto flex justify-center p-4 text-center md:relative md:hidden md:pt-7"
      >
        <button
          class="btn btn-primary btn-large-primary mr-4 w-40"
          @click="close()"
        >
          {{ $t("message.refresh") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { XMarkIcon } from "@heroicons/vue/24/solid";

defineProps({
  close: {
    type: Function,
    required: true
  }
});
</script>
