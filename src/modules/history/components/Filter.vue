<template>
  <div class="mb-4">
    <div class="flex gap-4">
      <Label
        variant="secondary"
        v-if="categoryFilters.length > 0"
      >
        <span class="font-normal">{{ $t("message.filter-category") }}:</span>
        <span class="ml-1 font-medium">{{ categoryFilters }}</span>

        <SvgIcon
          class="ml-1 cursor-pointer"
          name="close"
          size="xs"
          @click="clear"
        />
      </Label>

      <Label
        variant="secondary"
        v-if="leaseFilters.length > 0"
      >
        <span class="font-normal">{{ $t("message.position-id") }}:</span>
        <span class="ml-1 font-medium">{{ leaseFilters }}</span>

        <SvgIcon
          class="ml-1 cursor-pointer"
          name="close"
          size="xs"
          @click="clear"
        />
      </Label>

      <Button
        ref="popoverParent"
        :label="$t('message.add-filter')"
        severity="badge"
        size="small"
        icon="plus"
        icon-position="left"
        @click="trigger"
      />
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
import { Button, Popover, Label, SvgIcon } from "web-components";
import { computed, provide, ref } from "vue";
import FilterCategory from "./FilterCategory.vue";
import FilterLeaseId from "./FilterLeaseId.vue";
import type { IObjectKeys } from "@/common/types";
import { useI18n } from "vue-i18n";

enum Templates {
  default,
  category,
  lease
}

const template = ref(Templates.default);
const popoverParent = ref();
const isOpen = ref(false);
const emitter = defineEmits(["onFilter"]);
const appliedFilters = ref();
const i18n = useI18n();

provide("close", onClose);

const categoryFilters = computed(() => {
  const categories = ["positions", "transfers", "earn", "staking"];
  return categories
    .filter((item) => {
      if (appliedFilters.value?.[item]) {
        return true;
      }
      return false;
    })
    .map((item) => i18n.t(`message.filter-${item}`))
    .join(", ");
});

const leaseFilters = computed(() => {
  const leases: string[] = appliedFilters.value?.positions_ids ?? [];
  return leases.map((item) => `#${item.slice(-6)}`).join(", ");
});

function trigger() {
  template.value = Templates.default;

  isOpen.value = !isOpen.value;
}

function clear() {
  emitter("onFilter", {});
  appliedFilters.value = {};
}

function onClose(filters: IObjectKeys) {
  isOpen.value = !isOpen.value;
  template.value = Templates.default;
  appliedFilters.value = filters;
  if (filters) {
    emitter("onFilter", filters);
  }
}
</script>
