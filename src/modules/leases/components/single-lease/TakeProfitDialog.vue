<template>
  <Dialog
    ref="dialog"
    :title="$t(`message.take-profit`)"
    showClose
    :disable-close="true"
    @close-dialog="router.push(`/${RouteNames.LEASES}/${route.params.protocol}/${route.params.id}`)"
  >
    <template v-slot:content>
      <hr class="border-border-color" />
      <div class="flex flex-col gap-4 px-6 py-4">
        <AdvancedFormControl
          id="stop-loss"
          :label="$t('message.take-profit-price-per')"
          :currencyOptions="assets"
          :disabled-currency-picker="true"
          :disabled-input-field="isLoading"
          :selectedCurrencyOption="assets[0]"
          :value-only="amount"
          @input="handleAmountChange"
          :error-msg="amountErrorMsg"
          placeholder="0"
          :balanceLabel="
            $t('message.current-price', {
              asset: currency?.shortName
            })
          "
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
          :label="$t(`message.submit-btn`)"
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
import { AdvancedFormControl, Button, Dialog, Tooltip, SvgIcon, ToastType } from "web-components";
import { RouteNames } from "@/router";

import { useWalletStore } from "@/common/stores/wallet";
import { useApplicationStore } from "@/common/stores/application";
import { useOracleStore } from "@/common/stores/oracle";
import { AssetUtils, getMicroAmount, Logger, walletOperation } from "@/common/utils";
import { NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../../config/global/network";
import type { ExternalCurrency } from "@/common/types";
import { CurrencyDemapping } from "@/config/currencies";
import type { AssetBalance } from "@/common/stores/wallet/types";
import { Dec, Int } from "@keplr-wallet/unit";
import { useLease, useLeaseConfig } from "@/common/composables";
import { NolusClient, NolusWallet } from "@nolus/nolusjs";
import { useI18n } from "vue-i18n";
import type { Coin } from "@cosmjs/proto-signing";
import { Lease } from "@nolus/nolusjs/build/contracts";
import { PERMILLE } from "@/config/global";

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

const assets = computed(() => {
  const data = [];

  if (lease.value) {
    const ticker =
      CurrencyDemapping[lease.value?.leaseStatus?.opened?.amount?.ticker!]?.ticker ??
      lease.value?.leaseStatus?.opened?.amount?.ticker;
    const asset = app.currenciesData![`${ticker}@${lease.value!.protocol}`];
    const denom = (asset as ExternalCurrency).ibcData ?? (asset as AssetBalance).from;
    const price = new Dec(oracle.prices?.[asset.key]?.amount ?? 0).toString(asset.decimal_digits);

    data.push({
      name: asset.name,
      icon: asset.icon,
      value: denom,
      label: asset.shortName,
      ibcData: asset.ibcData,
      shortName: asset.shortName,
      decimal_digits: asset.decimal_digits!,
      key: asset.key,
      ticker: asset.ticker,
      balance: {
        value: price,
        ticker: "",
        customLabel: `${NATIVE_CURRENCY.symbol}${price}`,
        denom: asset.ibcData
      }
    });
  }

  return data;
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

function isAmountValid() {
  let isValid = true;
  amountErrorMsg.value = "";
  if (lease.value) {
    const a = new Dec(amount.value.length > 0 ? amount.value : 0);
    const currency = AssetUtils.getCurrencyByTicker(lease.value.leaseStatus.opened!.amount.ticker!);
    const price = new Dec(oracle.prices[currency.key as string].amount);

    if (amount || amount !== "") {
      const isLowerThanOrEqualsToZero = a.lte(new Dec(0));

      if (isLowerThanOrEqualsToZero) {
        amountErrorMsg.value = i18n.t("message.invalid-balance-low");
        isValid = false;
      }

      if (a.lte(price)) {
        amountErrorMsg.value = i18n.t("message.take-profit-min-amount-error", {
          amount: `${NATIVE_CURRENCY.symbol}${Number(price.toString(Number(currency.decimal_digits)))}`,
          symbol: ""
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
      const value = new Dec(amount.value);
      const price = lease.value?.leaseData?.price;

      if (!price) {
        return;
      }

      const takeProfit = Number(value.sub(price).quo(price).mul(new Dec(PERMILLE)).round().toString());
      const stopLoss = lease.value?.leaseStatus.opened?.close_policy.take_profit;

      const { txHash, txBytes, usedFee } = await leaseClient.simulateChangeClosePolicyTx(
        wallet,
        stopLoss,
        takeProfit,
        funds
      );
      await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      reload();
      dialog?.value?.close();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.stop-loss-toast")
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
</script>
