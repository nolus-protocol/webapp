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
  <form>
    <div class="px-4 pb-4">
      <Checkbox
        id="positions"
        :label="$t('message.filter-positions')"
        v-model="model"
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
      />
    </div>
  </form>
</template>

<script lang="ts" setup>
import { inject, ref } from "vue";
import { Checkbox, SvgIcon, Button } from "web-components";
const onClose = inject("close", () => {});
const model = ref(false);
</script>
