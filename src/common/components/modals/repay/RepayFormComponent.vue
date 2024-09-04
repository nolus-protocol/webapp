<template>
  <form
    class="flex flex-col gap-6"
    @submit.prevent="modelValue.onNextClick"
  >
    <div class="flex flex-col gap-6">
      <CurrencyField
        id="repayBalance"
        :balance="formatCurrentBalance(modelValue.selectedCurrency)"
        :currency-options="modelValue.currentBalance"
        :error-msg="modelValue.amountErrorMsg"
        :is-error="modelValue.amountErrorMsg !== ''"
        :label="$t('message.amount-field')"
        :option="modelValue.selectedCurrency"
        :total="modelValue.selectedCurrency.balance"
        :value="modelValue.amount"
        name="repayBalance"
        @input="handleAmountChange($event)"
        @update-currency="updateCurrency"
      />
      <div class="flex justify-end">
        <div class="grow-3 text-right text-14 font-medium text-neutral-typography-200">
          <p class="mb-2 mr-5 mt-[14px]">{{ $t("message.repayment-amount") }}:</p>
        </div>
        <div class="text-right text-14 font-semibold">
          <p class="align-center mb-2 mt-[14px] flex justify-end text-neutral-typography-200">
            <a
              class="cursor-pointer select-none"
              @click="setRepayAmount"
            >
              {{ amount.amount }}
              <span class="ml-[6px] text-[13px] font-normal text-neutral-400"> (${{ amount.amountInStable }}) </span>
            </a>
            <Tooltip
              :content="$t('message.outstanding-debt-tooltip', { fee: (modelValue.swapFee * 100).toFixed(2) })"
            />
          </p>
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-6">
      <Button
        :label="$t('message.repay')"
        severity="primary"
        size="large"
        type="submit"
      />
      <div class="flex w-full justify-between text-[14px] text-neutral-400">
        <p>{{ $t("message.estimate-time") }}:</p>
        <p>~{{ NATIVE_NETWORK.longOperationsEstimation }} {{ $t("message.sec") }}</p>
      </div>
    </div>
  </form>
</template>

<script lang="ts" setup>
import CurrencyField from "@/common/components/CurrencyField.vue";

import type { RepayComponentProps } from "./types";
import { computed, nextTick, type PropType } from "vue";

import { CoinPretty, Dec, Int } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useOracleStore } from "@/common/stores/oracle";
import { NATIVE_NETWORK, PERCENT, PERMILLE, PositionTypes, ProtocolsConfig } from "@/config/global";
import { useApplicationStore } from "@/common/stores/application";
import { AssetUtils, LeaseUtils } from "@/common/utils";
import type { ExternalCurrency } from "@/common/types";
import { CurrencyDemapping } from "@/config/currencies";
import { Button, Tooltip } from "web-components";

const oracle = useOracleStore();
const app = useApplicationStore();

const props = defineProps({
  modelValue: {
    type: Object as PropType<RepayComponentProps>,
    required: true
  }
});

function additionalInterest() {
  const data = props.modelValue.leaseInfo;
  if (data) {
    const principal_due = new Dec(data.principal_due.amount);
    const loanInterest = new Dec(data.loan_interest_rate / PERMILLE).add(new Dec(data.margin_interest_rate / PERCENT));
    const debt = LeaseUtils.calculateAditionalDebt(principal_due, loanInterest);

    return debt;
  }

  return new Dec(0);
}

function outStandingDebt() {
  const data = props.modelValue.leaseInfo;

  const debt = new Dec(data.principal_due.amount)
    .add(new Dec(data.overdue_margin.amount))
    .add(new Dec(data.overdue_interest.amount))
    .add(new Dec(data.due_margin.amount))
    .add(new Dec(data.due_interest.amount))
    .add(additionalInterest().roundUpDec());

  return debt;
}

const setRepayAmount = () => {
  setRepayment(100);
};

function handleAmountChange(value: string) {
  props.modelValue.amount = value;
}

function formatCurrentBalance(selectedCurrency: ExternalCurrency) {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      selectedCurrency.shortName,
      selectedCurrency.decimal_digits
    ).toString();
  }
}

