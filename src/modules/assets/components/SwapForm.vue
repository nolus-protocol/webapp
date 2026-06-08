<template>
  <div
    id="dialog-scroll"
    class="custom-scroll max-h-full flex-1 overflow-auto"
  >
    <MultipleCurrencyComponent
      :currency-options="assets"
      :itemsHeadline="[$t('message.assets'), $t('message.balance')]"
      :selected-first-currency-option="selectedAsset"
      :selected-second-currency-option="selectedSecondCurrencyOption"
      :disabled="disabledByWallet || disabled || loadingTx"
      @on-first-change="updateAmount"
      @on-second-change="updateSwapToAmount"
      :first-input-value="firstInputAmount?.toString()"
      :second-input-value="secondInputAmount?.toString()"
      :first-calculated-balance="firstCalculatedBalance"
      :second-calculated-balance="secondCalculatedBalance"
      :error-msg="error"
      :error-insufficient-balance="errorInsufficientBalance"
      @swap="onSwapItems"
      :item-template="
        (item) =>
          h<AssetItemProps>(AssetItem, {
            ...item,
            abbreviation: item.label,
            name: item.name,
            balance: item.balance.value
          })
      "
    />
    <div class="flex justify-end border-t border-b border-border-color px-6 py-4">
      <div class="flex flex-[3] flex-col gap-3 text-right text-16 font-normal text-typography-secondary">
        <p class="flex gap-1 self-end">{{ $t("message.price-impact") }}:</p>
        <p class="flex gap-1 self-end">
          {{ $t("message.estimated-tx-fee") }}:
          <span class="w-[18px]"> </span>
        </p>
      </div>
      <div
        class="ml-2 flex flex-[1] flex-col justify-between gap-2 text-right text-16 font-semibold text-typography-default"
      >
        <template v-if="loading">
          <p class="align-center flex justify-end">
            <span class="state-loading !w-[60px]"> </span>
          </p>
          <p class="align-center flex justify-end">
            <span class="state-loading !w-[60px]"> </span>
          </p>
        </template>
        <template v-else>
          <p class="align-center flex justify-end">{{ priceImapact }}%</p>
          <p class="align-center flex justify-end whitespace-pre">
            {{ swapFee }}
          </p>
        </template>
      </div>
    </div>

    <!-- <div class="mt-4 flex flex-col justify-end px-4">
      <Button
        v-if="showDetails"
        :label="$t('message.hide-transaction-details')"
        @click="showDetails = !showDetails"
        severity="tertiary"
        icon="minus"
        iconPosition="left"
        size="small"
        class="self-end text-icon-default"
      />

      <Button
        v-else
        :label="$t('message.show-transaction-details')"
        @click="showDetails = !showDetails"
        severity="tertiary"
        icon="plus"
        iconPosition="left"
        size="small"
        class="self-end text-icon-default"
      />

      <Stepper
        v-if="showDetails"
        :active-step="-1"
        :steps="[
          {
            label: $t('message.swap'),
            icon: NATIVE_NETWORK.icon,
            tokenComponent: () =>
              h(
                'div',
                `${formatNumber(amount, NATIVE_CURRENCY.maximumFractionDigits)} ${selectedAsset?.label} > ${formatNumber(swapToAmount, NATIVE_CURRENCY.maximumFractionDigits)} ${selectedSecondCurrencyOption?.label}`
              ),
            meta: () => h('div', `${NATIVE_NETWORK.label}`)
          }
        ]"
        :variant="StepperVariant.MEDIUM"
      />
    </div> -->
    <!-- <hr class="my-4 border-border-color" /> -->
  </div>
  <div class="flex flex-col gap-2 p-6">
    <Button
      size="large"
      severity="primary"
      :label="$t('message.swap')"
      :loading="loading || loadingTx"
      :disabled="disabledByWallet || disabled"
      @click="onNextClick"
    />
    <p class="text-center text-12 text-typography-secondary">
      {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.longOperationsEstimation }}{{ $t("message.sec") }}
    </p>
  </div>
</template>

<script lang="ts" setup>
import MultipleCurrencyComponent from "@/common/components/MultipleCurrencyComponent.vue";
import { Button, type AssetItemProps, AssetItem } from "web-components";
import { NATIVE_NETWORK } from "../../../config/global/network";
import { h } from "vue";
import { useSwapForm } from "./useSwapForm";

const {
  assets,
  selectedAsset,
  selectedSecondCurrencyOption,
  disabledByWallet,
  disabled,
  loadingTx,
  loading,
  firstInputAmount,
  secondInputAmount,
  firstCalculatedBalance,
  secondCalculatedBalance,
  error,
  errorInsufficientBalance,
  swapFee,
  priceImapact,
  updateAmount,
  updateSwapToAmount,
  onSwapItems,
  onNextClick
} = useSwapForm();
</script>
