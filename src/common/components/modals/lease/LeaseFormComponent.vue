<template>
  <!-- Input Area -->
  <form
    @submit.prevent="submit"
    class="modal-form"
  >
    <div class="modal-send-receive-input-area">
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
            :balance="formatCurrentBalance(modelValue.selectedDownPaymentCurrency)"
            :total="modelValue.selectedDownPaymentCurrency.balance"
            @input="handleDownPaymentChange($event)"
            @update-currency="(event) => (modelValue.selectedDownPaymentCurrency = event)"
          />
        </div>
        <div class="mt-[12px] block">
          <Picker
            class="scrollbar"
            :default-option="coinList[selectedIndex]"
            :options="coinList"
            :label="$t('message.asset-to-lease')"
            @update-selected="updateSelected"
          />
        </div>
      </div>

      <div class="garet-medium mt-6 flex justify-between text-[14px] text-primary">
        <p class="pb-0">
          {{ $t("message.margin") }}
        </p>
        <p class="flex">
          ~{{ calculateMarginAmount }}
          <TooltipComponent :content="$t('message.lease-swap-fee-tooltip', { swap_fee: swapFee * 100 })" />
        </p>
      </div>

      <RangeComponent
        class="my-2 py-4"
        :disabled="false"
        @on-drag="onDrag"
      >
      </RangeComponent>

      <div class="flex justify-end">
        <div class="grow-3 nls-font-500 dark-text text-right text-14">
          <p class="mb-2 mr-5 mt-[14px]">
            {{ $t("message.borrowed") }}
          </p>
          <p class="mb-2 mr-5 mt-[14px]">
            {{ $t("message.interest") }}
          </p>
          <p class="mb-2 mr-5 mt-[14px]">
            {{ $t("message.liquidation-price") }}
          </p>
        </div>
        <div class="nls-font-700 text-right text-14">
          <p class="align-center dark-text mb-2 mt-[14px] flex justify-end">
            ${{ borrowed }}
            <TooltipComponent :content="$t('message.borrowed-tooltip')" />
          </p>
          <p class="align-center dark-text mb-2 mt-[14px] flex justify-end">
            <template v-if="FREE_INTEREST_ASSETS.includes(selectedAssetDenom)">
              <span
                v-if="annualInterestRate"
                class="line-throught-gray text-[#8396B1]"
              >
                {{ annualInterestRate ?? 0 }}%
              </span>
              <span class="dark-text">0%</span>
            </template>
            <template v-else>
              <span class="text-[#8396B1]"> {{ annualInterestRate ?? 0 }}% </span>
            </template>

            <TooltipComponent :content="$t('message.interest-tooltip')" />
          </p>
          <p class="align-center dark-text mb-2 mt-[14px] flex justify-end">
            {{ calculateLique }}
            <span class="text-[#8396B1]"> &nbsp;|&nbsp; {{ percentLique }} </span>
            <TooltipComponent :content="$t('message.liquidation-price-tooltip')" />
          </p>
        </div>
      </div>

      <div class="border-standart flex justify-end border-t pt-2">
        <div class="grow-3 nls-font-500 dark-text text-right text-14">
          <p class="mr-5 mt-2 text-[12px]">{{ $t("message.price-per") }} {{ selectedAssetDenom }}</p>
          <p class="mr-5 mt-2 text-[12px]">
            {{ $t("message.swap-fee") }}
            <span class="nls-font-400 text-[#8396B1]"> ({{ (swapFee * 100).toFixed(2) }}%) </span>
          </p>
        </div>
        <div class="nls-font-700 text-right text-14">
          <p class="align-center dark-text mt-[5px] flex justify-end text-[12px]">
            {{ selectedAssetPrice }}
          </p>
          <p class="align-center dark-text mt-[5px] flex justify-end text-[12px]">-${{ downPaymentSwapFeeStable }}</p>
        </div>
      </div>
    </div>
    <!-- Actions -->
    <div class="modal-send-receive-actions flex flex-col">
      <button class="btn btn-primary btn-large-primary">
        {{ $t("message.open-position") }}
      </button>
      <div class="my-2 flex w-full justify-between text-[14px] text-light-blue">
        <p>{{ $t("message.estimate-time") }}:</p>
        <p>~{{ NATIVE_NETWORK.leaseOpenEstimation }} {{ $t("message.min") }}</p>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import CurrencyField from "@/common/components/CurrencyField.vue";
import TooltipComponent from "@/common/components/TooltipComponent.vue";
import Picker, { type PickerOption } from "@/common/components/Picker.vue";
import RangeComponent from "@/common/components/RangeComponent.vue";

import type { LeaseComponentProps } from "./types/LeaseComponentProps";
import type { AssetBalance } from "@/common/stores/wallet/types";
import type { ExternalCurrency } from "@/common/types";

