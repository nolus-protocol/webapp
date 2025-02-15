<template>
  <form
    class="flex flex-col gap-6"
    @submit.prevent="modelValue.onNextClick"
  >
    <div class="flex flex-col gap-6">
      <CurrencyField
        id="marketCloseBalance"
        :balance="formatLeasePosition()"
        :currency-options="modelValue.currentBalance"
        :disabled-currency-picker="true"
        :error-msg="modelValue.amountErrorMsg"
        :is-error="modelValue.amountErrorMsg !== ''"
        :label="$t('message.lease-position')"
        :option="modelValue.selectedCurrency"
        :total="total"
        :value="modelValue.amount"
        name="marketCloseBalance"
        @input="handleAmountChange($event)"
        @update-currency="(event) => (modelValue.selectedCurrency = event)"
      />
      <div class="flex justify-end">
        <div class="grow-3 text-right text-14 font-medium text-neutral-typography-200">
          <p class="mb-2 mr-5 mt-[14px]">{{ $t("message.repayment-amount") }}:</p>
          <p class="mb-2 mr-5 mt-[14px]">{{ $t("message.position-left") }}:</p>
          <p class="mb-2 mr-5 mt-[14px]">{{ $t("message.usdc-payout") }}:</p>
        </div>
        <div class="text-right text-14 font-semibold">
          <p
            class="align-center mb-2 mt-[14px] flex cursor-pointer select-none flex-wrap justify-end text-neutral-typography-200"
            @click="setValue"
          >
            {{ amount.amount }}
            <span class="ml-[6px] text-[13px] font-normal text-neutral-400"> (${{ amount.amountInStable }}) </span>
            <Tooltip
              :content="$t('message.outstanding-debt-tooltip', { fee: (modelValue.swapFee * 100).toFixed(2) })"
            />
          </p>
          <p class="align-center mb-2 mt-[14px] flex justify-end text-neutral-typography-200">
            {{ positionLeft }}
          </p>
          <p class="align-center mb-2 mt-[14px] flex justify-end text-neutral-typography-200">
            {{ payout }} {{ getLpnSymbol() }}
            <Tooltip :content="$t('message.usdc-payout-tooltip')" />
          </p>
        </div>
      </div>

      <div class="flex justify-end border-t border-border-color pt-2">
        <div class="grow-3 text-right text-14 font-medium text-neutral-typography-200">
          <p class="mr-5 mt-2 text-[12px]">{{ $t("message.price-per") }} {{ swapFeeCurrency?.shortName }}</p>
          <p class="mr-5 mt-2 text-[12px]">
            {{ $t("message.swap-fee") }}
            <span class="font-normal text-[#8396B1]"> ({{ (modelValue.swapFee * 100).toFixed(2) }}%) </span>
          </p>
        </div>
        <div class="text-right text-14 font-semibold">
          <p class="align-center mt-[8px] flex justify-end text-[12px] text-neutral-typography-200">
            {{ selectedAssetPrice }}
          </p>
          <p class="align-center mt-[8px] flex justify-end text-[12px] text-neutral-typography-200">
            -${{ swapFeeStable }}
          </p>
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-6">
      <Button
        :label="$t('message.close')"
        severity="primary"
        size="large"
        type="submit"
      />
      <div class="flex w-full justify-between text-[14px] text-neutral-400">
        <p>{{ $t("message.estimate-time") }}:</p>
        <p>~{{ NATIVE_NETWORK.leaseOpenEstimation }} {{ $t("message.min") }}</p>
      </div>
    </div>
  </form>
</template>

<script lang="ts" setup>
import CurrencyField from "@/common/components/CurrencyField.vue";
import { Button, Tooltip } from "web-components";

import type { MarketCloseComponentProps } from "./types";
import { computed, type PropType } from "vue";

import { Coin, CoinPretty, Dec, Int } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useOracleStore } from "@/common/stores/oracle";
import { NATIVE_NETWORK, PERCENT, PERMILLE, PositionTypes, ProtocolsConfig } from "@/config/global";
import { useApplicationStore } from "@/common/stores/application";
import { AssetUtils, LeaseUtils } from "@/common/utils";
import { CurrencyDemapping } from "@/config/currencies";

const oracle = useOracleStore();
const app = useApplicationStore();
const props = defineProps({
  modelValue: {
    type: Object as PropType<MarketCloseComponentProps>,
    required: true
  }
});

