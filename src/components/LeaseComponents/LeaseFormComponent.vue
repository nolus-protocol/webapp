<template>
  <!-- Input Area -->
  <form
    @submit.prevent="modelValue.onNextClick"
    class="modal-form"
  >
    <div class="modal-send-receive-input-area">

      <div class="block py-3 px-4 modal-balance radius-light text-left text-14 nls-font-400 text-primary mb-4">
        {{ $t('message.balance') }}:
        <a
          class="text-secondary nls-font-700 underline ml-2 cursor-pointer"
          @click.stop="setAmount"
        >
          {{ formatCurrentBalance(modelValue.selectedDownPaymentCurrency) }}
        </a>
      </div>

      <div class="block text-left">
        <div class="block">
          <CurrencyField
            id="amount-investment"
            :currency-options="balances"
            :error-msg="modelValue.downPaymentErrorMsg"
            :is-error="modelValue.downPaymentErrorMsg !== ''"
            :option="modelValue.selectedDownPaymentCurrency"
            :value="modelValue.downPayment"
            :label="$t('message.down-payment-uppercase')"
            name="amountInvestment"
            :tooltip="$t('message.down-payment-tooltip')"
            @input="handleDownPaymentChange($event)"
            @update-currency="(event) => (modelValue.selectedDownPaymentCurrency = event)"
          />
        </div>

        <div class="block mt-[25px]">
          <Picker
            class="scrollbar"
            :default-option="coinList[selectedIndex]"
            :options="coinList"
            :label="$t('message.asset-to-lease')"
            @update-selected="updateSelected"
          />
        </div>
      </div>

      <div class="flex mt-6 justify-between text-primary text-[14px] garet-medium">
        <p class="pb-0">
          {{ $t('message.margin') }}
        </p>
        <p>
          {{ calculateMarginAmount }}
        </p>
      </div>

      <RangeComponent
        class="py-4 my-2"
        :disabled="true"
        @on-drag="onDrag"
      ></RangeComponent>

      <!-- <div
        v-if="liqudStakeShow"
        class="flex items-center w-full checkbox-container"
      >
        <input
          id="liquid-stake"
          v-model="liqudStake"
          aria-describedby="liquid-stake"
          name="liquid-stake"
          type="checkbox"
        />
        <label
          class="dark-text flex select-none"
          for="liquid-stake"
        >
          {{ $t("message.liquid-stake") }}
          <TooltipComponent content="content" />
        </label>
      </div> -->

      <div class="flex justify-end">
        <div class="grow-3 text-right nls-font-500 text-14 dark-text">
          <p class="mb-2 mt-[14px] mr-5">
            {{ $t("message.borrowed") }}
          </p>
          <p class="mb-2 mt-[14px] mr-5">
            {{ $t("message.interest") }}
          </p>
          <p class="mb-2 mt-[14px] mr-5">
            {{ $t("message.liquidation-price") }}
          </p>
          <p class="mb-2 mt-[14px] mr-5">
            {{ $t("message.gas-service-fees") }}
          </p>
        </div>
        <div class="text-right nls-font-700 text-14">
          <p class="mb-2 mt-[14px] flex justify-end align-center dark-text">
            ${{ calculateLeaseAmount }}
            <TooltipComponent :content="$t('message.borrowed-tooltip')" />
          </p>
          <p class="mb-2 mt-[14px] flex justify-end align-center dark-text">
            {{ annualInterestRate ?? 0 }}%
            <TooltipComponent :content="$t('message.interest-tooltip')" />
          </p>
          <p class="mb-2 mt-[14px] flex justify-end align-center dark-text">
            $0
            <TooltipComponent :content="$t('message.liquidation-price-tooltip')" />
          </p>
          <p class="mb-2 mt-[14px] flex justify-end align-center dark-text">
            {{  calculateFee()  }}
            <TooltipComponent :content="$t('message.liquidation-price-tooltip')" />
          </p>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="modal-send-receive-actions flex flex-col">
      <button class="btn btn-primary btn-large-primary">
        {{ $t("message.lease") }}
      </button>
      <div class="flex justify-between w-full text-light-blue text-[14px] my-2">
        <p>{{ $t("message.estimate-time") }}:</p>
        <p>~{{ NATIVE_NETWORK.longOperationsEstimation }} {{ $t("message.sec") }}</p>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import CurrencyField from "@/components/CurrencyField.vue";
import TooltipComponent from "@/components/TooltipComponent.vue";
import Picker, { type PickerOption } from "../Picker.vue";
import RangeComponent from "../RangeComponent.vue";

import type { LeaseComponentProps } from "@/types/component/LeaseComponentProps";
import type { AssetBalance } from "@/stores/wallet/state";

import { onMounted, ref, type PropType } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { computed } from "vue";
import { useWalletStore } from "@/stores/wallet";
import { GROUPS, NATIVE_NETWORK } from "@/config/env";
import { coin } from "@cosmjs/amino";
import { Dec } from "@keplr-wallet/unit";

const wallet = useWalletStore();

