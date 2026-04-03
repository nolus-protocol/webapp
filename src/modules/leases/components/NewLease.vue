<template>
  <div class="flex flex-1 flex-col justify-between gap-y-2 border-b border-border-color pb-3 lg:flex-row lg:gap-0">
    <div class="flex items-center gap-2">
      <Button
        icon="arrow-left"
        @click="goBack"
        severity="tertiary"
        size="large"
        class="cursor-pointer text-icon-default px-4!"
      />
      <div class="flex flex-col">
        <div class="text-24 font-semibold text-typography-default">{{ $t("message.new-lease") }}</div>
        <div class="text-14 text-typography-default">
          {{ $t("message.type") }}: <span class="font-semibold">{{ $t(`message.${route.meta.action}`) }}</span>
        </div>
      </div>
    </div>
  </div>
  <div class="flex flex-col gap-8 md:flex-row">
    <router-view />
  </div>
</template>

<script lang="ts" setup>
import { Button } from "web-components";
import { RouteNames } from "@/router";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

function goBack() {
  router.push({ path: `/${RouteNames.LEASES}` });
}
</script>
