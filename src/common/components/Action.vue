<template>
  <Button
    ref="popoverParent"
    severity="tertiary"
    icon="more"
    size="small"
    class="!p-2.5 text-icon-default"
    @click="isOpen = !isOpen"
  />
  <Popover
    v-if="isOpen"
    position="bottom-right"
    :parent="popoverParent"
    @close="isOpen = !isOpen"
    class="max-w-[160px]"
  >
    <template #content>
      <slot></slot>
    </template>
  </Popover>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { Button, Popover } from "web-components";

const popoverParent = ref();
const isOpen = ref(false);
</script>

<style scoped lang=""></style>
