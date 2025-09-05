<template>
  <div
    :style="{ zIndex: 24 }"
    class="sticky left-0 top-0 flex w-full items-center justify-between border-b border-border-color bg-neutral-bg-2 px-4 py-2 shadow-larger lg:static lg:border-none lg:bg-transparent lg:px-8 lg:pr-4 lg:pt-6 lg:shadow-transparent"
  >
    <div class="flex items-center gap-2">
      <SvgIcon
        name="hamburger-menu"
        class="cursor-pointer lg:hidden"
        @click="toggleMobileNav"
      />
      <Logo
        @click="router.push('/')"
        class="relative hidden cursor-pointer md:flex lg:fixed"
      />
      <RouterLink
        to="/"
        class="md:hidden"
      >
        <NolusIcon />
      </RouterLink>
    </div>
    <HeaderMenu />
  </div>
</template>

<script lang="ts" setup>
import { SvgIcon } from "web-components";
import Logo from "@/common/components/Logo.vue";
import NolusIcon from "@/assets/icons/nolus-icon.svg";
import HeaderMenu from "@/common/components/menus/HeaderMenu.vue";
import { useRouter } from "vue-router";

const props = defineProps<{
  toggleMobileNav: () => void;
}>();

const toggleMobileNav = () => {
  if (props.toggleMobileNav) {
    props.toggleMobileNav();
  }
};
const router = useRouter();
</script>

<style scoped lang=""></style>
