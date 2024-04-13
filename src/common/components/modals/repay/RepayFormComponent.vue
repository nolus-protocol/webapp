<template>
  <form
    @submit.prevent="modelValue.onNextClick"
    class="w-full"
  >
    <div class="mt-10 block px-5 py-[5px] text-left lg:px-10">
      <CurrencyField
        id="repayBalance"
        name="repayBalance"
        :label="$t('message.amount-field')"
        :value="modelValue.amount"
        :currency-options="modelValue.currentBalance"
        :option="modelValue.selectedCurrency"
        :error-msg="modelValue.amountErrorMsg"
        :is-error="modelValue.amountErrorMsg !== ''"
        :balance="formatCurrentBalance(modelValue.selectedCurrency)"
        :total="modelValue.selectedCurrency.balance"
        @input="handleAmountChange($event)"
        @update-currency="(event) => (modelValue.selectedCurrency = event)"
      />
      <div class="mt-[12px] flex justify-end">
        <div class="grow-3 nls-font-500 dark-text text-right text-14">
          <p class="mb-2 mr-5 mt-[14px]">{{ $t("message.repayment-amount") }}:</p>
        </div>
        <div class="nls-font-700 text-right text-14">
          <p class="align-center dark-text mb-2 mt-[14px] flex justify-end">
            <a
              @click="setRepayAmount"
              class="cursor-pointer select-none"
            >
              {{ amount.amount }}
              <span class="nls-font-400 ml-[6px] text-[13px] text-light-blue"> (${{ amount.amountInStable }}) </span>
            </a>
            <TooltipComponent
              :content="$t('message.outstanding-debt-tooltip', { fee: (modelValue.swapFee * 100).toFixed(2) })"
            />
          </p>
        </div>
      </div>
    </div>
    <div class="modal-send-receive-actions flex flex-col">
      <button class="btn btn-primary btn-large-primary text-center">
        {{ $t("message.repay") }}
      </button>
      <div class="my-2 flex w-full justify-between text-[14px] text-light-blue">
        <p>{{ $t("message.estimate-time") }}:</p>
        <p>~{{ NATIVE_NETWORK.longOperationsEstimation }} {{ $t("message.sec") }}</p>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import CurrencyField from "@/common/components/CurrencyField.vue";
import TooltipComponent from "@/common/components/TooltipComponent.vue";

import type { RepayComponentProps } from "./types";
import type { AssetBalance } from "@/common/stores/wallet/types";
import { type PropType, computed } from "vue";

import { CoinPretty, Dec, Int } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useOracleStore } from "@/common/stores/oracle";
import { useWalletStore } from "@/common/stores/wallet";
import { NATIVE_NETWORK, PERMILLE, PERCENT, LPN_DECIMALS, LPN_Symbol } from "@/config/global";
import { useApplicationStore } from "@/common/stores/application";
import { LeaseUtils } from "@/common/utils";

const oracle = useOracleStore();
const wallet = useWalletStore();
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

function formatCurrentBalance(selectedCurrency: AssetBalance) {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = wallet.getCurrencyInfo(selectedCurrency.balance.denom);
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.shortName,
      asset.coinDecimals
    ).toString();
  }
}

function setRepayment(p: number) {
  const { repayment, selectedCurrencyInfo } = getRepayment(p);
  props.modelValue.amount = repayment.toString(selectedCurrencyInfo.coinDecimals + 1);
}

function getRepayment(p: number) {
  const amount = outStandingDebt();
  const currency = wallet.getCurrencyByTicker(props.modelValue.leaseInfo.principal_due.ticker);
  const denom = wallet.getIbcDenomBySymbol(currency!.symbol);
  const info = wallet.getCurrencyInfo(denom as string);
  const amountToRepay = CurrencyUtils.convertMinimalDenomToDenom(
    amount.toString(),
    info.coinMinimalDenom,
    info.coinDenom,
    info.coinDecimals
  ).toDec();

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
  };
}

const hasSwapFee = computed(() => {
  const selectedCurrencyInfo = wallet.getCurrencyInfo(props.modelValue.selectedCurrency.balance.denom as string);
  const lpns = (app.lpn ?? []).map((item) => item.key);
  const isLpn = lpns.find((lpn) => {
    const [lpnTicker] = lpn!.split("@");
    return selectedCurrencyInfo.ticker == lpnTicker;
  });
  if (isLpn) {
    return false;
  }
  return true;
});

const amount = computed(() => {
  const info = wallet.getCurrencyInfo(props.modelValue.selectedCurrency.balance.denom);
  const selectedCurrency = wallet.getCurrencyByTicker(info.ticker);
  let amount = new Dec(props.modelValue.amount == "" ? 0 : props.modelValue.amount);
  const price = new Dec(oracle.prices[selectedCurrency!.ibcData as string]?.amount ?? 0);
  const { repayment, repaymentInStable } = getRepayment(100);

  const amountInStableInt = amount
    .mul(price)
    .mul(new Dec(10).pow(new Int(LPN_DECIMALS)))
    .truncate();
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
        coinDecimals: Number(LPN_DECIMALS)
      },
      vStable
    )
      .trim(true)
      .maxDecimals(4)
      .hideDenom(true),
    amount: new CoinPretty(
      {
        coinDenom: info.shortName,
        coinMinimalDenom: info.coinMinimalDenom,
        coinDecimals: info.coinDecimals
      },
      v
    )
  };
});
</script>