const liqudStake = ref(false);
const liqudStakeShow = ref(false);
const selectedIndex = ref(0);

const liquiStakeTokens = {
  OSMO: {
    key: 'stOsmo'
  },
  ATOM: {
    key: 'stAtom'
  }
}

onMounted(() => {
  if (props.modelValue.dialogSelectedCurrency) {
    const index = coinList.findIndex((item) => {
      return item.value == props.modelValue.dialogSelectedCurrency
    });

    if (index > -1) {
      selectedIndex.value = index;
      props.modelValue.selectedCurrency = {
        balance: coin(0, coinList[index].value)
      }
    }
  }

  if (liquiStakeTokens[coinList[selectedIndex.value].ticker as keyof typeof liquiStakeTokens]) {
    liqudStakeShow.value = true;
  }
})

const props = defineProps({
  modelValue: {
    type: Object as PropType<LeaseComponentProps>,
    required: true,
  },
});

const handleDownPaymentChange = (value: string) => {
  props.modelValue.downPayment = value;
};

const balances = computed(() => {
  const balances = wallet.balances;
  return balances.filter((item) => {
    const currency = wallet.currencies[item.balance.denom];
    return currency.groups.includes(GROUPS.Lease) || currency.groups.includes(GROUPS.Lpn);
  });
});

const coinList = props.modelValue.currentBalance.filter((item) => {
  const currency = wallet.currencies[item.balance.denom];
  return currency.groups.includes(GROUPS.Lease);
}).map((item) => {
  const asset = wallet.getCurrencyInfo(item.balance.denom);
  return {
    ticker: asset.ticker,
    label: asset.coinAbbreviation,
    value: asset.coinMinimalDenom,
    icon: asset.coinIcon
  }
});

const annualInterestRate = computed(() => {
  return props.modelValue?.leaseApply?.annual_interest_rate;
});

const calculateLeaseAmount = computed(() => {
  const borrow = props.modelValue.leaseApply?.borrow;

  if (borrow) {
    const asset = wallet.getCurrencyByTicker(borrow.ticker);
    const ibcDenom = wallet.getIbcDenomBySymbol(asset.symbol);
    const info = wallet.getCurrencyInfo(ibcDenom as string);

    const token = CurrencyUtils.convertMinimalDenomToDenom(
      borrow.amount,
      info.coinMinimalDenom as string,
      info.coinDenom as string,
      info.coinDecimals
    );

    return token.hideDenom(true).toString();
  }

  return "0";
});

const calculateMarginAmount = computed(() => {
  const total = props.modelValue.leaseApply?.total;
  if (total) {
    const asset = wallet.getCurrencyByTicker(total.ticker);
    const ibcDenom = wallet.getIbcDenomBySymbol(asset.symbol);
    const info = wallet.getCurrencyInfo(ibcDenom as string);

    const token = CurrencyUtils.convertMinimalDenomToDenom(
      total.amount,
      info.coinMinimalDenom as string,
      info.coinDenom as string,
      info.coinDecimals
    );

    return token.toString();
  }

  const currency = props.modelValue.selectedCurrency;
  const info = wallet.getCurrencyInfo(currency.balance.denom);

  const token = CurrencyUtils.convertMinimalDenomToDenom(
    '0',
    info.coinMinimalDenom as string,
    info.coinDenom as string,
    info.coinDecimals
  );

  return token.toString();
});


const setAmount = () => {
  const asset = wallet.getCurrencyInfo(
    props.modelValue.selectedDownPaymentCurrency.balance.denom
  );
  const data = CurrencyUtils.convertMinimalDenomToDenom(
    props.modelValue.selectedDownPaymentCurrency.balance.amount.toString(),
    props.modelValue.selectedDownPaymentCurrency.balance.denom,
    asset.coinDenom,
    asset.coinDecimals
  );
  props.modelValue.downPayment = Number(data.toDec().toString()).toString();

};

const formatCurrentBalance = (selectedCurrency: AssetBalance) => {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = wallet.getCurrencyInfo(
      props.modelValue.selectedDownPaymentCurrency.balance.denom
    );
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.coinDenom,
      asset.coinDecimals
    ).toString();
  }
};

const updateSelected = (event: PickerOption) => {

  props.modelValue.selectedCurrency = {
    balance: coin(0, event.value)
  };

  const asset = wallet.getCurrencyInfo(event.value);

  if (liquiStakeTokens[asset.coinAbbreviation as keyof typeof liquiStakeTokens]) {
    liqudStakeShow.value = true;
  } else {
    liqudStakeShow.value = false;
    liqudStake.value = false;
  }

}

const calculateFee = () => {
  const fee = props.modelValue.fee;
  const amount = new Dec(fee.amount).toString();

  const { coinDenom, coinMinimalDenom, coinDecimals } = wallet.getCurrencyInfo(
    fee.denom
  );

  return CurrencyUtils.convertMinimalDenomToDenom(
    amount,
    coinMinimalDenom,
    coinDenom,
    coinDecimals
  );
}

const onDrag = (event: number) => {

}

</script>