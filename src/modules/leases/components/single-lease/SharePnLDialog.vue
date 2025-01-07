<template>
  <Dialog
    ref="dialog"
    :title="$t(`message.share-position`)"
    showClose
  >
    <template v-slot:content>
      <div class="flex flex-col gap-6 px-6 pb-6 text-typography-default">
        <div class="flex flex-col gap-4">
          <span class="text-16">Cover design</span>
          <div>SLIDER HERE</div>
        </div>
        <div>IMAGE HERE</div>
      </div>
      <hr class="border-border-color" />
      <div class="flex gap-4 p-6">
        <Button
          size="medium"
          severity="primary"
          :label="$t(`message.share`)"
          class="flex-1"
        />
        <Button
          size="medium"
          severity="secondary"
          label="Download as PNG"
          class="flex-1"
        />
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { Button, Dialog } from "web-components";

const dialog = ref<typeof Dialog | null>(null);

defineExpose({ show: () => dialog?.value?.show() });
</script>

<style scoped lang=""></style>
