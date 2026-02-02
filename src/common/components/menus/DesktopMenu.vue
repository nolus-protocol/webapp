<template>
  <div>
    <template
      v-for="item in filteredRouteNames"
      :key="item"
    >
      <RouterLink
        :to="item === RouteNames.DASHBOARD ? '/' : `/${item}`"
        class="router-link group flex h-[50px] items-center gap-2 rounded-full border border-transparent px-4 py-3 text-16 font-semibold text-typography-default transition-colors duration-200"
      >
        <SidebarIcon :icon="item.toLowerCase()" />
        {{ $t(`message.${item}`) }}
      </RouterLink>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { RouteNames } from "@/router";
import SidebarIcon from "@/common/components/icons/SidebarIcon.vue";

const filteredRouteNames = computed(() => {
  return Object.values(RouteNames).filter(
    (name) => ![RouteNames.STATS, RouteNames.DASHBOARD, RouteNames.VOTE].includes(name)
  );
});
</script>

<style scoped lang="scss">
.router-link-exact-active {
  @apply rounded-full border border-border-default bg-neutral-bg-2 text-typography-link shadow-small;
}

.router-link:not(.router-link-exact-active) {
  &:hover {
    @apply rounded-full border border-border-default bg-neutral-bg-2 text-typography-link shadow-small;
  }
}
</style>
