<template>
  <Dialog
    ref="dialog"
    :title="$t(`message.activate-strategy`)"
    showClose
  >
    <template v-slot:content>
      <hr class="border-border-color" />
      <div class="flex flex-col gap-2 px-6 py-4 text-typography-default">
        <div>
          <span class="text-14">Strategy</span>
          <div class="text-20 font-semibold">{{ strategy.content }}</div>
        </div>
        <div>
          <span class="text-14">Allowance</span>
          <Input
            id="receipt-send-2"
            type="text"
            value="100 USDC"
            @input="(e) => {}"
          />
        </div>
      </div>
      <hr class="border-border-color" />
      <div class="px-6 py-4">
        <span class="mb-3 block text-16 font-semibold text-typography-default">Preview</span>
        <div class="flex items-center gap-1 text-14">
          <SvgIcon
            name="check-solid"
            class="fill-icon-success"
          />
          You will activate this strategy with an allowance of 100 USDC
        </div>
      </div>
      <hr class="border-border-color" />
      <div class="flex flex-col gap-2 p-6">
        <Button
          size="medium"
          severity="primary"
          :label="$t('message.activate')"
        />
        <p class="text-center text-12 text-typography-secondary">{{ $t("message.estimate-time") }} ~20sec</p>
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { Button, Dialog, Input, SvgIcon } from "web-components";

const dialog = ref<typeof Dialog | null>(null);

defineProps<{
  strategy: { heading: string; content: string; icon: any };
}>();

defineExpose({ show: () => dialog?.value?.show() });
</script>

<style scoped lang=""></style>
