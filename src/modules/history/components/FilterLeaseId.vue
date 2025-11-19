<template>
  <div class="flex items-center justify-between p-4 pb-2 text-14 font-semibold">
    {{ $t("message.filter-by-lease") }}
    <SvgIcon
      class="cursor-pointer"
      name="close"
      size="xs"
      @click="onClose()"
    />
  </div>

  <div class="mx-2">
    <Input
      id="dropdown-search"
      class="flex-1"
      type="search"
      :size="Size.small"
      v-model="search"
      @on-search-clear="search = ''"
      @input.stop="(e) => (search = (e.target as HTMLInputElement).value)"
    />
  </div>

  <div
    ref="listContainer"
    class="mt-2 max-h-64 overflow-auto border-t border-border-color bg-neutral-bg-1 pb-4"
  >
    <span class="mb-4 block w-full border-b border-border-color py-2 pl-2 text-12">
      {{ $t("message.lease") }}
    </span>

    <div
      v-for="item in positions"
      :key="item.contract"
      class="mb-1 px-2"
    >
      <Checkbox
        class="py-1 text-16 font-normal text-typography-default text-typography-link"
        :id="item.contract"
        :label="item.label"
        v-model="item.checked"
      />
    </div>

    <div
      ref="loadMoreRef"
      class="text-typography-subtle py-2 text-center text-12"
    >
      <span v-if="loading">{{ $t("message.loading") }}...</span>
      <span v-else-if="loaded">{{ $t("message.no-more-items") }}</span>
      <span v-else>{{ $t("message.scroll-to-load-more") }}</span>
    </div>
  </div>

  <div class="flex justify-end border-t border-border-color p-3">
    <Button
      ref="popoverParent"
      :label="`${$t('message.apply-filter')}${selectedPositions.length > 0 ? `(${selectedPositions.length})` : ''}`"
      severity="secondary"
      size="small"
      @click="onApply"
    />
  </div>
</template>

<script lang="ts" setup>
import { useWalletStore } from "@/common/stores/wallet";
import type { IObjectKeys } from "@/common/types";
import { EtlApi } from "@/common/utils";
import { inject, ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
import { Checkbox, SvgIcon, Button, Input, Size } from "web-components";

const onClose = inject("close", (filters?: IObjectKeys) => {});

const search = ref("");
interface PositionItem {
  contract: string;
  label: string;
  checked: boolean;
}

let timer: NodeJS.Timeout;
let skip = 0;
const positions = ref<PositionItem[]>([]);
const limit = 50;
const loading = ref(false);
const loaded = ref(false);
const wallet = useWalletStore();
const selectedPositions = computed(() => positions.value.filter((p) => p.checked).map((p) => p.contract));

const listContainer = ref<HTMLElement | null>(null);
const loadMoreRef = ref<HTMLElement | null>(null);
const throtthle = 400;

let observer: IntersectionObserver | null = null;

async function fetchPositions(): Promise<PositionItem[]> {
  return EtlApi.fetch_search_leases(wallet.wallet?.address, skip, limit, search.value).then((data) => {
    const items: PositionItem[] = data.map((item) => {
      return {
        contract: item,
        label: `#${item.slice(-8)}`,
        checked: false
      };
    });

    return items;
  });
}

async function loadMore() {
  if (loading.value || loaded.value) return;

  loading.value = true;
  try {
    const res = await fetchPositions();
    skip += limit;
    positions.value.push(...res);
    const isLoaded = res.length < limit;
    if (isLoaded) {
      loaded.value = true;
    }
  } finally {
    loading.value = false;
  }
}

function setupObserver() {
  if (!loadMoreRef.value || observer) return;

  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        loadMore();
      }
    },
    {
      root: listContainer.value ?? null,
      rootMargin: "0px",
      threshold: 0.1
    }
  );

  observer.observe(loadMoreRef.value);
}

function cleanupObserver() {
  if (observer && loadMoreRef.value) {
    observer.unobserve(loadMoreRef.value);
    observer.disconnect();
  }
  observer = null;
}

onMounted(async () => {
  await loadMore();
  setupObserver();
});

onBeforeUnmount(() => {
  cleanupObserver();
});

watch(
  () => search.value,
  async () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      skip = 0;
      positions.value = [];
      loaded.value = false;
      await loadMore();
    }, throtthle);
  }
);

function onApply() {
  if (selectedPositions.value.length > 0) {
    return onClose({
      positions_ids: selectedPositions.value.map((item) => item)
    });
  }

  onClose({});
}
</script>
