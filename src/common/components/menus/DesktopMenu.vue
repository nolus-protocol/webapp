<template>
  <div>
    <template
      v-for="item in mainMenuRoutes"
      :key="item"
    >
      <RouterLink
        :to="routePath(item)"
        class="router-link group flex h-[50px] items-center gap-2 rounded-full border border-transparent px-4 py-3 text-16 font-semibold text-typography-default transition-colors duration-200"
      >
        <SidebarIcon :icon="sidebarIconMap[item] ?? item.toLowerCase()" />
        {{ $t(`message.${item}`) }}
      </RouterLink>
    </template>
  </div>
</template>

<script lang="ts" setup>
import SidebarIcon from "@/common/components/icons/SidebarIcon.vue";
import { sidebarIconMap, mainMenuRoutes, routePath } from "./menuConfig";
</script>

<style scoped lang="scss">
.router-link-active {
  @apply rounded-full border border-border-default bg-neutral-bg-2 text-typography-link shadow-small;
}

.router-link:not(.router-link-active) {
  &:hover {
    @apply rounded-full border border-border-default bg-neutral-bg-2 text-typography-link shadow-small;
  }
}
</style>