import { onMounted, ref, type PropType } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { computed, watch } from "vue";
import { useWalletStore } from "@/common/stores/wallet";
import { coin } from "@cosmjs/amino";
import { Dec } from "@keplr-wallet/unit";
import { useOracleStore } from "@/common/stores/oracle";
import { AssetUtils, LeaseUtils } from "@/common/utils";
import { useApplicationStore } from "@/common/stores/application";
import { AppUtils } from "@/common/utils";

import {
  NATIVE_NETWORK,
  PERMILLE,
  IGNORE_LEASE_ASSETS,
  CurrencyMapping,
  MONTHS,
  FREE_INTEREST_ASSETS,
  LPN_DECIMALS
} from "@/config/global";

const wallet = useWalletStore();
const app = useApplicationStore();

const liqudStake = ref(false);
const liqudStakeShow = ref(false);
const oracle = useOracleStore();
const swapFee = ref(0);

const liquiStakeTokens = {
  OSMO: {
    key: "stOsmo"
  },
  ATOM: {
    key: "stAtom"
  }
};

onMounted(() => {
  if (props.modelValue.dialogSelectedCurrency) {
    const index = coinList.value.findIndex((item) => {
      return item.value == props.modelValue.dialogSelectedCurrency;
    });

    if (index > -1) {
      props.modelValue.selectedCurrency = {
        balance: coin(0, coinList.value[index].value)
      };
    }
  }

  if (liquiStakeTokens[coinList.value[selectedIndex.value].ticker as keyof typeof liquiStakeTokens]) {
    liqudStakeShow.value = true;
  }

  setSwapFee();
});

const props = defineProps({
  modelValue: {
    type: Object as PropType<LeaseComponentProps>,
    required: true
  }
});

const borrowValue = ref(props.modelValue.leaseApply?.borrow);
const tottalValue = ref(props.modelValue.leaseApply?.total);

watch(
  () => props.modelValue.leaseApply,
  (value) => {
    if (value) {
      borrowValue.value = value.borrow;
      tottalValue.value = value.total;
    }
  }
);

watch(
  () => props.modelValue.selectedCurrency,
  (value) => {
    setSwapFee();
  }
);

const setSwapFee = async () => {
  const asset = wallet.getCurrencyInfo(props.modelValue.selectedCurrency.balance.denom);
  swapFee.value = (await AppUtils.getSwapFee())[asset.ticker] ?? 0;
};

const downPaymentSwapFeeStable = computed(() => {
  try {
    const asset = wallet.getCurrencyInfo(props.modelValue.selectedDownPaymentCurrency.balance.denom);
    const price = oracle.prices[asset.coinMinimalDenom];
    const borrow = new Dec(props.modelValue.leaseApply?.borrow?.amount ?? 0, LPN_DECIMALS);

    const value = new Dec(props.modelValue.downPayment.length == 0 ? 0 : props.modelValue.downPayment)
      .mul(new Dec(price.amount))
      .add(borrow)
      .mul(new Dec(swapFee.value));

    return value.toString(LPN_DECIMALS);
  } catch (error) {
    return "0.00";
  }
});

function handleDownPaymentChange(value: string) {
  props.modelValue.downPayment = value;
}

const balances = computed(() => {
  const balances = wallet.balances;
  return balances.filter((item) => {
    const currency = wallet.currencies[item.balance.denom];
    if (IGNORE_LEASE_ASSETS.includes(currency.ticker)) {
      return false;
    }
    const lpns = ((app.lpn ?? []) as ExternalCurrency[]).map((item) => item.key as string);
    let [cticker] = currency.ticker.split("@");

    if (CurrencyMapping[cticker as keyof typeof CurrencyMapping]) {
      cticker = CurrencyMapping[cticker as keyof typeof CurrencyMapping]?.ticker;
    }

    return lpns.includes(currency.ticker as string) || app.leasesCurrencies.includes(cticker);
  });
});

const coinList = computed(() => {
  return props.modelValue.currentBalance
    .filter((item) => {
      const currency = wallet.currencies[item.balance.denom];
      let [ticker, protocol] = currency.ticker.split("@");

      const downPaymentCurrency = wallet.currencies[props.modelValue.selectedDownPaymentCurrency.balance.denom];
      const [_currency, downPaymentProtocol] = downPaymentCurrency.ticker.split("@");

      if (downPaymentProtocol != protocol) {
        return false;
      }

      if (CurrencyMapping[ticker as keyof typeof CurrencyMapping]) {
        ticker = CurrencyMapping[ticker as keyof typeof CurrencyMapping]?.ticker;
      }

      if (IGNORE_LEASE_ASSETS.includes(ticker)) {
        return false;
      }
      return app.leasesCurrencies.includes(ticker);
    })
    .map((item) => {
      const asset = wallet.getCurrencyInfo(item.balance.denom);
      return {
        ticker: asset.ticker,
        label: asset.shortName as string,
        value: asset.coinMinimalDenom,
        icon: asset.coinIcon as string
      };
    });
});

const selectedIndex = computed(() => {
  if (props.modelValue.selectedCurrency) {
    const index = coinList.value.findIndex((item) => {
      return item.value == props.modelValue.selectedCurrency.balance.denom;
    });

    return index > -1 ? index : 0;
  }

  return 0;
});

