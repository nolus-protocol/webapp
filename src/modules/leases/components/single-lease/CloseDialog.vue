<template>
  <Dialog
    ref="dialog"
    :title="$t(`message.close`)"
    showClose
    :disable-close="false"
    @close-dialog="closeDialog"
  >
    <template v-slot:content>
      <div class="custom-scroll max-h-full flex-1 overflow-auto">
        <hr class="border-border-color" />
        <div class="flex flex-col gap-4 px-6 py-4">
          <AdvancedFormControl
            id="repay-close"
            labelAdvanced
            :currencyOptions="assets"
            :disabled-currency-picker="isLoading"
            :disabled-input-field="isLoading"
            :selectedCurrencyOption="assets[0]"
            :calculated-balance="calculatedBalance"
            :value-only="amount"
            @input="handleAmountChange"
            :error-msg="amountErrorMsg"
            placeholder="0"
          >
            <template v-slot:label>
              <div class="flex items-center gap-1">
                {{ $t("message.amount-to-close") }}
                <span class="flex items-center gap-1 font-normal"
                  ><img :src="currency?.icon" /> {{ currency?.label }}</span
                >
                <Tooltip :content="$t('message.close-dialog-tooltip')"
                  ><SvgIcon
                    name="help"
                    class="fill-icon-link"
                /></Tooltip>
              </div>
            </template>
          </AdvancedFormControl>
          <!-- :label-mid="`${$t('message.debt')} (~${debt?.amount?.toString() ?? ''})`" -->
          <!-- :label-right="`${$t('message.full-position')} (~${AssetUtils.formatNumber(total?.toString(currency?.decimal_digits), currency?.decimal_digits) ?? ''})`" -->
          <div class="mt-2 px-4 py-3">
            <Slider
              :min-position="0"
              :max-position="100"
              :mid-position="midPosition"
              :value="sliderValue"
              @on-drag="onSetAmount"
              :label-left="`0`"
              :label-mid="`${$t('message.debt')}`"
              :label-right="`${$t('message.full-position')}`"
              @click-right-label="onSelectFullPosition"
              @click-left-label="onSelectZero"
              @click-mid-label="onSelectDebt"
            />
          </div>
        </div>
        <hr class="border-border-color" />
        <ClosePreview
          :lease="lease"
          :slider-value="sliderValue"
          :mid-position="midPosition"
          :covers-full-debt="coversFullDebt"
          :paid-debt="paidDebt"
          :price-usd="priceUsd"
          :debt-data="debtData"
          :remaining="remaining"
          :short-return-atom="shortReturnAtom"
          :position-left="positionLeft"
          :payout="payout"
          :lpn="lpn"
        />
        <hr class="border-border-color" />
      </div>

      <div class="flex flex-col gap-2 p-6">
        <Button
          size="large"
          severity="primary"
          :label="$t(`message.close-btn-label`)"
          @click="onSendClick"
          :disabled="disabled"
          :loading="loading"
        />
        <p class="text-center text-12 text-typography-secondary">
          {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.leaseCloseEstimation }}{{ $t("message.min") }}
        </p>
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { AdvancedFormControl, Button, Dialog, Tooltip, Slider, SvgIcon } from "web-components";
import { NATIVE_NETWORK } from "../../../../config/global/network";
import ClosePreview from "./ClosePreview.vue";
import { useCloseLease } from "./useCloseLease";

const {
  dialog,
  lease,
  assets,
  currency,
  isLoading,
  loading,
  disabled,
  amount,
  amountErrorMsg,
  sliderValue,
  midPosition,
  calculatedBalance,
  priceUsd,
  remaining,
  paidDebt,
  debtData,
  lpn,
  payout,
  positionLeft,
  coversFullDebt,
  shortReturnAtom,
  onSetAmount,
  onSelectFullPosition,
  onSelectZero,
  onSelectDebt,
  handleAmountChange,
  onSendClick,
  closeDialog
} = useCloseLease();
</script>
