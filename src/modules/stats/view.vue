<template>
  <div class="col-span-12">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between px-4 lg:px-0 lg:pt-[25px]">
      <div class="left w-full md:w-1/2">
        <h1 class="text-20 text-neutral-typography-200 m-0 mb-[11.5px] mt-[26px] font-semibold">
          {{ $t("message.stats") }}
        </h1>
      </div>
    </div>

    <TotalValueLocked />
    <ProtocolUtilization />
    <LoansProvided />
  </div>
</template>

<style lang="scss"></style>

<script lang="ts" setup>
import TotalValueLocked from "@/modules/stats/components/TotalValueLocked.vue";
import ProtocolUtilization from "@/modules/stats/components/ProtocolUtilization.vue";
import LoansProvided from "@/modules/stats/components/LoansProvided.vue";
</script>
