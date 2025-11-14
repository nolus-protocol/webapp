<template>
  <div class="flex items-center justify-between p-4 pb-2 text-14 font-semibold">
    {{ $t("message.filter-by-category") }}
    <SvgIcon
      class="cursor-pointer"
      name="close"
      size="xs"
      @click="onClose"
    />
  </div>
  <div class="px-4 pb-4">
    <Checkbox
      id="positions"
      :label="$t('message.filter-positions')"
      :value="false"
      class="mb-1"
    />
    <Checkbox
      id="transfers"
      :label="$t('message.filter-transfers')"
      :value="false"
      class="mb-1"
    />
    <Checkbox
      id="earn"
      :label="$t('message.filter-earn')"
      :value="false"
      class="mb-1"
    />
    <Checkbox
      id="staking"
      :label="$t('message.filter-staking')"
      :value="false"
      class="mb-1"
    />
  </div>
  <div class="flex justify-end border-t border-border-color p-3">
    <Button
      ref="popoverParent"
      :label="$t('message.apply-filter')"
      severity="secondary"
      size="small"
    />
  </div>
</template>

<script lang="ts" setup>
import { inject } from "vue";
import { Checkbox, SvgIcon, Button } from "web-components";
const onClose = inject("close", () => {});
</script>
