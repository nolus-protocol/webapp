<template>
  <Dialog
    ref="dialog"
    :title="$t(`message.take-profit`)"
    showClose
    :disable-close="true"
    @close-dialog="router.push(`/${RouteNames.LEASES}/${route.params.protocol}/${route.params.id}`)"
  >
    <template v-slot:content>
      <div class="custom-scroll max-h-full flex-1 overflow-auto">
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
                <Tooltip :content="$t('message.take-profit-tooltip')"
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
          <template v-if="amount.length == 0 || amount == '0'">
            <div class="flex items-center gap-2 text-14">
              <SvgIcon
                name="list-sparkle"
                class="fill-icon-secondary"
              />
              {{ $t("message.preview-input") }}
            </div>
          </template>
          <template v-else>
            <div class="flex items-center gap-2 text-14">
              <SvgIcon
                name="check-solid"
                class="fill-icon-success"
              />
              <p
                class="flex-1"
                :innerHTML="
                  $t('message.stoppings-close-price', {
                    price: `${NATIVE_CURRENCY.symbol}${price}`,
                    asset: currency.shortName
                  })
                "
              ></p>
            </div>
            <div class="flex items-center gap-2 text-14">
              <SvgIcon
                name="check-solid"
                class="fill-icon-success"
              />
              {{ $t("message.stoppings-payout", { amount: `${NATIVE_CURRENCY.symbol}${payout}` }) }}
            </div>
          </template>
        </div>
        <hr class="border-border-color" />
      </div>
      <div class="flex flex-1 flex-col justify-end gap-2 p-6">
        <Button
          size="large"
          severity="primary"
          :label="$t(`message.submit-btn`)"
          @click="onSendClick"
          :disabled="disabled"
          :loading="loading"
        />
        <p class="text-center text-12 text-typography-secondary">
          {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.leaseStopLossTakeProfit }}{{ $t("message.sec") }}
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
import { AssetUtils, Logger, walletOperation } from "@/common/utils";
import { NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../../config/global/network";
import type { ExternalCurrency } from "@/common/types";
import type { AssetBalance } from "@/common/stores/wallet/types";
import { Dec } from "@keplr-wallet/unit";
import { useLease, useLeaseConfig } from "@/common/composables";
import { NolusClient, NolusWallet } from "@nolus/nolusjs";
import { useI18n } from "vue-i18n";
import type { Coin } from "@cosmjs/proto-signing";
import { Lease } from "@nolus/nolusjs/build/contracts";
import { PERMILLE, PositionTypes, ProtocolsConfig } from "@/config/global";

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

const price = computed(() => {
  return AssetUtils.formatNumber(amount.value.length == 0 ? 0 : amount.value, currency.value.decimal_digits);
});

const currency = computed(() => {
  return assets.value[selectedCurrency.value];
});

const assets = computed(() => {
  const data = [];

  if (lease.value) {
    const asset = getCurrency()!;
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

const payout = computed(() => {
  const end_price = new Dec(amount.value.length == 0 ? 0 : amount.value);
  const end = totalAmount.value.mul(end_price);
  const debt = lease.value?.debt ?? new Dec(0);
  const current_price = oracle.prices[currency.value.key];

  switch (ProtocolsConfig[lease.value?.protocol!].type) {
    case PositionTypes.long: {
      return AssetUtils.formatNumber(end.sub(debt).toString(), currency.value?.decimal_digits);
    }
    case PositionTypes.short: {
      const current_amount = totalAmount.value.mul(new Dec(current_price.amount));
      const amount = debt.mul(end_price);

      const a = current_amount.sub(amount);
      return AssetUtils.formatNumber(a.toString(), currency.value?.decimal_digits);
    }
  }

  return "0";
});

const totalAmount = computed(() => {
  switch (ProtocolsConfig[lease?.value?.protocol!]?.type) {
    case PositionTypes.long: {
      const data =
        lease?.value!.leaseStatus?.opened?.amount ||
        lease?.value!.leaseStatus.opening?.downpayment ||
        lease?.value!.leaseStatus.paid?.amount;
      return new Dec(data?.amount ?? "0", currency.value.decimal_digits);
    }
    case PositionTypes.short: {
      const data =
        lease?.value!.leaseStatus?.opened?.amount ||
        lease?.value!.leaseStatus.opening?.downpayment ||
        lease?.value!.leaseStatus.paid?.amount;

      const asset = app.currenciesData?.[`${lease?.value!.leaseData!.leasePositionTicker}@${lease?.value!.protocol}`]!;
      const price = oracle.prices?.[asset?.ibcData as string];
      const c =
        app.currenciesData?.[`${ProtocolsConfig[lease?.value?.protocol as string].stable}@${lease?.value?.protocol}`];
      let k = new Dec(data?.amount ?? 0, c?.decimal_digits ?? 0).quo(new Dec(price.amount));
      return k;
    }
  }
  return new Dec(0);
});

function getCurrency() {
  switch (ProtocolsConfig[lease.value?.protocol!].type) {
    case PositionTypes.long: {
      const ticker = lease.value?.leaseStatus?.opened?.amount?.ticker;
      return app.currenciesData![`${ticker}@${lease.value!.protocol}`];
    }
    case PositionTypes.short: {
      const lpn = AssetUtils.getLpnByProtocol(lease.value?.protocol!);

      return lpn;
    }
  }
}

function getPrice() {
  switch (ProtocolsConfig[lease.value?.protocol!].type) {
    case PositionTypes.long: {
      return lease.value?.leaseData?.price;
    }
    case PositionTypes.short: {
      return lease.value?.leaseData?.lpnPrice;
    }
  }
}

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
    const price = getPrice()!;

    if (amount || amount !== "") {
      const isLowerThanOrEqualsToZero = a.lte(new Dec(0));

      if (isLowerThanOrEqualsToZero) {
        amountErrorMsg.value = i18n.t("message.invalid-balance-low");
        isValid = false;
      }

      switch (ProtocolsConfig[lease.value?.protocol!].type) {
        case PositionTypes.long: {
          if (a.lte(price)) {
            amountErrorMsg.value = i18n.t("message.take-profit-min-amount-error", {
              amount: `${NATIVE_CURRENCY.symbol}${Number(price.toString(Number(currency.decimal_digits)))}`,
              symbol: ""
            });

            isValid = false;
          }
          break;
        }
        case PositionTypes.short: {
          if (a.gt(price)) {
            amountErrorMsg.value = i18n.t("message.lease-only-max-error", {
              maxAmount: `${NATIVE_CURRENCY.symbol}${Number(price.toString(Number(currency.decimal_digits)))}`,
              symbol: ""
            });
            isValid = false;
          }
          break;
        }
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
    await walletOperation(operation);
  } catch (error: Error | any) {
  } finally {
    disabled.value = false;
  }
}

async function operation() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && isAmountValid()) {
    try {
      loading.value = true;
      const funds: Coin[] = [];

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(cosmWasmClient, lease?.value!.leaseAddress);
      const price = getPrice();

      if (!price) {
        return;
      }

      const percent = getPercent();

      const takeProfit = Number(percent!.mul(new Dec(PERMILLE)).round().toString());
      const stopLoss = lease.value?.leaseStatus.opened?.close_policy.stop_loss;
      const { txHash, txBytes, usedFee } = await leaseClient.simulateChangeClosePolicyTx(
        wallet,
        stopLoss,
        takeProfit,
        funds
      );
      await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      walletStore.loadActivities();
      reload();
      dialog?.value?.close();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.stop-loss-toast")
      });
    } catch (error: Error | any) {
      Logger.error(error);
      amountErrorMsg.value = error.message;
    } finally {
      loading.value = false;
    }
  }
}

function getPercent() {
  const value = new Dec(amount.value);
  switch (ProtocolsConfig[lease.value?.protocol!].type) {
    case PositionTypes.long: {
      return lease.value!.stableAsset.quo(value.mul(lease.value!.unitAsset));
    }
    case PositionTypes.short: {
      return lease.value!.stableAsset.quo(lease.value!.unitAsset).mul(value);
    }
  }
}

watch(
  () => [amount.value, selectedCurrency.value],
  (currentValue, oldValue) => {
    isAmountValid();
  }
);
</script>