function additionalInterest() {
  const data = props.modelValue.leaseInfo;
  if (data) {
    const lpn = AssetUtils.getLpnByProtocol(props.modelValue.protocol);
    const price = new Dec(oracle.prices[lpn.key].amount);
    const principal_due = new Dec(data.principal_due.amount);
    const loanInterest = new Dec(data.loan_interest_rate / PERMILLE).add(new Dec(data.margin_interest_rate / PERCENT));
    const debt = LeaseUtils.calculateAditionalDebt(principal_due, loanInterest);

    return debt.quo(price);
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

function handleAmountChange(value: string) {
  props.modelValue.amount = value;
}

function formatLeasePosition() {
  const ticker =
    CurrencyDemapping[props.modelValue.leaseInfo.amount.ticker!]?.ticker ?? props.modelValue.leaseInfo.amount.ticker;
  const asset = app.currenciesData![`${ticker!}@${props.modelValue.protocol}`];
  return CurrencyUtils.convertMinimalDenomToDenom(
    props.modelValue.leaseInfo.amount.amount.toString(),
    asset!.ibcData as string,
    asset!.shortName,
    Number(asset!.decimal_digits)
  ).toString();
}

const total = computed(() => {
  const ticker =
    CurrencyDemapping[props.modelValue.leaseInfo.amount.ticker!]?.ticker ?? props.modelValue.leaseInfo.amount.ticker;
  const asset = app.currenciesData![`${ticker!}@${props.modelValue.protocol}`];
  return new Coin(asset!.ibcData as string, props.modelValue.leaseInfo.amount.amount);
});

function setValue() {
  const a = amount.value.amount.toDec();
  const ticker =
    CurrencyDemapping[props.modelValue.leaseInfo.amount.ticker!]?.ticker ?? props.modelValue.leaseInfo.amount.ticker;
  const currency = app.currenciesData![`${ticker!}@${props.modelValue.protocol}`];

  props.modelValue.amount = a.toString(Number(currency!.decimal_digits));
}

const payout = computed(() => {
  const ticker =
    CurrencyDemapping[props.modelValue.leaseInfo.amount.ticker!]?.ticker ?? props.modelValue.leaseInfo.amount.ticker;
  const currency = app.currenciesData![`${ticker!}@${props.modelValue.protocol}`];
  const price = new Dec(oracle.prices[currency!.key as string]?.amount ?? 0);
  const value = new Dec(props.modelValue.amount.length == 0 ? 0 : props.modelValue.amount).mul(price);

  const outStanding = getAmountValue("0").amountInStable.toDec();
  let payOutValue = value.sub(outStanding);

  if (payOutValue.isNegative()) {
    return "0.00";
  }

  switch (ProtocolsConfig[props.modelValue.protocol].type) {
    case PositionTypes.short: {
      let lpn = AssetUtils.getLpnByProtocol(props.modelValue.protocol);
      const price = new Dec(oracle.prices[lpn!.key as string].amount);
      payOutValue = payOutValue.quo(price);

      break;
    }
  }

  return payOutValue.toString(Number(currency!.decimal_digits));
});

const positionLeft = computed(() => {
  const ticker =
    CurrencyDemapping[props.modelValue.leaseInfo.amount.ticker!]?.ticker ?? props.modelValue.leaseInfo.amount.ticker;
  const currency = app.currenciesData![`${ticker!}@${props.modelValue.protocol}`];
  const amount = new Dec(props.modelValue.leaseInfo.amount.amount, Number(currency!.decimal_digits));
  const value = new Dec(props.modelValue.amount.length == 0 ? 0 : props.modelValue.amount);
  const left = amount.sub(value);

  if (left.isNegative()) {
    return "0.00";
  }

  return `${left.toString(Number(currency!.decimal_digits))} ${currency!.shortName}`;
});

const amount = computed(() => {
  return getAmountValue(props.modelValue.amount == "" ? "0" : props.modelValue.amount);
});

function getAmountValue(a: string) {
  const selectedCurrency = props.modelValue.selectedCurrency;
  const [_, protocolKey] = selectedCurrency.key.split("@");
  const lpn = AssetUtils.getLpnByProtocol(protocolKey);

  let amount = new Dec(a);
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
        coinDenom: lpn.shortName,
        coinMinimalDenom: lpn.ibcData,
        coinDecimals: Number(lpn.decimal_digits)
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

function getLpnSymbol() {
  const [_key, protocol] = props.modelValue.selectedCurrency.key.split("@");
  const lpn = AssetUtils.getLpnByProtocol(protocol);

  for (const lpn of app.lpn ?? []) {
    const [_, p] = lpn.key.split("@");
    if (p == protocol) {
      return lpn.shortName;
    }
  }
  return lpn.shortName;
}

const selectedAssetPrice = computed(() => {
  const price = oracle.prices[swapFeeCurrency.value?.key as string];

  const p = new Dec(price?.amount ?? 0);
  const fee = new Dec(1 + (props.modelValue?.swapFee ?? 0));

  return CurrencyUtils.formatPrice(p.mul(fee).toString());
});

const swapFeeStable = computed(() => {
  try {
    const asset = props.modelValue.selectedCurrency;
    const amount = new Dec(props.modelValue.amount);
    const price = oracle.prices[asset.ibcData];
    const value = amount.mul(new Dec(price.amount)).mul(new Dec(props.modelValue.swapFee));

    return value.toString(asset.decimal_digits);
  } catch (error) {
    return "0.00";
  }
});

const swapFeeCurrency = computed(() => {
  switch (ProtocolsConfig[props.modelValue.protocol].type) {
    case PositionTypes.short: {
      return AssetUtils.getLpnByProtocol(props.modelValue.protocol);
    }
    case PositionTypes.long: {
      return props.modelValue.selectedCurrency;
    }
  }
});
</script>
