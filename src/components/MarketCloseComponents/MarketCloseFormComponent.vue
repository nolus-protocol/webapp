<template>
  <form
    @submit.prevent="modelValue.onNextClick"
    class="w-full"
  >
    <div class="block text-left px-5 lg:px-10 mt-10 py-[5px]">
      <CurrencyField
        id="marketCloseBalance"
        name="marketCloseBalance"
        :label="$t('message.lease-position')"
        :value="modelValue.amount"
        :currency-options="modelValue.currentBalance"
        :option="modelValue.selectedCurrency"
        :error-msg="modelValue.amountErrorMsg"
        :is-error="modelValue.amountErrorMsg !== ''"
        :disabled-currency-picker="true"
        :balance="formatLeasePosition()"
        :total="total"
        :set-input-value="setAmount"
        @input="handleAmountChange($event)"
        @update-currency="(event) => (modelValue.selectedCurrency = event)"
      />
      <div class="flex justify-end mt-[32px]">
        <div class="grow-3 text-right nls-font-500 text-14 dark-text">
          <p class="mb-2 mt-[14px] mr-5">
            {{ $t("message.repayment-amount") }}:
          </p>
          <p class="mb-2 mt-[14px] mr-5">
            {{ $t("message.usdc-payout") }}:
          </p>
          <p class="mb-2 mt-[14px] mr-5">
            {{ $t("message.position-left") }}:
          </p>
        </div>
        <div class="text-right nls-font-700 text-14">
          <p
            class="mb-2 mt-[14px] flex justify-end align-center dark-text cursor-pointer select-none"
            @click="setValue"
          >
            {{ amount.amount }}
            <span class="text-light-blue text-[13px] nls-font-400 ml-[6px]">
              (${{ amount.amountInStable }})
            </span>
            <TooltipComponent
              :content="$t('message.outstanding-debt-tooltip', { fee: (modelValue.swapFee * 100).toFixed(2) })"
            />
          </p>
          <p class="mb-2 mt-[14px] flex justify-end align-center dark-text">
            {{ payout }} {{ LPN_Symbol }}
            <TooltipComponent :content="$t('message.usdc-payout-tooltip')" />
          </p>
          <p class="mb-2 mt-[14px] flex justify-end align-center dark-text">
            {{ positionLeft }}
          </p>
        </div>
      </div>
    </div>
    <div class="modal-send-receive-actions flex flex-col">
      <button class="btn btn-primary btn-large-primary text-center">
        {{ $t("message.close") }}
      </button>
      <div class="flex justify-between w-full text-light-blue text-[14px] my-2">
        <p>{{ $t("message.estimate-time") }}:</p>
        <p>~{{ NATIVE_NETWORK.leaseOpenEstimation }} {{ $t("message.min") }}</p>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import CurrencyField from "@/components/CurrencyField.vue";
import TooltipComponent from "../TooltipComponent.vue";

import type { MarketCloseComponentProps } from "@/types/component/MarketCloseComponentProps";
import { type PropType, computed } from "vue";

import { CoinPretty, Dec, Int, Coin } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useOracleStore } from "@/stores/oracle";
import { useWalletStore } from "@/stores/wallet";
import { NATIVE_NETWORK, PERMILLE, PERCENT, LPN_DECIMALS, LPN_Symbol } from "@/config/env";
import { calculateAditionalDebt } from "@/config/env";
import { useApplicationStore } from "@/stores/application";

const oracle = useOracleStore();
const wallet = useWalletStore();
const app = useApplicationStore();

const props = defineProps({
  modelValue: {
    type: Object as PropType<MarketCloseComponentProps>,
    required: true,
  },
});

const additionalInterest = () => {
  const data = props.modelValue.leaseInfo;
  if (data) {
    const principal_due = new Dec(data.principal_due.amount)
    const loanInterest = new Dec(data.loan_interest_rate / PERMILLE).add(new Dec(data.margin_interest_rate / PERCENT));
    const debt = calculateAditionalDebt(principal_due, loanInterest);

    return debt;
  }

  return new Dec(0)
}

const outStandingDebt = () => {
  const data = props.modelValue.leaseInfo;

  const debt = new Dec(data.principal_due.amount)
    .add(new Dec(data.previous_margin_due.amount))
    .add(new Dec(data.previous_interest_due.amount))
    .add(new Dec(data.current_margin_due.amount))
    .add(new Dec(data.current_interest_due.amount))
    .add(additionalInterest().roundUpDec())

  return debt;
}

const handleAmountChange = (value: string) => {
  props.modelValue.amount = value;
};

const formatLeasePosition = () => {
  const asset = wallet.getCurrencyByTicker(
    props.modelValue.leaseInfo.amount.ticker
  );
  return CurrencyUtils.convertMinimalDenomToDenom(
    props.modelValue.leaseInfo.amount.amount.toString(),
    asset!.ibcData as string,
    asset!.shortName,
    Number(asset!.decimal_digits)
  ).toString();
};

const total = computed(() => {
  const asset = wallet.getCurrencyByTicker(
    props.modelValue.leaseInfo.amount.ticker
  );
  return new Coin(asset!.ibcData as string, props.modelValue.leaseInfo.amount.amount);
})

