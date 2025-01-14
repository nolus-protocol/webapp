<template>
  <Dialog
    ref="dialog"
    :title="$t(`message.close`)"
    showClose
    :disable-close="true"
    @close-dialog="router.push(`/${RouteNames.LEASES}/${route.params.protocol}/${route.params.id}`)"
  >
    <template v-slot:content>
      <hr class="border-border-color" />
      <div class="flex flex-col gap-4 px-6 py-4">
        <AdvancedFormControl
          id="repay-close"
          labelAdvanced
          :currencyOptions="assets"
          :disabled-currency-picker="isLoading"
          :disabled-input-field="isLoading"
          :selectedCurrencyOption="assets[0]"
          :calculated-balance="calculatedBalance"
          :value-only="amount"
          @input="handleAmountChange"
          :error-msg="amountErrorMsg"
          placeholder="0"
        >
          <template v-slot:label>
            <div class="flex items-center gap-1">
              {{ $t("message.amount-to-close") }}
              <span class="flex items-center gap-1 font-normal"
                ><img :src="currency?.icon" /> {{ currency?.label }}</span
              >
              <Tooltip content="This is a tooltip"
                ><SvgIcon
                  name="help"
                  class="fill-icon-link"
              /></Tooltip>
            </div>
          </template>
        </AdvancedFormControl>
        <div class="mt-2 px-4 py-3">
          <Slider
            :min-position="sliderValue"
            :max-position="100"
            :mid-position="midPosition"
            :value="sliderValue"
            @on-drag="onSetAmount"
            :label-left="`0`"
            :label-mid="`${$t('message.debt')} (~${debt?.amount?.toString() ?? ''})`"
            :label-right="`${$t('message.full-position')} (~${AssetUtils.formatNumber(total?.toString(currency?.decimal_digits), currency?.decimal_digits) ?? ''})`"
            @click-right-label="() => onSetAmount(100)"
            @click-left-label="() => onSetAmount(0)"
            @click-mid-label="
              () => {
                handleAmountChange(debt?.amount?.toString() ?? '0');
              }
            "
          />
        </div>
      </div>
      <hr class="border-border-color" />
      <div class="flex flex-col gap-3 px-6 py-4 text-typography-default">
        <span class="text-16 font-semibold">{{ $t("message.preview") }}</span>
        <div class="flex items-center gap-2 text-14">
          <SvgIcon
            name="list-sparkle"
            class="fill-icon-secondary"
          />
          <span class="text-typography-default">{{ $t("message.preview-input") }}</span>
        </div>
      </div>
      <hr class="border-border-color" />
      <div class="flex justify-end px-6 py-4">
        <Button
          :label="$t('message.show-transaction-details')"
          severity="tertiary"
          icon="plus"
          iconPosition="left"
          size="small"
          class="text-icon-default"
        />
      </div>
      <hr class="border-border-color" />
      <div class="flex flex-col gap-2 p-6">
        <Button
          size="large"
          severity="primary"
          :label="$t(`message.close-btn-label`)"
          @click="onSendClick"
          :disabled="disabled"
          :loading="loading"
        />
        <p class="text-center text-12 text-typography-secondary">
          {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.longOperationsEstimation }}{{ $t("message.sec") }}
        </p>
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { AdvancedFormControl, Button, Dialog, Tooltip, Slider, SvgIcon, ToastType } from "web-components";
import { RouteNames } from "@/router";

import { useWalletStore } from "@/common/stores/wallet";
import { useApplicationStore } from "@/common/stores/application";
import { useOracleStore } from "@/common/stores/oracle";
import { AssetUtils, getMicroAmount, LeaseUtils, Logger, walletOperation } from "@/common/utils";
import { NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../../config/global/network";
import type { ExternalCurrency } from "@/common/types";
import { minimumLeaseAmount, PERCENT, PERMILLE, PositionTypes, ProtocolsConfig } from "@/config/global";
import { CurrencyDemapping } from "@/config/currencies";
import type { AssetBalance } from "@/common/stores/wallet/types";
import { CoinPretty, Dec, Int } from "@keplr-wallet/unit";
import { useLease, useLeaseConfig } from "@/common/composables";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { SkipRouter } from "@/common/utils/SkipRoute";
import { useI18n } from "vue-i18n";
import type { Coin } from "@cosmjs/proto-signing";
import { Lease } from "@nolus/nolusjs/build/contracts";

const timeOut = 250;
let time: NodeJS.Timeout;

const route = useRoute();
const router = useRouter();
const oracle = useOracleStore();
const walletStore = useWalletStore();
const app = useApplicationStore();
const i18n = useI18n();

const amount = ref("");
const amountErrorMsg = ref("");
const selectedCurrency = ref(0);
const isLoading = ref(false);
const swapFee = ref(0);
const sliderValue = ref(0);
const loading = ref(false);
const disabled = ref(false);
const reload = inject("reload", () => {});
const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});

