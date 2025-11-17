<template>
  <div class="flex items-center justify-between p-4 pb-2 text-14 font-semibold">
    {{ $t("message.filter-by-lease") }}
    <SvgIcon
      class="cursor-pointer"
      name="close"
      size="xs"
      @click="onClose"
    />
  </div>

  <Input
    id="dropdown-search"
    class="flex-1"
    type="search"
    v-model="search"
    @input.stop="(e) => (search = (e.target as HTMLInputElement).value)"
  />

  <div
    ref="listContainer"
    class="max-h-64 overflow-auto px-4 pb-4"
  >
    <div
      v-for="item in positions"
      :key="item.id"
      class="mb-1"
    >
      <Checkbox
        :id="`position-${item.id}`"
        :label="item.label"
        v-model="item.checked"
      />
    </div>

    <div
      ref="loadMoreRef"
      class="text-typography-subtle py-2 text-center text-12"
    >
      <span v-if="isLoading">{{ $t("message.loading") }}</span>
      <span v-else-if="!hasMore">{{ $t("message.no-more-items") }}</span>
      <span v-else>{{ $t("message.scroll-to-load-more") }}</span>
    </div>
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
import { inject, ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
import { Checkbox, SvgIcon, Button, Input } from "web-components";

const onClose = inject("close", () => {});

const search = ref("");

// list state
interface PositionItem {
  id: number | string;
  label: string;
  checked: boolean;
}

const positions = ref<PositionItem[]>([]);
const page = ref(0);
const pageSize = 20;
const isLoading = ref(false);
const hasMore = ref(true);

// refs for infinite scroll
const listContainer = ref<HTMLElement | null>(null);
const loadMoreRef = ref<HTMLElement | null>(null);

let observer: IntersectionObserver | null = null;

// fake API loader – replace with your real API call
async function fetchPositions(page: number, pageSize: number, searchTerm: string) {
  // TODO: use your real API here
  // This is just a demo that generates data
  return new Promise<{ data: PositionItem[]; hasMore: boolean }>((resolve) => {
    setTimeout(() => {
      const start = page * pageSize;
      const end = start + pageSize;
      const total = 200; // imagine 200 positions

      const rawItems = Array.from({ length: Math.max(0, Math.min(end, total) - start) }, (_, i) => {
        const id = start + i;
        return {
          id,
          label: `Position #${id}`,
          checked: false
        };
      });

      // simple client-side search filter (optional)
      const filtered = searchTerm
        ? rawItems.filter((item) => item.label.toLowerCase().includes(searchTerm.toLowerCase()))
        : rawItems;

      resolve({
        data: filtered,
        hasMore: end < total
      });
    }, 400);
  });
}

async function loadMore() {
  if (isLoading.value || !hasMore.value) return;

  isLoading.value = true;
  try {
    const res = await fetchPositions(page.value, pageSize, search.value);
    positions.value.push(...res.data);
    hasMore.value = res.hasMore;
    if (res.hasMore) {
      page.value += 1;
    }
  } finally {
    isLoading.value = false;
  }
}

// Infinite scroll observer
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

// if search changes, reset list + reload
watch(
  () => search.value,
  async () => {
    positions.value = [];
    page.value = 0;
    hasMore.value = true;
    await loadMore();
  }
);

// example: computed selected ids (you can emit this up if needed)
const selectedPositions = computed(() => positions.value.filter((p) => p.checked).map((p) => p.id));
</script>