const setAmount = (p: number) => {
  const { amount } = getAmount(p);
  const currency = wallet.getCurrencyByTicker(props.modelValue.leaseInfo.amount.ticker);
  props.modelValue.amount = amount.toString(Number(currency!.decimal_digits));

}

const setValue = () => {
  const a = amount.value.amount.toDec();
  const currency = wallet.getCurrencyByTicker(props.modelValue.leaseInfo.amount.ticker);

  props.modelValue.amount = a.toString(Number(currency!.decimal_digits));
}

const getAmount = (p: number) => {

  const currency = wallet.getCurrencyByTicker(props.modelValue.leaseInfo.amount.ticker);
  const amount = new Dec(props.modelValue.leaseInfo.amount.amount, Number(currency!.decimal_digits));
  const percent = new Dec(p).quo(new Dec(100));
  const amountcalculated = amount.mul(percent);

  return {
    amount: amountcalculated
  }

}

const hasSwapFee = computed(() => {
  const selectedCurrencyInfo = wallet.getCurrencyInfo(props.modelValue.selectedCurrency.balance.denom as string);
  const lpns = (app.lpn ?? []).map((item) => item.key);
  const isLpn =  lpns.find((lpn) => {
    const [lpnTicker]  = lpn!.split('@')
    return selectedCurrencyInfo.ticker == lpnTicker;
  });
  if (isLpn) {
    return false;
  }
  return true;
});

const payout = computed(() => {
  const currency = wallet.getCurrencyByTicker(props.modelValue.leaseInfo.amount.ticker);
  const price = new Dec(oracle.prices[currency!.ibcData as string]?.amount ?? 0);
  const value = new Dec(props.modelValue.amount.length == 0 ? 0 : props.modelValue.amount).mul(price);;

  const outStanding = getAmountValue('0').amountInStable.toDec();
  const payOutValue = value.sub(outStanding);

  if (payOutValue.isNegative()) {
    return '0.00'
  }

  return payOutValue.toString(Number(currency!.decimal_digits));

});

const positionLeft = computed(() => {
  const currency = wallet.getCurrencyByTicker(props.modelValue.leaseInfo.amount.ticker);
  const amount = new Dec(props.modelValue.leaseInfo.amount.amount, Number(currency!.decimal_digits));
  const value = new Dec(props.modelValue.amount.length == 0 ? 0 : props.modelValue.amount);
  const left = amount.sub(value);

  if (left.isNegative()) {
    return '0.00'
  }

  return `${left.toString(Number(currency!.decimal_digits))} ${currency!.shortName}`;

});

const amount = computed(() => {
  return getAmountValue(props.modelValue.amount == '' ? '0' : props.modelValue.amount)
});

const getAmountValue = (a: string) => {
  const info = wallet.getCurrencyInfo(props.modelValue.selectedCurrency.balance.denom);
  const selectedCurrency = wallet.getCurrencyByTicker(info.ticker);

  let amount = new Dec(a);
  const price = new Dec(oracle.prices[selectedCurrency!.ibcData as string]?.amount ?? 0);
  const { repayment, repaymentInStable } = getRepayment(100);

  const amountInStableInt = amount.mul(price).mul(new Dec(10).pow(new Int(LPN_DECIMALS))).truncate();
  const amountInt = amount.mul(new Dec(10).pow(new Int(info.coinDecimals))).truncate();

  const repaymentInt = repayment.mul(new Dec(10).pow(new Int(info.coinDecimals))).truncate();
  const repaymentInStableInt = repaymentInStable.mul(new Dec(10).pow(new Int(LPN_DECIMALS))).truncate();

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
        coinDenom: LPN_Symbol,
        coinMinimalDenom: LPN_Symbol,
        coinDecimals: Number(LPN_DECIMALS),
      },
      vStable
    ).trim(true).maxDecimals(4).hideDenom(true),
    amount: new CoinPretty(
      {
        coinDenom: info.shortName,
        coinMinimalDenom: info.coinMinimalDenom,
        coinDecimals: info.coinDecimals,
      },
      v
    )
  }
}

const getRepayment = (p: number) => {
  const amount = outStandingDebt();
  const currency = wallet.getCurrencyByTicker(props.modelValue.leaseInfo.principal_due.ticker);
  const denom = wallet.getIbcDenomBySymbol(currency!.symbol);
  const info = wallet.getCurrencyInfo(denom as string);
  const amountToRepay = CurrencyUtils.convertMinimalDenomToDenom(amount.toString(), info.coinMinimalDenom, info.coinDenom, info.coinDecimals).toDec();

  const percent = new Dec(p).quo(new Dec(100));
  let repaymentInStable = amountToRepay.mul(percent);

  const selectedCurrencyInfo = wallet.getCurrencyInfo(props.modelValue.selectedCurrency.balance.denom as string);
  const selectedCurrency = wallet.getCurrencyByTicker(selectedCurrencyInfo.ticker);
  const price = new Dec(oracle.prices[selectedCurrency!.ibcData as string].amount);
  const swap = hasSwapFee.value;

  if (swap) {
    repaymentInStable = repaymentInStable.add(repaymentInStable.mul(new Dec(props.modelValue.swapFee)));
  }

  const repayment = repaymentInStable.quo(price);

  return {
    repayment,
    repaymentInStable,
    selectedCurrencyInfo
  }

}

</script>
