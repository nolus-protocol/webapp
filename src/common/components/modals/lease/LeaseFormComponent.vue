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
import type { ExternalCurrency } from "@/common/types";

import { nextTick, onMounted, ref, type PropType } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { computed, watch } from "vue";
import { useWalletStore } from "@/common/stores/wallet";
import { Dec } from "@keplr-wallet/unit";
import { useOracleStore } from "@/common/stores/oracle";
import { AssetUtils, LeaseUtils } from "@/common/utils";
import { useApplicationStore } from "@/common/stores/application";
import { AppUtils } from "@/common/utils";
import { CurrencyDemapping, CurrencyMapping } from "@/config/currencies";

import {
  NATIVE_NETWORK,
  PERMILLE,
  IGNORE_LEASE_ASSETS,
  MONTHS,
  FREE_INTEREST_ASSETS,
  LPN_DECIMALS,
  ProtocolsConfig
} from "@/config/global";

const wallet = useWalletStore();
const app = useApplicationStore();
const oracle = useOracleStore();
const swapFee = ref(0);

onMounted(() => {
  if (props.modelValue.dialogSelectedCurrency) {
    const [ticker, protocol] = props.modelValue.dialogSelectedCurrency.split("@");
    for (const balance of balances.value) {
      const [t, p] = balance.key.split("@");
      if (p == protocol) {
        props.modelValue.selectedDownPaymentCurrency = balance;
        break;
      }
    }
    nextTick(() => {
      props.modelValue.selectedCurrency = app.currenciesData![props.modelValue.dialogSelectedCurrency!];
    });
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
  const asset = props.modelValue.selectedCurrency;
  swapFee.value = (await AppUtils.getSwapFee())[asset.ticker] ?? 0;
};

const totalBalances = computed(() => {
  const assets = wallet.balances.map((item) => {
    const currency = { ...AssetUtils.getCurrencyByDenom(item.balance.denom), balance: item.balance };
    return currency;
  });
  return assets;
});

const downPaymentSwapFeeStable = computed(() => {
  try {
    const asset = props.modelValue.selectedDownPaymentCurrency;
    const price = oracle.prices[asset.ibcData];
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
  return totalBalances.value.filter((item) => {
    const [ticker, protocol] = item.key.split("@");
    let cticker = ticker;

    if (!ProtocolsConfig[protocol].lease) {
      return false;
    }

    // if (IGNORE_LEASE_ASSETS.includes(ticker)) {
    //   return false;
    // }
    const lpns = ((app.lpn ?? []) as ExternalCurrency[]).map((item) => item.key as string);

    if (CurrencyMapping[ticker as keyof typeof CurrencyMapping]) {
      cticker = CurrencyMapping[ticker as keyof typeof CurrencyMapping]?.ticker;
    }
    return lpns.includes(item.key as string) || app.leasesCurrencies.includes(cticker);
  });
});

const coinList = computed(() => {
  return props.modelValue.currentBalance
    .filter((item) => {
      let [ticker, protocol] = item.key.split("@");

      const [_currency, downPaymentProtocol] = props.modelValue.selectedDownPaymentCurrency.key.split("@");

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
      return {
        key: item.key,
        ticker: item.ticker,
        label: item.shortName as string,
        value: item.ibcData,
        icon: item.icon as string
      };
    });
});

const selectedIndex = computed(() => {
  if (props.modelValue.selectedCurrency) {
    const index = coinList.value.findIndex((item) => {
      return item.key == props.modelValue.selectedCurrency.key;
    });

    return index > -1 ? index : 0;
  }

  return 0;
});

watch(
  () => props.modelValue.selectedDownPaymentCurrency,
  (a, b) => {
    let [_nticker, nprotocol] = a.key.split("@");
    let [_pticker, pprotocol] = b.key.split("@");
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
    const asset = AssetUtils.getCurrencyByTicker(total.ticker!);
    const t = new Dec(total.amount).mul(new Dec(1).sub(new Dec(swapFee.value)));

    const token = CurrencyUtils.convertMinimalDenomToDenom(
      t.truncate().toString(),
      asset.ibcData as string,
      asset.shortName as string,
      asset.decimal_digits
    );

    return token.toString();
  }

  const currency = props.modelValue.selectedCurrency;

  const token = CurrencyUtils.convertMinimalDenomToDenom(
    "0",
    currency.decimal_digits.toString(),
    currency.shortName as string,
    currency.decimal_digits
  );

  return token.toString();
});

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

function updateSelected(event: PickerOption) {
  const currency = app.currenciesData![event.key!];
  props.modelValue.selectedCurrency = {
    ...currency
  };
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
    const unitAssetInfo = AssetUtils.getCurrencyByTicker(lease.borrow.ticker!);
    const stableAssetInfo = AssetUtils.getCurrencyByTicker(lease.total.ticker!);

    const unitAsset = new Dec(getBorrowedAmount(), Number(unitAssetInfo!.decimal_digits));

    const stableAsset = new Dec(getTotalAmount(), Number(stableAssetInfo!.decimal_digits));
    return LeaseUtils.calculateLiquidation(unitAsset, stableAsset);
  }

  return new Dec(0);
}

const percentLique = computed(() => {
  const asset = props.modelValue.selectedCurrency;
  const price = new Dec(oracle.prices[asset!.ibcData as string]?.amount ?? "0", asset.decimal_digits);
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
    const ticker = CurrencyDemapping[borrow?.ticker!]?.ticker ?? borrow?.ticker;
    const protocol = AssetUtils.getProtocolByContract(props.modelValue.contractAddress);
    const info = app.currenciesData![`${ticker}@${protocol}`];
    if (info) {
      const token = CurrencyUtils.convertMinimalDenomToDenom(
        borrow.amount,
        info.ibcData,
        info.symbol,
        info.decimal_digits
      );
      return token.hideDenom(true).toString();
    }
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
  const asset = props.modelValue.selectedCurrency;
  return asset.shortName;
});

const selectedAssetPrice = computed(() => {
  const asset = props.modelValue.selectedCurrency;
  const price = oracle.prices[asset!.ibcData as string];
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
