<template>
  <div
    class="z-[101] mt-[52px] block h-full w-screen rounded-t-2xl border-border-color bg-neutral-bg-50 pb-[210px] pt-6 shadow-field-normal md:h-auto md:w-[516px] md:rounded-2xl md:border md:pb-10"
    @click.stop
  >
    <div class="flex flex-col items-center">
      <XMarkIcon class="radius-circle z-[5] h-14 w-14 bg-light-red/30 p-2 text-dark-red" />
      <h1 class="z-[5] mt-4 text-center text-28 font-semibold text-neutral-typography-200 md:text-32">
        {{ title }}
      </h1>
    </div>

    <hr class="my-6 border-border-color" />

    <div class="flex flex-col items-center">
      <p class="z-[5] px-4 text-center text-18 font-normal text-neutral-typography-200 md:px-10">
        {{ message }}
      </p>

      <div class="mt-6 hidden gap-2 md:flex">
        <Button
          :label="$t('message.try-again')"
          severity="primary"
          size="large"
          @click="
            tryButton();
            parseRoute();
          "
        />

        <Button
          :label="$t('message.cancel')"
          severity="secondary"
          size="large"
          @click="onModalClose()"
        />
      </div>

      <div
        class="align-center inset-x-0 bottom-0 mx-auto flex justify-center gap-3 bg-neutral-bg-50 p-4 text-center md:relative md:hidden md:pt-7"
      >
        <Button
          :label="$t('message.try-again')"
          class="w-40"
          severity="primary"
          size="large"
          @click="
            tryButton();
            parseRoute();
          "
        />

        <Button
          :label="$t('message.cancel')"
          class="w-40"
          severity="secondary"
          size="large"
          @click="onModalClose()"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { XMarkIcon } from "@heroicons/vue/24/solid";
import { inject } from "vue";
import { Button } from "web-components";

const onModalClose: Function = inject("onModalClose", () => {});
const parseRoute: Function = inject("parseRoute", () => {});

defineProps({
  title: {
    type: String
  },
  message: {
    type: String
  },
  tryButton: {
    type: Function,
    required: true
  }
});
</script>
