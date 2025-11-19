<template>
  <div class="mb-4">
    <div ref="popoverParent">
      <Button
        v-if="hasFilters"
        :label="$t('message.clear-filter')"
        severity="badge"
        size="small"
        icon="close"
        icon-position="left"
        @click="trigger"
      />
      <template v-else>
        <Button
          :label="$t('message.add-filter')"
          severity="badge"
          size="small"
          icon="plus"
          icon-position="left"
          @click="trigger"
        />
      </template>
    </div>
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
import type { IObjectKeys } from "@/common/types";

enum Templates {
  default,
  category,
  lease
}

const template = ref(Templates.default);
const popoverParent = ref();
const isOpen = ref(false);
const emitter = defineEmits(["onFilter"]);
const hasFilters = ref(false);

provide("close", onClose);

function trigger() {
  template.value = Templates.default;

  if (hasFilters.value) {
    hasFilters.value = false;
    emitter("onFilter", {});
    return;
  }

  isOpen.value = !isOpen.value;
}

function onClose(filters: IObjectKeys) {
  isOpen.value = !isOpen.value;
  template.value = Templates.default;

  if (filters) {
    hasFilters.value = true;
    emitter("onFilter", filters);
  }
}
</script>
