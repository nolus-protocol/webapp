<template>
  <Dialog
    ref="dialog"
    :title="$t(`message.take-profit`)"
    showClose
    :disable-close="false"
    @close-dialog="closeDialog"
  >
    <template v-slot:content>
      <div class="custom-scroll max-h-full flex-1 overflow-auto">
        <hr class="border-border-color" />
        <div class="flex flex-col gap-4 px-6 py-4">
          <AdvancedFormControl
            id="stop-loss"
            :label="$t('message.take-profit-price-per')"
            :currencyOptions="assets"
            :disabled-currency-picker="true"
            :disabled-input-field="isLoading"
            v-bind="selectedCurrencyBinding"
            :value-only="amount"
            @input="handleAmountChange"
            :error-msg="amountErrorMsg"
            placeholder="0"
            :balanceLabel="`${$t('message.current-price', { asset: currency?.shortName })} ${currentPrice}`"
          >
            <template v-slot:label>
              <div class="flex items-center gap-1">
                {{ $t("message.amount-to-close") }}
                <span class="flex items-center gap-1 font-normal"
                  ><img :src="currency?.icon" /> {{ currency?.label }}</span
                >
                <Tooltip :content="$t('message.take-profit-tooltip')"
                  ><SvgIcon
                    name="help"
                    class="fill-icon-link"
                /></Tooltip>
              </div>
            </template>
          </AdvancedFormControl>
        </div>
        <hr class="border-border-color" />
        <div class="flex flex-col gap-3 px-6 py-4 text-typography-default">
          <span class="text-16 font-semibold">{{ $t("message.preview") }}</span>
          <template v-if="amount.length == 0 || amount == '0'">
            <div class="flex items-start gap-2 text-14">
              <SvgIcon
                name="list-sparkle"
                class="mt-0.5 shrink-0 fill-icon-secondary"
              />
              {{ $t("message.preview-input") }}
            </div>
          </template>
          <template v-else>
            <div class="flex items-start gap-2 text-14">
              <SvgIcon
                name="check-solid"
                class="mt-0.5 shrink-0 fill-icon-success"
              />
              <p
                class="flex-1"
                :innerHTML="
                  $t('message.stoppings-close-price', {
                    price: price,
                    asset: currency?.shortName ?? ''
                  })
                "
              ></p>
            </div>
            <div class="flex items-start gap-2 text-14">
              <SvgIcon
                name="check-solid"
                class="mt-0.5 shrink-0 fill-icon-success"
              />
              {{ $t("message.stoppings-payout", { amount: `${payout}` }) }}
            </div>
          </template>
        </div>
        <hr class="border-border-color" />
      </div>
      <div class="flex flex-1 flex-col justify-end gap-2 p-6">
        <Button
          size="large"
          severity="primary"
          :label="$t(`message.submit-btn`)"
          @click="onSendClick"
          :disabled="disabled"
          :loading="loading"
        />
        <p class="text-center text-12 text-typography-secondary">
          {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.leaseStopLossTakeProfit }}{{ $t("message.sec") }}
        </p>
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { AdvancedFormControl, Button, Dialog, Tooltip, SvgIcon } from "web-components";
import { NATIVE_NETWORK } from "../../../../config/global/network";
import { useTriggerDialog } from "./useTriggerDialog";

const {
  dialog,
  closeDialog,
  amount,
  amountErrorMsg,
  isLoading,
  loading,
  disabled,
  assets,
  currency,
  currentPrice,
  selectedCurrencyBinding,
  price,
  payout,
  handleAmountChange,
  onSendClick
} = useTriggerDialog("take-profit");
</script>
