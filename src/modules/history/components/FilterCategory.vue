<template>
  <div class="flex items-center justify-between p-4 pb-2 text-14 font-semibold">
    {{ $t("message.filter-by-category") }}
    <SvgIcon
      class="cursor-pointer"
      name="close"
      size="xs"
      @click="onClose()"
    />
  </div>
  <form>
    <div class="px-4 pb-4">
      <Checkbox
        id="positions"
        :label="$t('message.filter-positions')"
        v-model="positions"
        class="mb-1"
        @input="() => {}"
      />
      <Checkbox
        id="transfers"
        :label="$t('message.filter-transfers')"
        v-model="transfers"
        class="mb-1"
        @input="() => {}"
      />
      <Checkbox
        id="earn"
        :label="$t('message.filter-earn')"
        v-model="earn"
        class="mb-1"
        @input="() => {}"
      />
      <Checkbox
        id="staking"
        :label="$t('message.filter-staking')"
        v-model="staking"
        class="mb-1"
        @input="() => {}"
      />
    </div>
    <div class="flex justify-end border-t border-border-color p-3">
      <Button
        ref="popoverParent"
        :label="$t('message.apply-filter')"
        severity="secondary"
        size="small"
        @click="onApply"
      />
    </div>
  </form>
</template>

<script lang="ts" setup>
import type { IObjectKeys } from "@/common/types";
import { inject, ref } from "vue";
import { Checkbox, SvgIcon, Button } from "web-components";
const onClose = inject("close", (filters?: IObjectKeys) => {});
const positions = ref(false);
const transfers = ref(false);
const earn = ref(false);
const staking = ref(false);

function onApply() {
  const filters: IObjectKeys = {};

  if (positions.value) {
    filters.positions = true;
  }

  if (transfers.value) {
    filters.transfers = true;
  }

  if (earn.value) {
    filters.earn = true;
  }

  if (staking.value) {
    filters.staking = true;
  }

  onClose(filters);
}
</script>
