<template>
  <Dialog
    ref="dialog"
    :title="$t(`message.take-profit`)"
    showClose
    :disable-close="false"
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
              {{ $t("message.stoppings-payout", { amount: `${payout}` }) }}
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
import { usePricesStore } from "@/common/stores/prices";
import { useLeasesStore, type LeaseDisplayData } from "@/common/stores/leases";
import { useConfigStore } from "@/common/stores/config";
import { Logger, walletOperation } from "@/common/utils";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { getLpnByProtocol, getCurrencyByTicker } from "@/common/utils/CurrencyLookup";
import { NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../../config/global/network";
import type { ExternalCurrency } from "@/common/types";
import type { AssetBalance } from "@/common/stores/wallet/types";
import { Dec } from "@keplr-wallet/unit";
import { NolusClient, NolusWallet } from "@nolus/nolusjs";
import { useI18n } from "vue-i18n";
import type { Coin } from "@cosmjs/proto-signing";
import { Lease } from "@nolus/nolusjs/build/contracts";
import { PERMILLE, PositionTypes, ProtocolsConfig } from "@/config/global";
import type { LeaseInfo } from "@/common/api";

const route = useRoute();
const router = useRouter();
const pricesStore = usePricesStore();
const walletStore = useWalletStore();
const app = useApplicationStore();
const leasesStore = useLeasesStore();
const configStore = useConfigStore();
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
const lease = ref<LeaseInfo | null>(null);
const displayData = ref<LeaseDisplayData | null>(null);

async function fetchLease() {
  try {
    const result = await leasesStore.fetchLeaseDetails(
      route.params.id as string,
      (route.params.protocol as string).toUpperCase()
    );
    if (result) {
      lease.value = result;
      displayData.value = leasesStore.getLeaseDisplayData(result);
      if (result.status === "closed") {
        router.push(`/${RouteNames.LEASES}`);
      }
    }
  } catch (error) {
    Logger.error(error);
  }
}

const config = computed(() => {
  const protocol = (route.params.protocol as string).toUpperCase();
  return configStore.contracts[protocol];
});

onMounted(() => {
  dialog?.value?.show();
  fetchLease();
});

onBeforeUnmount(() => {
  dialog?.value?.close();
});

const price = computed(() => {
  return formatNumber(amount.value.length == 0 ? 0 : amount.value, currency.value.decimal_digits);
});

const currency = computed(() => {
  return assets.value[selectedCurrency.value];
});

const assets = computed(() => {
  const data = [];

  if (lease.value) {
    const asset = getCurrency()!;
    const denom = (asset as ExternalCurrency).ibcData ?? (asset as AssetBalance).from;
    const price = new Dec(pricesStore.prices[asset.key]?.price ?? 0).toString(asset.decimal_digits);

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
  if (!lease.value || !displayData.value) return "0";
  const end_price = new Dec(amount.value.length == 0 ? 0 : amount.value);
  const end = totalAmount.value.mul(end_price);
  const debt = displayData.value.outstandingDebt ?? new Dec(0);
  const current_price = pricesStore.prices[currency.value.key];

  switch (ProtocolsConfig[lease.value.protocol].type) {
    case PositionTypes.long: {
      return formatNumber(end.sub(debt).toString(), currency.value?.decimal_digits, NATIVE_CURRENCY.symbol);
    }
    case PositionTypes.short: {
      const current_amount = totalAmount.value.mul(new Dec(current_price.price));
      const amountVal = debt.mul(end_price);
      const a = current_amount.sub(amountVal);

      return formatNumber(a.toString(), currency.value?.decimal_digits, NATIVE_CURRENCY.symbol);
    }
  }

  return "0";
});

const totalAmount = computed(() => {
  if (!lease.value || lease.value.status !== "opened") return new Dec(0);
  switch (ProtocolsConfig[lease.value.protocol]?.type) {
    case PositionTypes.long: {
      return new Dec(lease.value.amount.amount ?? "0", currency.value.decimal_digits);
    }
    case PositionTypes.short: {
      const ticker = lease.value.etl_data?.lease_position_ticker ?? lease.value.amount.ticker;
      const asset = app.currenciesData?.[`${ticker}@${lease.value.protocol}`]!;
      const price = pricesStore.prices[asset?.ibcData as string];
      const c =
        app.currenciesData?.[`${ProtocolsConfig[lease.value.protocol as string].stable}@${lease.value.protocol}`];
      let k = new Dec(lease.value.amount.amount ?? 0, c?.decimal_digits ?? 0).quo(new Dec(price.price));
      return k;
    }
  }
  return new Dec(0);
});

function getCurrency() {
  if (!lease.value || lease.value.status !== "opened") return undefined;
  switch (ProtocolsConfig[lease.value.protocol].type) {
    case PositionTypes.long: {
      const ticker = lease.value.amount.ticker;
      return app.currenciesData![`${ticker}@${lease.value.protocol}`];
    }
    case PositionTypes.short: {
      const lpn = getLpnByProtocol(lease.value.protocol);

      return lpn;
    }
  }
}

function getPrice() {
  if (!lease.value || !displayData.value) return undefined;
  return displayData.value.openingPrice;
}

const total = computed(() => {
  if (!lease.value || lease.value.status !== "opened") return new Dec(0);
  return new Dec(lease.value.amount.amount ?? 0, currency.value?.decimal_digits);
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
  if (lease.value && lease.value.status === "opened") {
    const a = new Dec(amount.value.length > 0 ? amount.value : 0);
    const currencyData = getCurrencyByTicker(lease.value.amount.ticker!);
    const price = getPrice()!;

    if (amount || amount !== "") {
      const isLowerThanOrEqualsToZero = a.lte(new Dec(0));

      if (isLowerThanOrEqualsToZero) {
        amountErrorMsg.value = i18n.t("message.invalid-balance-low");
        isValid = false;
      }

      switch (ProtocolsConfig[lease.value.protocol].type) {
        case PositionTypes.long: {
          if (a.lte(price)) {
            amountErrorMsg.value = i18n.t("message.take-profit-min-amount-error", {
              amount: `${NATIVE_CURRENCY.symbol}${Number(price.toString(Number(currencyData.decimal_digits)))}`,
              symbol: ""
            });

            isValid = false;
          }
          break;
        }
        case PositionTypes.short: {
          if (a.gt(price)) {
            amountErrorMsg.value = i18n.t("message.lease-only-max-error", {
              maxAmount: `${NATIVE_CURRENCY.symbol}${Number(price.toString(Number(currencyData.decimal_digits)))}`,
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
  } catch (e: Error | any) {
  } finally {
    disabled.value = false;
  }
}

async function operation() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && isAmountValid() && lease.value && lease.value.status === "opened") {
    try {
      loading.value = true;
      const funds: Coin[] = [];

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(cosmWasmClient, lease.value.address);
      const price = getPrice();

      if (!price) {
        return;
      }

      const percent = getPercent();

      const takeProfit = Number(percent!.mul(new Dec(PERMILLE)).round().toString());
      const stopLoss = lease.value.close_policy?.stop_loss;
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
  if (!lease.value || !displayData.value) return new Dec(0);
  const value = new Dec(amount.value);
  switch (ProtocolsConfig[lease.value.protocol].type) {
    case PositionTypes.long: {
      return displayData.value.stableAsset.quo(value.mul(displayData.value.unitAsset));
    }
    case PositionTypes.short: {
      return displayData.value.stableAsset.quo(displayData.value.unitAsset).mul(value);
    }
  }
  return new Dec(0);
}

watch(
  () => [amount.value, selectedCurrency.value],
  (currentValue, oldValue) => {
    isAmountValid();
  }
);
</script>
