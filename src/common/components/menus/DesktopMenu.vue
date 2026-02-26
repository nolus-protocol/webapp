<template>
  <div>
    <template
      v-for="item in mainMenuRoutes"
      :key="item"
    >
      <SidebarLink
        :to="routePath(item)"
        :icon="sidebarIconMap[item] ?? item.toLowerCase()"
        :content="$t(`message.${item}`)"
      />
    </template>
  </div>
</template>

<script lang="ts" setup>
import SidebarLink from "../SidebarLink.vue";
import { sidebarIconMap, mainMenuRoutes, routePath } from "./menuConfig";
</script>

<style scoped lang="scss">

</style>
