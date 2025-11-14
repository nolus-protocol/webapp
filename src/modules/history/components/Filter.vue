<template>
  <div class="mb-4">
    <Button
      ref="popoverParent"
      :label="$t('message.add-filter')"
      severity="badge"
      size="small"
      icon="plus"
      icon-position="left"
      @click="isOpen = !isOpen"
    />
  </div>
  <Popover
    v-if="isOpen"
    position="bottom-left"
    :parent="popoverParent"
    @close="onClose"
    class="max-w-[220px]"
  >
    <template #content>
      <template v-if="template == Templates.default">
        <button
          class="button-secondary w-full border-none px-3 py-3 text-left"
          @click="template = Templates.category"
        >
          {{ $t("message.filter-category") }}
        </button>
        <button
          class="button-secondary w-full border-none px-3 py-3 text-left"
          @click="template = Templates.lease"
        >
          {{ $t("message.filter-lease-id") }}
        </button>
      </template>

      <template v-if="template == Templates.category"> <FilterCategory /> </template>

      <template v-if="template == Templates.lease"> <FilterLeaseId /></template>
    </template>
  </Popover>
</template>

<script lang="ts" setup>
import { Button, Popover } from "web-components";
import { provide, ref } from "vue";
import FilterCategory from "./FilterCategory.vue";
import FilterLeaseId from "./FilterLeaseId.vue";

enum Templates {
  default,
  category,
  lease
}

const template = ref(Templates.default);
const popoverParent = ref();
const isOpen = ref(false);
provide("close", onClose);

function onClose() {
  isOpen.value = !isOpen.value;
  template.value = Templates.default;
}
</script>
