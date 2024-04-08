<template>
  <div
    ref="sidebar"
    class="fixed bottom-0 left-0 z-[9999] w-full lg:hidden"
  >
    <!-- Hidden menu -->
    <div
      :style="showMobileNav ? 'transform: translateY(-176px)' : ''"
      class="background nls-border mobile-transition-taskbar absolute z-[10] mb-[-1px] flex w-full flex-col rounded-tl-xl rounded-tr-xl transition-[0.5s]"
    >
      <RouterLink
        v-for="item in hiddenMenuItems"
        :id="item.id"
        :key="item.name"
        :href="item.path"
        :target="item.target"
        :to="item.path"
        class="sidebar-element nls-nav-link flex items-center gap-2.5 py-2.5 pl-4 font-garet-medium text-16 text-primary [&:not(:last-child)]:border-b-[1px]"
        @click="showMobileNav = false"
      >
        <span
          :class="[`icon-${item.icon}`]"
          class="icon"
        >
        </span>
        {{ $t(`message.${item.name}`) }}
      </RouterLink>
    </div>

    <div class="background sidebar-elements-block relative z-20 flex w-full justify-between px-4 pb-4 pt-1.5">
      <template
        v-for="item in visibleMenuItems"
        :key="item.name"
        class="sidebar-element flex flex-col items-center font-garet-medium text-16"
        @click="showMobileNav = false"
      >
        <template v-if="item.action">
          <a
            class="sidebar-element flex cursor-pointer flex-col items-center font-garet-medium text-16"
            @click="item.action(item.path)"
          >
            <span
              :class="[`icon-${item.icon}`]"
              class="icon"
            >
            </span>
            {{ $t(`message.${item.name}`) }}
          </a>
        </template>
        <template v-else>
          <RouterLink
            :to="item.path"
            class="sidebar-element flex flex-col items-center font-garet-medium text-16"
          >
            <span
              :class="[`icon-${item.icon}`]"
              class="icon"
            >
            </span>
            {{ $t(`message.${item.name}`) }}
          </RouterLink>
        </template>
      </template>

      <a
        :class="[showMobileNav ? 'router-link-exact-active' : '']"
        class="sidebar-element flex flex-col items-center font-garet-medium text-16"
        @click="showMobileNav = !showMobileNav"
      >
        <span class="icon icon-more" />
        {{ $t("message.settings") }}
      </a>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { RouteNames, router } from "@/router";
import { inject } from "vue";

const openDialog = inject("openDialog", () => {});
const showMobileNav = ref(false);
const isMobile = ref(false);
const sidebar = ref(null as HTMLDivElement | null);

const visibleMenuItems = [
  {
    icon: "asset-v2",
    name: "assets",
    path: `/`
  },
  {
    icon: "lease-v2",
    name: "lease",
    path: `/${RouteNames.LEASE}`
  },
  {
    icon: "swap-v2",
    name: "swap",
    path: `#swap`,
    action: async (path: string) => {
      await router.push(`${location.pathname}${path}`);
      openDialog();
    }
  },
  {
    icon: "earn-v2",
    name: "earn",
    path: `/${RouteNames.EARN}`
  }
];

const hiddenMenuItems = [
  {
    icon: "stats",
    name: "protocol-stats",
    path: `/${RouteNames.STATS}`
  },
  {
    icon: "hub",
    name: "support",
    path: `https://hub.nolus.io`,
    target: "_blank",
    id: "hub"
  },
  {
    icon: "vote-v2",
    name: "vote",
    path: `/${RouteNames.VOTE}`
  },
  {
    icon: "history-v2",
    name: "history",
    path: `/${RouteNames.HISTORY}`
  }
];

onMounted(() => {
  isMobile.value = screen?.width < 1024;

  if (isMobile.value) {
    document.addEventListener("click", onClick);
  }
});

onUnmounted(() => {
  if (isMobile.value) {
    document.removeEventListener("click", onClick);
  }
});

function onClick(event: MouseEvent) {
  if (isMobile.value) {
    const isClickedOutside = sidebar.value?.contains(event.target as Node);
    if (!isClickedOutside) {
      showMobileNav.value = false;
    }
  }
}
</script>

<style lang="scss" scoped>
[class^="icon-"]:before,
[class*=" icon-"]:before {
  font-family: "nolus";
  font-style: normal;
  font-weight: normal;
  display: inline-block;
  text-decoration: inherit;
  width: unset;
  margin-right: 0;
  text-align: center;
  opacity: 1;
  font-variant: normal;
  text-transform: none;
  line-height: unset;
  margin-left: 0;
  font-size: 22px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#governance:after,
#hub::after {
  content: "\e801";
  font-family: "nolus";
}
</style>
