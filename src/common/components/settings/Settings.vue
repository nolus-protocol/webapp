<template>
  <Button
    ref="popoverParent"
    severity="tertiary"
    icon="cogwheel"
    size="small"
    class="text-icon-default"
    @click="isOpen = !isOpen"
  />
  <Popover
    v-if="isOpen"
    position="bottom-right"
    :parent="popoverParent"
    :title="$t('message.settings')"
    @close="isOpen = !isOpen"
  >
    <template #content>
      <AvatarSettings />
      <ThemeSettings />
    </template>
  </Popover>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { Button, Popover } from "web-components";

import AvatarSettings from "./AvatarSettings.vue";
import ThemeSettings from "./ThemeSettings.vue";

const popoverParent = ref();
const isOpen = ref(false);
</script>

<style scoped lang=""></style>
