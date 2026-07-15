<template>
  <div
    class="flex w-full flex-1 flex-col self-start rounded-xl border border-border-default bg-neutral-bg-2 shadow-larger"
  >
    <div class="flex gap-px rounded-tl-xl rounded-tr-xl bg-border-default">
      <Radio
        v-for="(tab, index) in tabs"
        :key="index"
        :id="`tab-${index}`"
        ref="radioRefs"
        :class="[
          {
            'border-transparent bg-neutral-bg-2': activeTabIdx === index,
            'border-border-default': activeTabIdx !== index,
            'rounded-tl-xl': index === 0,
            'rounded-tr-xl': index === tabs.length - 1
          }
        ]"
        :label="$t(`message.${tab.action}`)"
        :checked="activeTabIdx == index"
        class="flex flex-1 cursor-pointer justify-center border-b bg-neutral-bg-1 px-6 py-5 text-16 font-normal text-typography-default"
        name="dialogTabsGroup"
        @click="handleParentClick(index)"
        :disabled="!isShortEnabled"
      />
    </div>

    <AdvancedFormControl
      searchable
      id="receive-send"
      :currencyOptions="assets"
      class="px-6 pt-4"
      :label="$t('message.down-payment-uppercase')"
      :balanceLabel="$t('message.balance')"
      placeholder="0"
      :calculated-balance="calculatedBalance"
      :disabled-currency-picker="isLoading"
      :disabled-input-field="isLoading"
      @on-selected-currency="
        (option: any) => {
          selectedCurrency = assets.findIndex((item) => item == option);
          selectedLoanCurrency = 0;
        }
      "
      @input="handleAmountChange"
      :error-msg="amountErrorMsg"
      v-bind="advancedControlBindings"
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
    <hr class="my-4 border-border-color" />
    <div class="flex max-w-[190px] flex-col gap-2 px-6">
      <label
        for="dropdown-btn-asset-to-lease"
        class="text-16 font-semibold text-typography-default"
        >{{ $t("message.asset-to-lease") }}</label
      >
      <Dropdown
        id="asset-to-lease"
        :on-select="
          (data) => {
            selectedLoanCurrency = coinList.findIndex((item) => item == data);
          }
        "
        :options="coinList"
        :size="Size.medium"
        v-bind="selectedLoanOption !== undefined ? { selected: selectedLoanOption } : {}"
        searchable
        :disabled="isLoading"
      />
    </div>
    <hr class="my-4 border-border-color" />
    <div class="flex flex-col gap-2 px-6">
      <label
        for="position-size"
        class="flex w-fit items-center text-16 font-semibold text-typography-default"
        >{{ $t("message.position-size") }}
      </label>
      <div class="px-[18px] py-3">
        <Slider
          :disabled="isLoading"
          :min-position="MIN_POSITION"
          :max-position="MAX_POSITION"
          :positions="POSITIONS"
          @on-drag="onDrag"
          class="relative"
        />
      </div>
    </div>
    <hr class="my-4 border-border-color" />

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
            label: $t('message.open-position'),
            icon: NATIVE_NETWORK.icon,
            meta: () => h('div', `${NATIVE_NETWORK.label}`)
          },
          {
            label: $t('message.stepper-transfer-position'),
            icon: getIconByProtocol()!,
            token: {
              balance: formatTokenBalance(stepperTransfer),
              symbol: assets[selectedCurrency]?.label
            },
            meta: () => h('div', `${NATIVE_NETWORK.label} > ${protocolName}`)
          },
          {
            label: $t('message.swap'),
            icon: getIconByProtocol()!,
            tokenComponent: () => h('div', swapAmount),
            meta: () => h('div', `${protocolName} > ${NATIVE_NETWORK.label}`)
          }
        ]"
        :variant="StepperVariant.MEDIUM"
      />
    </div>
    <hr class="my-4 border-border-color" /> -->
    <div class="flex flex-col gap-2 p-6">
      <Button
        size="large"
        severity="primary"
        :label="$t('message.open-position')"
        @click="onOpenLease()"
        :loading="isLoading"
        :disabled="isDisabled || isProtocolDisabled"
      />
      <p class="text-center text-12 text-typography-secondary">
        {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.leaseOpenEstimation }}{{ $t("message.min") }}
      </p>
    </div>
  </div>
  <LongLeaseDetails
    :downpaymen-amount="amount"
    :downpayment-currency="currency?.key ?? ''"
    :lease="leaseApply"
    :loan-currency="selectedLoanOption?.key ?? ''"
  />
</template>

<script lang="ts" setup>
import { h } from "vue";
import {
  AdvancedFormControl,
  Button,
  Dropdown,
  Radio,
  Slider,
  Size,
  type AssetItemProps,
  AssetItem
} from "web-components";
import { tabs } from "../types";
import LongLeaseDetails from "@/modules/leases/components/new-lease/LongLeaseDetails.vue";
import { NATIVE_NETWORK } from "../../../../config/global/network";
import { MAX_POSITION, MIN_POSITION, POSITIONS } from "@/config/global";
import { useLongLeaseForm } from "./useLongLeaseForm";

const activeTabIdx = 0;

const {
  selectedCurrency,
  selectedLoanCurrency,
  isLoading,
  isDisabled,
  amount,
  amountErrorMsg,
  leaseApply,
  handleAmountChange,
  handleParentClick,
  onDrag,
  assets,
  coinList,
  currency,
  selectedLoanOption,
  advancedControlBindings,
  calculatedBalance,
  isShortEnabled,
  isProtocolDisabled,
  onOpenLease
} = useLongLeaseForm();
</script>
