<template>
  <!-- Input Area -->
  <form
    @submit.prevent="submit"
    class="px-10 py-6"
  >
    <div class="flex flex-col gap-4">
      <CurrencyField
        id="amount-investment"
        :balance="formatCurrentBalance(modelValue.selectedDownPaymentCurrency)"
        :currency-options="totalBalances"
        :error-msg="modelValue.downPaymentErrorMsg"
        :is-error="modelValue.downPaymentErrorMsg !== ''"
        :label="$t('message.down-payment-uppercase')"
        :option="modelValue.selectedDownPaymentCurrency"
        :tooltip="$t('message.down-payment-tooltip')"
        :total="modelValue.selectedDownPaymentCurrency.balance"
        :value="modelValue.downPayment"
        name="amountInvestment"
        @input="handleDownPaymentChange($event)"
        @update-currency="(event) => (modelValue.selectedDownPaymentCurrency = event)"
      />
      <Picker
        :default-option="coinList[selectedIndex]"
        :label="$t('message.asset-to-lease')"
        :options="coinList"
        class="scrollbar text-left"
        @update-selected="updateSelected"
      />
      <div class="flex justify-between text-[14px] font-medium text-neutral-typography-200">
        <p>
          {{ $t("message.margin") }}
        </p>
        <p class="flex">
          ~{{ calculateMarginAmount }}
          <Tooltip :content="$t('message.lease-swap-fee-tooltip', { swap_fee: swapFee * 100 })" />
        </p>
      </div>

      <RangeComponent
        :disabled="false"
        class="my-2 mr-[18px]"
        @on-drag="onDrag"
      >
      </RangeComponent>

      <div class="flex justify-end">
        <div class="grow-3 text-right text-14 font-medium text-neutral-typography-200">
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
        <div class="text-right text-14 font-semibold">
          <p class="align-center mb-2 mt-[14px] flex justify-end text-neutral-typography-200">
            <span>{{ borrowed }}</span>
            <Tooltip :content="$t('message.borrowed-tooltip')" />
          </p>
          <p class="align-center mb-2 mt-[14px] flex justify-end text-neutral-typography-200">
            <!-- <template v-if="freeInterest?.includes(selectedAssetDenom)">
              <span
                v-if="annualInterestRate"
                class="line-throught-gray text-[#8396B1]"
              >
                {{ annualInterestRate ?? 0 }}%
              </span>
              <span class="text-neutral-typography-200">0%</span>
            </template> -->
            <!-- <template v-else> -->
            <span class="text-[#8396B1]"> {{ annualInterestRate ?? 0 }}% </span>
            <!-- </template> -->

            <Tooltip :content="$t('message.interest-tooltip')" />
          </p>
          <p class="align-center mb-2 mt-[14px] flex justify-end text-neutral-typography-200">
            <span>{{ calculateLique }}</span>
            <span class="text-[#8396B1]"> &nbsp;|&nbsp; +{{ percentLique }} </span>
            <Tooltip :content="$t('message.liquidation-price-tooltip')" />
          </p>
        </div>
      </div>

      <div class="flex justify-end border-t border-border-color pt-2">
        <div class="grow-3 text-right text-14 font-medium text-neutral-typography-200">
          <p class="mr-5 mt-2 text-[12px]">{{ $t("message.price-per") }} {{ selectedAssetDenom.shortName }}</p>
          <p class="mr-5 mt-2 text-[12px]">
            {{ $t("message.swap-fee") }}
            <span class="font-normal text-[#8396B1]"> ({{ (swapFee * 100).toFixed(2) }}%) </span>
          </p>
        </div>
        <div class="text-right text-14 font-semibold">
          <p class="align-center mt-[8px] flex justify-end text-[12px] text-neutral-typography-200">
            {{ selectedAssetPrice }}
          </p>
          <p class="align-center mt-[8px] flex justify-end text-[12px] text-neutral-typography-200">
            -${{ downPaymentSwapFeeStable }}
          </p>
        </div>
      </div>
    </div>
    <!-- Actions -->
    <div class="mt-8 flex flex-col">
      <Button
        :label="$t('message.open-position')"
        severity="primary"
        size="large"
        type="submit"
      />
      <div class="my-2 flex w-full justify-between text-[14px] text-neutral-400">
        <p>{{ $t("message.estimate-time") }}:</p>
        <p>~{{ NATIVE_NETWORK.leaseOpenEstimation }} {{ $t("message.min") }}</p>
      </div>
    </div>
  </form>
