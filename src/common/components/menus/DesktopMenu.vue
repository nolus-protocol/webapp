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
  border-radius: 9999px;
  border: 1px solid var(--color-border-default);
  background-color: var(--color-background-level-2);
  color: var(--color-typography-link);
  box-shadow: 0px 1px 2px 0px var(--color-shadow-default);
}

.router-link:not(.router-link-active) {
  &:hover {
    border-radius: 9999px;
    border: 1px solid var(--color-border-default);
    background-color: var(--color-background-level-2);
    color: var(--color-typography-link);
    box-shadow: 0px 1px 2px 0px var(--color-shadow-default);
  }
}
</style>
