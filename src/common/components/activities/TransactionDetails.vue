<template>
  <Dialog
    ref="dialog"
    :title="$t('message.transaction-details')"
    showClose
  >
    <template v-slot:content>
      <div class="flex flex-col gap-5 px-6 text-typography-default">
        <span v-if="data.headline">{{ data.headline }}</span>
        <div class="flex flex-col gap-3 rounded-lg border border-border-color bg-neutral-bg-1 p-4">
          <div
            class="flex flex-col"
            v-if="data.position"
          >
            <span class="text-14 text-typography-secondary">{{ $t("message.position") }}</span>
            <span class="flex items-center gap-1"
              ><img
                v-if="data.position.image"
                alt=""
                title=""
                :src="data.position.image"
              />
              {{ data.position.value }}</span
            >
          </div>
          <div
            class="flex flex-col"
            v-if="data.amount"
          >
            <span class="text-14 text-typography-secondary">{{ $t("message.amount") }}</span>
            <CurrencyComponent
              v-if="data.amount"
              v-bind="data.amount"
              :amount="data.amount?.amount"
              :denom="data.amount?.denom"
              :type="data.amount?.type"
              :font-size="16"
              :font-size-small="16"
              class="flex font-semibold"
            />
          </div>
          <hr class="border-t border-border-color" />
          <div
            class="flex flex-col"
            v-if="data.fees"
          >
            <span class="text-14 text-typography-secondary">{{ $t("message.fees") }}</span>
            <CurrencyComponent
              v-if="data.fees"
              v-bind="data.fees"
              :amount="data.fees?.amount"
              :denom="data.fees?.denom"
              :type="data.fees?.type"
              :font-size="16"
              :font-size-small="16"
              class="flex font-semibold"
            />
          </div>
          <div
            class="flex flex-col"
            v-if="data.hash"
          >
            <span class="text-14 text-typography-secondary">{{ $t("message.hash") }}</span>
            <div class="wrap- break-all text-16 font-semibold">{{ data.hash }}</div>
            <div class="mt-2 flex gap-2">
              <Button
                :label="$t('message.btn-tx-hash')"
                severity="secondary"
                icon="copy"
                iconPosition="left"
                size="small"
              />
              <Button
                :label="$t('message.btn-raw-json')"
                severity="secondary"
                icon="copy"
                iconPosition="left"
                size="small"
              />
            </div>
          </div>
        </div>

        <span
          v-if="data.summary"
          class="text-18 font-semibold"
          >{{ $t("message.transactions-summary") }}</span
        >
        <Stepper
          v-if="data.summary"
          :variant="StepperVariant.MEDIUM"
          v-bind="data.summary"
        />
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { Button, Dialog, type MediumStepperProps, Stepper, StepperVariant } from "web-components";
import CurrencyComponent, { type CurrencyComponentProps } from "@/common/components/CurrencyComponent.vue";

const dialog = ref<typeof Dialog | null>(null);

defineProps<{
  data: {
    headline?: string;
    position?: {
      image?: string;
      value: string;
    };
    amount?: CurrencyComponentProps;
    fees?: CurrencyComponentProps;
    hash?: string;
    rawJSON?: string;
    summary?: MediumStepperProps;
  };
}>();

defineExpose({ show: () => dialog?.value?.show() });
</script>

<style scoped lang=""></style>
