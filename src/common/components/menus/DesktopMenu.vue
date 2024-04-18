<template>
  <div>
    <template
      v-for="item in menuItems"
      :key="item.name"
    >
      <template v-if="item!.action">
        <a
          class="sidebar-element flex cursor-pointer items-center gap-2.5 font-garet-medium"
          @click="item!.action(item!.path)"
        >
          <span
            :class="[`icon-${item!.icon}`]"
            class="icon"
          >
          </span>
          {{ $t(`message.${item!.name}`) }}
        </a>
      </template>
      <template v-else>
        <RouterLink
          :to="item!.path"
          class="sidebar-element flex items-center gap-2.5 font-garet-medium"
        >
          <span
            :class="[`icon-${item!.icon}`]"
            class="icon"
          >
          </span>
          {{ $t(`message.${item!.name}`) }}
        </RouterLink>
      </template>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { RouteNames, router } from "@/router";
import { inject } from "vue";
import { EnvNetworkUtils } from "@/common/utils";
import { type Networks } from "@/common/types";

const openDialog = inject("openDialog", () => {});

const menuItems = ref(
  [
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
    EnvNetworkUtils.getStoredNetworkName() == "mainnet"
      ? {
          icon: "swap-v2",
          name: "swap",
          path: `#swap`,
          action: async (path: string) => {
            await router.push(`${location.pathname}${path}`);
            openDialog();
          }
        }
      : null,
    {
      icon: "earn-v2",
      name: "earn",
      path: `/${RouteNames.EARN}`
    },
    {
      icon: "history-v2",
      name: "history",
      path: `/${RouteNames.HISTORY}`
    },
    {
      icon: "vote-v2",
      name: "vote",
      path: `/${RouteNames.VOTE}`
    }
  ].filter((item) => item != null)
);
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

.router-link-exact-active {
  @apply text-orange-active;
}
</style>
