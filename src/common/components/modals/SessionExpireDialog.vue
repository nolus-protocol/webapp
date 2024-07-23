<template>
  <div
    class="mx-auto mt-[62px] flex w-full max-w-[516px] flex-col rounded-xl bg-neutral-bg-50 px-10 py-6 text-center"
    @click.stop
  >
    <div class="flex flex-col items-center gap-6">
      <XMarkIcon class="h-16 w-16 rounded-full bg-danger-50 p-2 text-danger-100" />
      <h1
        class="block w-full text-center text-28 font-semibold leading-7 text-neutral-typography-200 md:text-32 md:leading-8"
      >
        {{ $t("message.session-timeout") }}
      </h1>
    </div>

    <div class="separator-line relative z-[5] py-6"></div>

    <div class="flex flex-col items-center gap-8">
      <p
        class="z-[5] w-full rounded-lg bg-dialogs-swap-color p-4 text-center text-14 font-normal text-neutral-typography-200"
      >
        {{ $t("message.session-timeout-message") }}
      </p>

      <Button
        :label="$t('message.refresh')"
        class="w-full"
        severity="primary"
        size="large"
        @click="close()"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { XMarkIcon } from "@heroicons/vue/24/solid";
import { Button } from "web-components";

defineProps({
  close: {
    type: Function,
    required: true
  }
});
</script>
