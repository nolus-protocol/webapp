<template>
  <div class="flex flex-col gap-8">
    <ListHeader :title="$t('message.protocol-stats')" />
    <div class="flex flex-col gap-8">
      <Overview />
      <LoansProvided />
      <ProtocolUtilization />
    </div>
  </div>
</template>

<style lang="scss"></style>

<script lang="ts" setup>
import ListHeader from "@/common/components/ListHeader.vue";
import ProtocolUtilization from "@/modules/stats/components/ProtocolUtilization.vue";
import LoansProvided from "@/modules/stats/components/LoansProvided.vue";
import Overview from "@/modules/stats/components/Overview.vue";
</script>