const dialog = ref<typeof Dialog | null>(null);
const { lease } = useLease(route.params.id as string, route.params.protocol as string, (error) => {
  Logger.error(error);
});
const { config } = useLeaseConfig(
  (route.params.protocol as string).toUpperCase() as string,
  (error: Error | any) => {}
);

onMounted(() => {
  dialog?.value?.show();
});

onBeforeUnmount(() => {
  dialog?.value?.close();
});
const currency = computed(() => {
  return assets.value[selectedCurrency.value];
});

function onSetAmount(percent: number) {
  sliderValue.value = percent;
  const a = total.value.mul(new Dec(percent).quo(new Dec(100)));
  amount.value = a.toString(currency!.value.decimal_digits);
}

const assets = computed(() => {
  const data = [];

  if (lease.value) {
    const ticker =
      CurrencyDemapping[lease.value?.leaseStatus?.opened?.amount?.ticker!]?.ticker ??
      lease.value?.leaseStatus?.opened?.amount?.ticker;
    const asset = app.currenciesData![`${ticker}@${lease.value!.protocol}`];
    const denom = (asset as ExternalCurrency).ibcData ?? (asset as AssetBalance).from;

    data.push({
      name: asset.name,
      icon: asset.icon,
      value: denom,
      label: asset.shortName,
      ibcData: asset.ibcData,
      shortName: asset.shortName,
      decimal_digits: asset.decimal_digits!,
      key: asset.key,
      ticker: asset.ticker
    });
  }

  return data;
});

const calculatedBalance = computed(() => {
  const asset = assets.value[selectedCurrency.value];
  if (!asset) {
    return `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber("0.00", NATIVE_CURRENCY.maximumFractionDigits)}`;
  }
  const price = new Dec(oracle.prices?.[asset.key!]?.amount ?? 0);
  const v = amount?.value?.length ? amount?.value : "0";
  const stable = price.mul(new Dec(v));
  return `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`;
});

const midPosition = computed(() => {
  const d = debt.value?.amount.toDec() ?? new Dec(0);

  if (total.value.isZero()) {
    return 0;
  }

  return Number(d.quo(total.value).mul(new Dec(100)).toString());
});

const total = computed(() => {
  return new Dec(lease.value?.leaseStatus.opened?.amount.amount ?? 0, currency.value?.decimal_digits);
});

function handleAmountChange(event: string) {
  amount.value = event;
  if (amount.value != "") {
    let percent = new Dec(amount.value).quo(total.value).mul(new Dec(100));
    if (percent.isNegative()) {
      percent = new Dec(0);
    }
    if (percent.gt(new Dec(100))) {
      percent = new Dec(100);
    }
    sliderValue.value = Number(percent.toString(0));
  }
}

const debt = computed(() => {
  const selectedCurrency = currency.value;
  if (selectedCurrency) {
    const { repayment, repaymentInStable } = getRepayment(100)!;
    const repaymentInt = repayment.mul(new Dec(10).pow(new Int(selectedCurrency.decimal_digits))).truncate();

    return {
      amountInStable: new CoinPretty(
        {
          coinDenom: selectedCurrency.shortName,
          coinMinimalDenom: selectedCurrency.ibcData,
          coinDecimals: selectedCurrency.decimal_digits
        },
        repaymentInStable
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
        repaymentInt
      ).hideDenom(true)
    };
  }
});

