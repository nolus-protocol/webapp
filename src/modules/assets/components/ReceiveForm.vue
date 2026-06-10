<template>
  <div
    id="dialog-scroll"
    class="custom-scroll max-h-full flex-1 overflow-auto"
  >
    <!-- <div class="flex max-w-[190px] flex-col gap-2 px-6 py-4">
      <label
        for="dropdown-btn-network"
        class="text-16 font-semibold text-typography-default"
        >{{ $t("message.network") }}</label
      >
      <Dropdown
        id="network"
        :on-select="onUpdateNetwork"
        :options="networks"
        :size="Size.medium"
        searchable
        :selected="network"
        :disabled="isDisabled"
      />
    </div>
    <hr class="border-border-color" /> -->
    <AdvancedFormControl
      id="receive"
      searchable
      :currencyOptions="assets"
      class="px-6 py-4"
      :label="$t('message.amount')"
      :balanceLabel="$t('message.balance')"
      placeholder="0"
      :calculated-balance="calculatedBalance"
      :pickerPlacehodler="$t('message.loading')"
      @on-selected-currency="onSelectCurrency"
      @input="handleAmountChange"
      :value="amount"
      :is-loading-picker="disablePicker"
      :disabled-input-field="isDisabled"
      :disabled-currency-picker="disablePicker || isDisabled"
      :error-msg="amountErrorMsg"
      v-bind="currency !== undefined ? { selectedCurrencyOption: currency } : {}"
      :itemsHeadline="[$t('message.assets'), $t('message.balance')]"
      :item-template="
        (item: any) =>
          h<AssetItemProps>(AssetItem, {
            ...item,
            abbreviation: item.label,
            name: item.name,
            balance: item.balance.value
          })
      "
    />
    <div class="relative flex items-center justify-center">
      <hr class="border-border-color" />
      <Button
        severity="secondary"
        icon="arrow-down"
        size="large"
        class="pointer-events-none absolute cursor-none !p-[9px]"
      />
    </div>
    <hr class="border-border-color" />
    <div class="flex flex-col gap-2 px-6 py-4">
      <div class="flex items-center gap-1">
        <label
          for="input-receipt-send-2"
          class="text-16 font-semibold text-typography-default"
          >{{ $t("message.recipient") }}</label
        >
      </div>
      <Input
        id="receipt-send-2"
        type="text"
        :disabled="true"
        inputClass="border-none p-0"
        :value="walletStore.wallet?.address ? walletStore.wallet?.address : $t('message.connect-wallet-label')"
      />
    </div>

    <hr class="my-4 border-border-color" />
  </div>
  <div class="flex flex-col gap-2 p-6">
    <Button
      size="large"
      severity="primary"
      :label="$t('message.receive')"
      :loading="isLoading"
      :disabled="isDisabled"
      @click="onSwap"
    />
    <p class="text-center text-12 text-typography-secondary">
      {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.transferEstimation }}{{ $t("message.sec") }}
    </p>
  </div>
</template>

<script lang="ts" setup>
import { AdvancedFormControl, Button, AssetItem, Input, type AssetItemProps } from "web-components";
import { h } from "vue";
import { NATIVE_NETWORK } from "../../../config/global/network";
import { useReceiveForm } from "./useReceiveForm";

const {
  assets,
  currency,
  amount,
  amountErrorMsg,
  calculatedBalance,
  disablePicker,
  isDisabled,
  isLoading,
  walletStore,
  handleAmountChange,
  onSelectCurrency,
  onSwap
} = useReceiveForm();
</script>