function setRepayment(p: number) {
  const { repayment, selectedCurrencyInfo } = getRepayment(p)!;
  props.modelValue.amount = repayment.toString(selectedCurrencyInfo.decimal_digits + 1);
}

function getRepayment(p: number) {
  const amount = outStandingDebt();
  const ticker =
    CurrencyDemapping[props.modelValue.leaseInfo.principal_due.ticker!]?.ticker ??
    props.modelValue.leaseInfo.principal_due.ticker;
  const currency = app.currenciesData![`${ticker!}@${props.modelValue.protocol}`];

  const amountToRepay = CurrencyUtils.convertMinimalDenomToDenom(
    amount.toString(),
    currency.shortName,
    currency.ibcData,
    currency.decimal_digits
  ).toDec();

  const percent = new Dec(p).quo(new Dec(100));
  let repaymentInStable = amountToRepay.mul(percent);
  const selectedCurrency = props.modelValue.selectedCurrency;

  if (props.modelValue.swapFee) {
    repaymentInStable = repaymentInStable.add(repaymentInStable.mul(new Dec(props.modelValue.swapFee)));
  }
  switch (ProtocolsConfig[props.modelValue.protocol].type) {
    case PositionTypes.short: {
      let lpn = AssetUtils.getLpnByProtocol(props.modelValue.protocol);
      const price = new Dec(oracle.prices[lpn!.key as string].amount);
      const selected_asset_price = new Dec(oracle.prices[selectedCurrency!.key as string].amount);

      const repayment = repaymentInStable.mul(price);

      return {
        repayment: repayment.quo(selected_asset_price),
        repaymentInStable: repayment,
        selectedCurrencyInfo: selectedCurrency
      };
    }
    case PositionTypes.long: {
      const price = new Dec(oracle.prices[selectedCurrency!.key as string].amount);
      const repayment = repaymentInStable.quo(price);
      return {
        repayment,
        repaymentInStable,
        selectedCurrencyInfo: selectedCurrency
      };
    }
  }
}

const amount = computed(() => {
  const selectedCurrency = props.modelValue.selectedCurrency;
  const [_, protocolKey] = selectedCurrency.key.split("@");

  const lpn = AssetUtils.getLpnByProtocol(protocolKey);

  let amount = new Dec(props.modelValue.amount == "" ? 0 : props.modelValue.amount);
  const price = new Dec(oracle.prices[selectedCurrency!.key as string]?.amount ?? 0);
  const { repayment, repaymentInStable } = getRepayment(100)!;

  const amountInStableInt = amount
    .mul(price)
    .mul(new Dec(10).pow(new Int(lpn.decimal_digits)))
    .truncate();
  const amountInt = amount.mul(new Dec(10).pow(new Int(selectedCurrency.decimal_digits))).truncate();

  const repaymentInt = repayment.mul(new Dec(10).pow(new Int(selectedCurrency.decimal_digits))).truncate();
  const repaymentInStableInt = repaymentInStable.mul(new Dec(10).pow(new Int(lpn.decimal_digits))).truncate();

  let vStable = repaymentInStableInt.sub(amountInStableInt);
  let v = repaymentInt.sub(amountInt);

  if (vStable.isNegative()) {
    vStable = new Int(0);
  }

  if (v.isNegative()) {
    v = new Int(0);
  }

  return {
    amountInStable: new CoinPretty(
      {
        coinDenom: selectedCurrency.shortName,
        coinMinimalDenom: selectedCurrency.ibcData,
        coinDecimals: selectedCurrency.decimal_digits
      },
      vStable
    )
      .trim(true)
      .maxDecimals(4)
      .hideDenom(true),
    amount: new CoinPretty(
      {
        coinDenom: selectedCurrency.shortName,
        coinMinimalDenom: selectedCurrency.ibcData,
        coinDecimals: selectedCurrency.decimal_digits
      },
      v
    )
  };
});

function updateCurrency(event: ExternalCurrency) {
  props.modelValue.selectedCurrency = event;
  if (props.modelValue.amount == "" || !props.modelValue.amount) {
    nextTick(() => {
      props.modelValue.amountErrorMsg = "";
    });
  }
}
</script>