function getRepayment(p: number) {
  const data = lease.value?.leaseStatus.opened!;

  const amount = outStandingDebt();
  const ticker = CurrencyDemapping[data.principal_due.ticker!]?.ticker ?? data.principal_due.ticker;
  const c = app.currenciesData![`${ticker!}@${lease.value!.protocol}`];

  const amountToRepay = CurrencyUtils.convertMinimalDenomToDenom(
    amount.toString(),
    c.shortName,
    c.ibcData,
    c.decimal_digits
  ).toDec();

  const percent = new Dec(p).quo(new Dec(100));
  let repaymentInStable = amountToRepay.mul(percent);
  const selectedCurrency = currency.value;

  if (swapFee.value) {
    repaymentInStable = repaymentInStable.add(repaymentInStable.mul(new Dec(swapFee.value)));
  }

  switch (ProtocolsConfig[lease.value!.protocol].type) {
    case PositionTypes.short: {
      let lpn = AssetUtils.getLpnByProtocol(lease.value!.protocol);
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

function outStandingDebt() {
  const data = lease.value?.leaseStatus.opened;

  if (data) {
    const debt = new Dec(data.principal_due.amount)
      .add(new Dec(data.overdue_margin.amount))
      .add(new Dec(data.overdue_interest.amount))
      .add(new Dec(data.due_margin.amount))
      .add(new Dec(data.due_interest.amount))
      .add(additionalInterest().roundUpDec());

    return debt;
  }
  return new Dec(0);
}

function additionalInterest() {
  const data = lease.value?.leaseStatus.opened;
  if (data) {
    const principal_due = new Dec(data.principal_due.amount);
    const loanInterest = new Dec(data.loan_interest_rate / PERMILLE).add(new Dec(data.margin_interest_rate / PERCENT));
    const debt = LeaseUtils.calculateAditionalDebt(principal_due, loanInterest);

    return debt;
  }

  return new Dec(0);
}

const setSwapFee = async () => {
  clearTimeout(time);
  time = setTimeout(async () => {
    const lease_currency = currency.value;
    const currecy = app.currenciesData![`${lease.value?.leaseData!.leasePositionTicker}@${lease.value!.protocol}`];

    const microAmount = CurrencyUtils.convertDenomToMinimalDenom(
      debt.value!.amount.toDec().toString(),
      lease_currency.ibcData,
      lease_currency.decimal_digits
    ).amount.toString();

    let amountIn = 0;
    let amountOut = 0;
    const [r] = await Promise.all([
      SkipRouter.getRoute(lease_currency.ibcData, currecy.ibcData, microAmount).then((data) => {
        amountIn += Number(data.usdAmountIn ?? 0);
        amountOut += Number(data.usdAmountOut ?? 0);

        return Number(data?.swapPriceImpactPercent ?? 0);
      })
    ]);

    const out_a = Math.max(amountOut, amountIn);
    const in_a = Math.min(amountOut, amountIn);

    const diff = out_a - in_a;
    let fee = 0;

    if (in_a > 0) {
      fee = diff / in_a;
    }

    swapFee.value = fee;
  }, timeOut);
};

function isAmountValid() {
  let isValid = true;
  amountErrorMsg.value = "";
  if (lease.value) {
    const a = amount.value;
    const currency = AssetUtils.getCurrencyByTicker(lease.value.leaseStatus.opened!.amount.ticker!);
    const debt = new Dec(lease.value.leaseStatus.opened!.amount.amount, Number(currency.decimal_digits));
    const minAmountCurrency = AssetUtils.getCurrencyByTicker(
      config.value?.config.lease_position_spec.min_asset.ticker as string
    )!;
    const minAmont = new Dec(
      config.value?.config.lease_position_spec.min_asset.amount ?? 0,
      Number(minAmountCurrency.decimal_digits)
    );
    const price = new Dec(oracle.prices[currency.key as string].amount);

    const minAmountTemp = new Dec(minimumLeaseAmount);
    const amountInStable = new Dec(a.length == 0 ? "0" : a).mul(price);

    if (amount || amount !== "") {
      const amountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(a, "", Number(currency.decimal_digits));
      const value = new Dec(amountInMinimalDenom.amount, Number(currency.decimal_digits));

      const isLowerThanOrEqualsToZero = new Dec(amountInMinimalDenom.amount || "0").lte(new Dec(0));

      if (isLowerThanOrEqualsToZero) {
        amountErrorMsg.value = i18n.t("message.invalid-balance-low");
        isValid = false;
      }

      if (amountInStable.lt(minAmountTemp)) {
        amountErrorMsg.value = i18n.t("message.min-amount-allowed", {
          amount: minAmountTemp.quo(price).toString(Number(currency.decimal_digits)),
          currency: currency.shortName
        });
        isValid = false;
      } else if (value.gt(debt)) {
        amountErrorMsg.value = i18n.t("message.lease-only-max-error", {
          maxAmount: Number(debt.toString(Number(currency.decimal_digits))),
          symbol: currency.shortName
        });
        isValid = false;
      } else if (!value.equals(debt) && debt.sub(value).mul(price).lte(minAmont)) {
        amountErrorMsg.value = i18n.t("message.lease-min-amount", {
          amount: Number(minAmont.quo(price).toString(Number(currency.decimal_digits))),
          symbol: currency.shortName
        });
        isValid = false;
      }
    } else {
      amountErrorMsg.value = i18n.t("message.missing-amount");
      isValid = false;
    }
  }

  return isValid;
}

async function onSendClick() {
  try {
    disabled.value = true;
    await walletOperation(marketCloseLease);
  } catch (error: Error | any) {
  } finally {
    disabled.value = false;
  }
}

async function marketCloseLease() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && isAmountValid()) {
    try {
      loading.value = true;
      const funds: Coin[] = [];

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(cosmWasmClient, lease?.value!.leaseAddress);

      const { txHash, txBytes, usedFee } = await leaseClient.simulateClosePositionLeaseTx(wallet, getCurrency(), funds);
      await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      reload();
      dialog?.value?.close();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.toast-closed")
      });
    } catch (error: Error | any) {
      Logger.error(error);
    } finally {
      loading.value = false;
    }
  }
}

function getCurrency() {
  const microAmount = getMicroAmount(currency.value.ibcData, amount.value);
  const a = new Int(lease.value?.leaseStatus.opened?.amount.amount ?? 0);

  if (a.equals(microAmount.mAmount.amount)) {
    return undefined;
  }

  const c = currency.value;

  return {
    ticker: c.ticker,
    amount: microAmount.mAmount.amount.toString()
  };
}

watch(
  () => [amount.value, selectedCurrency.value],
  (currentValue, oldValue) => {
    isAmountValid();
  }
);

watch(
  () => [currency.value?.key],
  (currentValue, oldValue) => {
    setSwapFee();
  },
  {
    deep: true
  }
);
</script>