</template>

<script lang="ts" setup>
import CurrencyField from "@/common/components/CurrencyField.vue";
import Picker, { type PickerOption } from "@/common/components/Picker.vue";
import RangeComponent from "@/common/components/RangeComponent.vue";
import { Button, Tooltip } from "web-components";

import type { LeaseComponentProps } from "./types/LeaseComponentProps";
import type { ExternalCurrency } from "@/common/types";

import { computed, nextTick, onMounted, onUnmounted, type PropType, ref, watch } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore } from "@/common/stores/wallet";
import { Dec } from "@keplr-wallet/unit";
import { useOracleStore } from "@/common/stores/oracle";
import { AppUtils, AssetUtils, LeaseUtils, SkipRouter } from "@/common/utils";
import { useApplicationStore } from "@/common/stores/application";

import { MONTHS, NATIVE_NETWORK, PERMILLE, PositionTypes, ProtocolsConfig } from "@/config/global";

const wallet = useWalletStore();
const app = useApplicationStore();
const oracle = useOracleStore();
const swapFee = ref(0);

const timeOut = 200;
let time: NodeJS.Timeout;
let freeInterest = ref<string[]>();

onMounted(async () => {
  freeInterest.value = await AppUtils.getFreeInterest();
  if (props.modelValue.dialogSelectedCurrency) {
    const [ticker, protocol] = props.modelValue.dialogSelectedCurrency.split("@");
    for (const balance of totalBalances.value) {
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
});

onUnmounted(() => {
  clearTimeout(time);
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
  () => [props.modelValue.leaseApply],
  (value) => {
    setSwapFee();
  }
);

const setSwapFee = async () => {
  clearTimeout(time);
  if (props.modelValue.downPaymentErrorMsg.length == 0 && Number(props.modelValue.downPayment) > 0) {
    time = setTimeout(async () => {
      const currency = props.modelValue.selectedDownPaymentCurrency;
      const lease = props.modelValue.selectedCurrency;
      const [_, p] = lease.key.split("@");

      const microAmount = CurrencyUtils.convertDenomToMinimalDenom(
        props.modelValue.downPayment,
        props.modelValue.selectedDownPaymentCurrency.ibcData,
        props.modelValue.selectedDownPaymentCurrency.decimal_digits
      ).amount.toString();

      const lpn = AssetUtils.getLpnByProtocol(p);
      let amountIn = 0;
      let amountOut = 0;
      const [r, r2] = await Promise.all([
        SkipRouter.getRoute(currency.ibcData, lease.ibcData, microAmount).then((data) => {
          amountIn += Number(data.usdAmountIn);
          amountOut += Number(data.usdAmountOut);

          return Number(data?.swapPriceImpactPercent ?? 0);
        }),
        SkipRouter.getRoute(lpn.ibcData, lease.ibcData, props.modelValue.leaseApply!.borrow.amount).then((data) => {
          amountIn += Number(data.usdAmountIn);
          amountOut += Number(data.usdAmountOut);

          return Number(data?.swapPriceImpactPercent ?? 0);
        })
      ]);
      const out_a = Math.max(amountOut, amountIn);
      const in_a = Math.min(amountOut, amountIn);

      const diff = out_a - in_a;
      const fee = diff / in_a;
      swapFee.value = fee;
    }, timeOut);
  }
};

const totalBalances = computed(() => {
  let currencies: ExternalCurrency[] = [];

  for (const protocol in ProtocolsConfig) {
    if (ProtocolsConfig[protocol].type == PositionTypes.short) {
      for (const c of ProtocolsConfig[protocol].currencies) {
        const item = app.currenciesData?.[`${c}@${protocol}`];
        let balance = wallet.balances.find((c) => c.balance.denom == item?.ibcData);
        if (currencies.findIndex((item) => item.balance.denom == balance?.balance.denom) == -1) {
          currencies.push({ ...item, balance: balance?.balance } as ExternalCurrency);
        }
      }
    }
  }

  return currencies;
});

const downPaymentSwapFeeStable = computed(() => {
  try {
    const asset = props.modelValue.selectedDownPaymentCurrency;
    const price = oracle.prices[asset.ibcData];

    const value = new Dec(props.modelValue.downPayment.length == 0 ? 0 : props.modelValue.downPayment)
      .mul(new Dec(price.amount))
      .mul(new Dec(swapFee.value));

    return value.toString(asset.decimal_digits);
  } catch (error) {
    return "0.00";
  }
});

function handleDownPaymentChange(value: string) {
  props.modelValue.downPayment = value;
}

const coinList = computed(() => {
  let currencies: ExternalCurrency[] = [];

  for (const protocol of app.protocols) {
    if (ProtocolsConfig[protocol].type == PositionTypes.short) {
      const c =
        app.lpn?.filter((item) => {
          const [_, p] = item.key.split("@");
          if (p == protocol) {
            return true;
          }
          return false;
        }) ?? [];
      currencies = [...currencies, ...c];
    }
  }

  return currencies.map((item) => ({
    key: item.key,
    ticker: item.ticker,
    label: item.shortName as string,
    value: item.ibcData,
    icon: item.icon as string
  }));
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
    const selectedDownPaymentCurrency = props.modelValue.selectedDownPaymentCurrency;
    const price = oracle.prices[selectedDownPaymentCurrency.key];
    const fee = new Dec(props.modelValue.downPayment.length == 0 ? 0 : props.modelValue.downPayment)
      .mul(new Dec(price.amount))
      .mul(new Dec(swapFee.value));

    const feeMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
      fee.toString(),
      selectedDownPaymentCurrency.ibcData as string,
      selectedDownPaymentCurrency.decimal_digits
    ).amount.toDec();

    const asset = AssetUtils.getCurrencyByTicker(total.ticker!);

    const t = new Dec(total.amount).sub(feeMinimalDenom);

    const token = CurrencyUtils.convertMinimalDenomToDenom(
      t.truncate().toString(),
      asset.ibcData as string,
      asset.shortName as string,
      asset.decimal_digits
    );

    return token.toString();
  }

  const [_, protocolKey] = props.modelValue.selectedCurrency.key.split("@");
  const stable = ProtocolsConfig[protocolKey].stable;
  const asset = app.currenciesData![`${stable}@${protocolKey}`];

  const token = CurrencyUtils.convertMinimalDenomToDenom(
    "0",
    asset.decimal_digits.toString(),
    asset.shortName as string,
    asset.decimal_digits
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

    return LeaseUtils.calculateLiquidationShort(stableAsset, unitAsset);
  }

  return new Dec(0);
}

const percentLique = computed(() => {
  const asset = props.modelValue.selectedCurrency;
  const [_, protocol] = asset.key.split("@");
  const lpn = AssetUtils.getLpnByProtocol(protocol);

  const price = new Dec(oracle.prices[lpn.key]?.amount ?? "0", asset.decimal_digits);
  const lprice = getLquidation();

  if (lprice.isZero() || price.isZero()) {
    return `0%`;
  }

  const p = price.sub(lprice).quo(price);

  return `${p.abs().mul(new Dec(100)).toString(0)}%`;
});

function onDrag(event: number) {
  const pos = new Dec(event / 100);
  props.modelValue.ltd = Number(pos.mul(new Dec(PERMILLE)).truncate().toString());
}

const borrowed = computed(() => {
  const borrow = props.modelValue.leaseApply?.borrow;

  const [_, protocol] = props.modelValue.selectedCurrency.key.split("@");
  const lpn = AssetUtils.getLpnByProtocol(protocol);

  if (borrow) {
    return CurrencyUtils.convertMinimalDenomToDenom(borrow.amount, lpn.symbol, lpn.shortName, lpn.decimal_digits);
  }

  return CurrencyUtils.convertMinimalDenomToDenom("0", lpn.symbol, lpn.shortName, lpn.decimal_digits);
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
  const [_, protocolKey] = asset.key.split("@");
  const lpn = AssetUtils.getLpnByProtocol(protocolKey);

  return lpn;
});

const selectedAssetPrice = computed(() => {
  const price = oracle.prices[selectedAssetDenom.value.key as string];

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
