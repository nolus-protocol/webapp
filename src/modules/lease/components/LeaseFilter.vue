<template>
  <div class="left w-full md:w-1/2">
    <div
      v-if="leasesData.length >= sortFailure"
      class="sort disable mt-4 inline-flex w-full items-center justify-between gap-8 border-[1px] border-border-color bg-neutral-bg-50 p-3 px-[18px] shadow-field-normal md:mt-0 md:w-auto lg:mt-0 lg:w-auto lg:rounded-lg"
    >
      <span class="icon icon-sort !text-14"></span>

      <button
        class="flex gap-2"
        @click="setSort(Sort.date)"
      >
        <span class="text-14 font-medium uppercase text-neutral-typography-200">{{ $t("message.date") }}</span>
        <div class="flex flex-col">
          <span
            :class="getSortClass(Sort.date, SortType.asc)"
            class="icon icon-arrow-up-sort !text-[6px] text-neutral-400"
          >
          </span>
          <span
            :class="getSortClass(Sort.date, SortType.desc)"
            class="icon icon-arrow-down-sort !text-[6px] text-neutral-400"
          >
          </span>
        </div>
      </button>

      <button
        class="flex gap-2"
        @click="setSort(Sort.size)"
      >
        <span class="text-14 font-medium uppercase text-neutral-typography-200">{{ $t("message.size") }}</span>
        <div class="flex flex-col">
          <span
            :class="getSortClass(Sort.size, SortType.asc)"
            class="icon icon-arrow-up-sort !text-[6px] text-neutral-400"
          >
          </span>
          <span
            :class="getSortClass(Sort.size, SortType.desc)"
            class="icon icon-arrow-down-sort !text-[6px] text-neutral-400"
          >
          </span>
        </div>
      </button>

      <button
        class="flex gap-2"
        @click="setSort(Sort.pnl)"
      >
        <span class="text-14 font-medium uppercase text-neutral-typography-200">{{ $t("message.pnl") }}</span>
        <div class="flex flex-col">
          <span
            :class="getSortClass(Sort.pnl, SortType.asc)"
            class="icon icon-arrow-up-sort !text-[6px] text-neutral-400"
          >
          </span>
          <span
            :class="getSortClass(Sort.pnl, SortType.desc)"
            class="icon icon-arrow-down-sort !text-[6px] text-neutral-400"
          >
          </span>
        </div>
      </button>
    </div>
    <template v-else>
      <h1 class="m-0 ml-[14px] mt-4 text-20 font-semibold text-neutral-typography-200 lg:ml-[0px] lg:mt-0">
        {{ $t("message.leases") }}
      </h1>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { Sort, SortType } from "@/modules/lease/types";
import type { PropType } from "vue";

const props = defineProps({
  leasesData: {
    type: Object as PropType<any>,
    required: true
  },
  sortType: {
    type: Object as PropType<{ sort: Sort; type: SortType }>,
    required: true
  },
  sortFailure: {
    type: Number,
    required: false,
    default: 3
  },
  setSort: {
    type: Function as PropType<(sort: Sort) => void>,
    required: true
  }
});

const getSortClass = (sort: Sort, type: SortType) => {
  return props.sortType.sort == sort && props.sortType.type == type ? "!text-[#2868e1]" : "";
};
</script>

<style lang="" scoped></style>
