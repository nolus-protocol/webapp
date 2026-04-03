<template>
  <RouterLink
    :to="props.to"
    class="router-link group transition-ease-out relative flex h-12.5 items-center gap-2 px-4 py-3 text-16 font-semibold text-typography-default transition-colors duration-200 before:border-y before:border-border-default hover:text-typography-link lg:before:rounded-full lg:before:border-x"
  >
    <SidebarIcon :icon="props.icon" />
    <span class="relative">{{ props.content }}</span>
  </RouterLink>
</template>

<script lang="ts" setup>
import SidebarIcon from "@/common/components/icons/SidebarIcon.vue";

const props = defineProps<{
  to: string | object;
  icon?: string;
  content: string;
}>();
</script>

<style scoped>
.router-link:not(.router-link-active),
.router-link-active {
  &::before {
    content: "";
    position: absolute;
    z-index: 0;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--color-background-level-2);
    box-shadow: 0px 1px 2px 0px var(--color-shadow-default);
    transition: all 0.2s ease-out;
  }
  &:hover::before {
    transform: scaleX(1) scaleY(1);
    opacity: 1;
  }
}
.router-link:not(.router-link-active) {
  &::before {
    transform: scaleX(0.975) scaleY(0.925);
    opacity: 0;
  }
}
</style>