watch(
  () => props.modelValue.selectedDownPaymentCurrency,
  (a, b) => {
    const next = wallet.currencies[a.balance.denom];
    const prev = wallet.currencies[b.balance.denom];

    let [_nticker, nprotocol] = next.ticker.split("@");
    let [_pticker, pprotocol] = prev.ticker.split("@");
    if (nprotocol != pprotocol) {
      updateSelected(coinList.value[0]);
    }
  }
);

const annualInterestRate = computed(() => {
  return (
    ((props.modelValue?.leaseApply?.annual_interest_rate ?? 0) +
      (props.modelValue?.leaseApply?.annual_interest_rate_margin ?? 0)) /
    MONTHS
  ).toFixed(2);
});

const calculateMarginAmount = computed(() => {
  const total = props.modelValue.leaseApply?.total;

  if (total) {
    const asset = wallet.getCurrencyByTicker(total.ticker);
    const ibcDenom = wallet.getIbcDenomBySymbol(asset!.symbol);
    const info = wallet.getCurrencyInfo(ibcDenom as string);

    const t = new Dec(total.amount).mul(new Dec(1).sub(new Dec(swapFee.value)));

    const token = CurrencyUtils.convertMinimalDenomToDenom(
      t.truncate().toString(),
      info.coinMinimalDenom as string,
      info.shortName as string,
      info.coinDecimals
    );

    return token.toString();
  }

  const currency = props.modelValue.selectedCurrency;
  const info = wallet.getCurrencyInfo(currency.balance.denom);

  const token = CurrencyUtils.convertMinimalDenomToDenom(
    "0",
    info.coinMinimalDenom as string,
    info.shortName as string,
    info.coinDecimals
  );

  return token.toString();
});

function formatCurrentBalance(selectedCurrency: AssetBalance) {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = wallet.getCurrencyInfo(props.modelValue.selectedDownPaymentCurrency.balance.denom);
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.shortName,
      asset.coinDecimals
    ).toString();
  }
}

function updateSelected(event: PickerOption) {
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

const calculateLique = computed(() => {
  const d = getLquidation();
  if (d.isZero()) {
    return `$${d.toString(2)}`;
  }
  return `$${d.toString(4)}`;
});

function getLquidation() {
  const lease = props.modelValue.leaseApply;
  if (lease) {
    const unitAssetInfo = wallet.getCurrencyByTicker(lease.borrow.ticker);
    const stableAssetInfo = wallet.getCurrencyByTicker(lease.total.ticker);

    const unitAsset = new Dec(getBorrowedAmount(), Number(unitAssetInfo!.decimal_digits));

    const stableAsset = new Dec(getTotalAmount(), Number(stableAssetInfo!.decimal_digits));
    return LeaseUtils.calculateLiquidation(unitAsset, stableAsset);
  }

  return new Dec(0);
}

const percentLique = computed(() => {
  const asset = wallet.getCurrencyInfo(props.modelValue.selectedCurrency.balance.denom);
  const currecy = wallet.getCurrencyByTicker(asset.ticker);
  const price = new Dec(oracle.prices[currecy!.ibcData as string]?.amount ?? "0", asset.coinDecimals);
  const lprice = getLquidation();

  if (lprice.isZero() || price.isZero()) {
    return `0%`;
  }

  const p = price.sub(lprice).quo(price);

  return `-${p.mul(new Dec(100)).toString(0)}%`;
});

function onDrag(event: number) {
  const pos = new Dec(event / 100);
  props.modelValue.ltd = Number(pos.mul(new Dec(PERMILLE)).truncate().toString());
}

const borrowed = computed(() => {
  const borrow = props.modelValue.leaseApply?.borrow;

  if (borrow) {
    const info = AssetUtils.getAssetInfo(borrow.ticker);

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

function getBorrowedAmount() {
  const borrow = props.modelValue.leaseApply?.borrow;

  if (borrow) {
    const amount = new Dec(borrow.amount).truncate();
    return amount;
  }

  return new Dec(0).truncate();
}

function getTotalAmount() {
  const total = props.modelValue.leaseApply?.total;
  return new Dec(total?.amount ?? 0).truncate();
}

const selectedAssetDenom = computed(() => {
  const asset = wallet.getCurrencyInfo(props.modelValue.selectedCurrency.balance.denom);
  return asset.shortName;
});

const selectedAssetPrice = computed(() => {
  const asset = wallet.getCurrencyInfo(props.modelValue.selectedCurrency.balance.denom);
  const currecy = wallet.getCurrencyByTicker(asset.ticker);
  const price = oracle.prices[currecy!.ibcData as string];
  const p = new Dec(price?.amount ?? 0);
  const fee = new Dec(1 + swapFee.value);

  return CurrencyUtils.formatPrice(p.mul(fee).toString());
});

function submit() {
  const lease = props.modelValue.leaseApply;

  if (lease) {
    props.modelValue.onNextClick(selectedAssetPrice.value.toDec().toString());
  }
}
</script>
