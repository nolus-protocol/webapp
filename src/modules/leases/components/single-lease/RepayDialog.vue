<template>
  <Dialog
    ref="dialog"
    :title="$t(`message.repay`)"
    showClose
    :disable-close="false"
    @close-dialog="closeDialog"
  >
    <template v-slot:content>
      <div
        id="dialog-scroll"
        class="custom-scroll max-h-full flex-1 overflow-auto"
      >
        <hr class="border-border-color" />
        <div class="flex flex-col gap-4 px-2 py-4">
          <AdvancedFormControl
            id="receive-send"
            labelAdvanced
            :currencyOptions="assets"
            class="px-6 pt-4"
            :balanceLabel="$t('message.balance')"
            placeholder="0"
            :calculated-balance="calculatedBalance"
            :disabled-currency-picker="isLoading"
            :disabled-input-field="isLoading"
            v-bind="selectedCurrencyBinding"
            :value-only="amount"
            @input="handleAmountChange"
            :error-msg="amountErrorMsg"
          >
            <template v-slot:label>
              <div class="flex items-center gap-1">
                {{ $t("message.amount-to-repay") }}
                <span class="flex items-center gap-1 font-normal"
                  ><img :src="currency?.icon" /> {{ currency?.label }}</span
                >
              </div>
            </template>
          </AdvancedFormControl>
          <div class="px-6 py-3">
            <!-- :label-right="`${$t('message.debt')} (~${debt?.amount?.toString() ?? ''})`" -->
            <Slider
              :min-position="0"
              :max-position="100"
              :value="sliderValue"
              @on-drag="onSetAmount"
              :label-left="`0`"
              :label-right="`${$t('message.debt')}`"
              @click-right-label="onSelectFullDebt"
              @click-left-label="onSelectZero"
            />
          </div>
        </div>
        <hr class="border-border-color" />
        <RepayPreview
          :slider-value="sliderValue"
          :detb-partial="detbPartial"
          :liquidation="liquidation"
          :debt-data="debtData"
        />
        <hr class="border-border-color" />
      </div>
      <div class="flex flex-col gap-2 p-6">
        <Button
          size="large"
          severity="primary"
          :label="$t(`message.repay`)"
          @click="onSendClick"
          :disabled="disabled"
          :loading="loading"
        />
        <p class="text-center text-12 text-typography-secondary">
          {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.leaseRepayEstimation }}{{ $t("message.sec") }}
        </p>
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { AdvancedFormControl, Button, Dialog, Slider } from "web-components";
import { NATIVE_NETWORK } from "../../../../config/global/network";
import RepayPreview from "./RepayPreview.vue";
import { useRepayLease } from "./useRepayLease";

const {
  dialog,
  assets,
  currency,
  isLoading,
  loading,
  disabled,
  amount,
  amountErrorMsg,
  sliderValue,
  calculatedBalance,
  detbPartial,
  liquidation,
  debtData,
  onSetAmount,
  onSelectFullDebt,
  onSelectZero,
  handleAmountChange,
  onSendClick,
  closeDialog
} = useRepayLease();

// Conditional spread keeps `undefined` out of the optional prop
// (exactOptionalPropertyTypes) while preserving the "no selection" render.
const selectedCurrencyBinding = computed(() => {
  const first = assets.value[0];
  return first !== undefined ? { selectedCurrencyOption: first } : {};
});
</script>
