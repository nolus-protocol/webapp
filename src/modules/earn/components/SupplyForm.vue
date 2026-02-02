<template>
  <div
    id="dialog-scroll"
    class="custom-scroll max-h-full flex-1 overflow-auto"
  >
    <AdvancedFormControl
      id="receive-send"
      :currencyOptions="assets"
      class="px-6 py-4"
      :label="$t('message.amount')"
      :balanceLabel="$t('message.balance')"
      :selectedCurrencyOption="assets[selectedCurrency]"
      @on-selected-currency="onSelect"
      placeholder="0"
      :calculatedBalance="stable"
      @input="onInput"
      :error-msg="error"
      :searchable="true"
      :itemsHeadline="[$t('message.assets'), $t('message.your-balance')]"
      :item-template="
        (item: any) =>
          h<AssetItemProps>(AssetItem, {
            ...item,
            abbreviation: item.label,
            name: item.name,
            balance: item.balance.value,
            info: item.disabled ? () => h(Info) : null
          })
      "
    >
    </AdvancedFormControl>
    <hr class="border-border-color" />
    <div class="flex flex-col gap-3 px-6 py-4 text-typography-default">
      <span class="text-16 font-semibold">{{ $t("message.preview") }}</span>
      <template v-if="decAmount.isZero()">
        <div class="flex items-center gap-2 text-14">
          <SvgIcon
            name="list-sparkle"
            class="fill-icon-secondary"
          />
          {{ $t("message.preview-input") }}
        </div>
      </template>
      <template v-if="decAmount.isPositive()">
        <div class="flex items-center gap-2 text-14">
          <SvgIcon
            name="check-solid"
            class="fill-icon-success"
          />
          <p
            class="flex-1"
            :innerHTML="$t('message.supply-preview', { amount: amountStr })"
          ></p>
        </div>
        <EarnChart
          :class="{ hidden: apr == 0 }"
          class="mt-4"
          :currencyKey="assets[selectedCurrency].key"
          :amount="decAmount"
        />
      </template>
    </div>
    <hr class="border-border-color" />
  </div>
  <div class="flex flex-col gap-2 p-6">
    <Button
      size="large"
      severity="primary"
      :label="$t('message.supply')"
      @click="onNextClick"
      :disabled="disabled || assets[selectedCurrency]?.disabled"
      :loading="loading"
    />
    <p class="text-center text-12 text-typography-secondary">
      {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.earnEstimation }}{{ $t("message.sec") }}
    </p>
  </div>
</template>

<script lang="ts" setup>
import {
  AdvancedFormControl,
  Button,
  SvgIcon,
  type AdvancedCurrencyFieldOption,
  type AssetItemProps,
  AssetItem,
  ToastType
} from "web-components";
import { computed, inject, ref, watch } from "vue";
import { NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../config/global/network";
import { useWalletStore, WalletActions } from "@/common/stores/wallet";
import { Dec, Int } from "@keplr-wallet/unit";
import { getMicroAmount, Logger, validateAmountV2, walletOperation } from "@/common/utils";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { getBalance } from "@/common/utils/BalanceLookup";
import { usePricesStore } from "@/common/stores/prices";
import { useApplicationStore } from "@/common/stores/application";
import { ProtocolsConfig, SORT_PROTOCOLS, Contracts } from "@/config/global";
import { CurrencyUtils, NolusClient, type NolusWallet } from "@nolus/nolusjs";
import { Lpp } from "@nolus/nolusjs/build/contracts";
import { useConfigStore } from "@/common/stores/config";
import { h } from "vue";

const pricesStore = usePricesStore();
import Info from "./Info.vue";
import { useI18n } from "vue-i18n";
import EarnChart from "./EarnChart.vue";

const assets = computed(() => {
  try {
    const protocols = Contracts.protocolsFilter[application.protocolFilter];
    const lpns = application.lpn?.filter((item) => {
      const c = application.currenciesData![item.key!];
      const [_currency, protocol] = c.key!.split("@");

      if (protocols.hold.includes(protocol)) {
        return true;
      }
      return false;
    });

    const data = [];

    for (const lpn of lpns ?? []) {
      const [_, p] = lpn.key.split("@");
      const asset = getBalance(lpn.ibcData);
      const value = new Dec(asset.balance.amount, lpn.decimal_digits);

      const balance = formatNumber(value.toString(), lpn.decimal_digits);
      const price = new Dec(pricesStore.prices?.[lpn.key]?.price ?? "0");
      const stable = price.mul(value);
      data.push({
        key: lpn.key,
        disabled: !supply.value[p],
        name: lpn.name,
        value: lpn.key,
        label: lpn.shortName,
        ibcData: lpn.ibcData,
        icon: lpn.icon,
        balance: { value: balance, ticker: lpn.shortName },
        stable,
        decimal_digits: lpn.decimal_digits,
        price: `${NATIVE_CURRENCY.symbol}${formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`
      });
    }
    let items = [];

    for (const protocol of SORT_PROTOCOLS) {
      const index = data.findIndex((item) => {
        const [_key, pr] = item.value.split("@");
        return pr == protocol;
      });
      if (index > -1) {
        items.push(data[index]);
        data.splice(index, 1);
      }
    }

    items = items
      .sort((a, b) => {
        return Number(b.stable.sub(a.stable).toString(8));
      })
      .sort((a, b) => (a.disabled === b.disabled ? 0 : a.disabled ? 1 : -1));

    return items;
  } catch (e) {
    return [];
  }
});

const walletStore = useWalletStore();
const application = useApplicationStore();
const configStore = useConfigStore();
const loadLPNCurrency = inject("loadLPNCurrency", () => false);
const onClose = inject("close", () => {});
const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});
const i18n = useI18n();

const input = ref("0");
const error = ref("");
const loading = ref(false);
const disabled = ref(false);
const supply = ref<{ [key: string]: boolean }>({});
const maxSupply = ref<{ [key: string]: Int }>({});

const selectedCurrency = ref(0);

const stable = computed(() => {
  const currency = assets.value[selectedCurrency.value];
  const asset = application.currenciesData?.[currency?.value];

  const price = new Dec(pricesStore.prices?.[asset?.key]?.price ?? "0");
  const v = input?.value?.length ? input?.value : "0";
  const stable = price.mul(new Dec(v));
  return `${NATIVE_CURRENCY.symbol}${formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`;
});

watch(
  () => application.init,
  () => {
    if (application.init) {
      onInit();
    }
  },
  {
    immediate: true
  }
);

async function onInit() {
  fetchDepositCapacity();
}

const apr = computed(() => {
  let [_, protocol] = assets.value[selectedCurrency.value].key.split("@");

  const a = application.apr?.[protocol];
  return a;
});

function onInput(data: string) {
  input.value = data;
  validateInputs();
}

const decAmount = computed(() => {
  return new Dec(input.value.length > 0 ? input.value : 0);
});

const amountStr = computed(() => {
  const currency = assets.value[selectedCurrency.value];
  return `${formatNumber(decAmount.value.toString(), currency.decimal_digits)} ${currency.label} (${stable.value})`;
});

async function onNextClick() {
  if (validateInputs().length == 0) {
    try {
      disabled.value = true;
      await walletOperation(transferAmount);
    } catch (e) {
      Logger.error(e);
      error.value = (e as Error).message;
    } finally {
      disabled.value = false;
    }
  }
}

async function transferAmount() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && error.value === "") {
    try {
      loading.value = true;
      const currency = application.currenciesData![assets.value[selectedCurrency.value].value];
      const microAmount = getMicroAmount(currency.ibcData, input.value);

      const [_currency, protocol] = currency.key.split("@");

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const lppClient = new Lpp(cosmWasmClient, configStore.contracts[protocol].lpp);

      const { txHash, txBytes, usedFee } = await lppClient.simulateDepositTx(wallet, [
        {
          denom: microAmount.coinMinimalDenom,
          amount: microAmount.mAmount.amount.toString()
        }
      ]);

      await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      await Promise.all([walletStore[WalletActions.UPDATE_BALANCES](), loadLPNCurrency()]);
      walletStore.loadActivities();
      onClose();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.supply-successful")
      });
    } catch (e: Error | any) {
      Logger.error(e);
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }
}

async function fetchDepositCapacity() {
  const lpns = application.lpn;
  const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
  const value: { [key: string]: boolean } = {};
  const data = [];
  for (const lpn of lpns ?? []) {
    const [_currency, protocol] = lpn.key!.split("@");

    const fn = async () => {
      if (!ProtocolsConfig[protocol].supply) {
        value[protocol] = false;
        return;
      }
      const contract = configStore.contracts[protocol].lpp;
      const lppClient = new Lpp(cosmWasmClient, contract);
      const supply = await lppClient.getDepositCapacity();

      if (Number(supply?.amount) == 0 || !ProtocolsConfig[protocol].supply) {
        value[protocol] = false;
        maxSupply.value[protocol] = new Int(0);
      } else {
        value[protocol] = true;
        maxSupply.value[protocol] = new Int(supply?.amount ?? -1);
      }
    };

    data.push(fn());
  }

  await Promise.all(data);
  supply.value = value;
}

function validateSupply() {
  const asset = assets.value[selectedCurrency.value];
  const [_, protocol] = assets.value[selectedCurrency.value].key.split("@");
  const max = maxSupply.value[protocol];

  if (max.isNegative()) {
    return "";
  }

  const i = input.value.length == 0 ? "0" : input.value;

  const a = CurrencyUtils.convertDenomToMinimalDenom(i, asset.ibcData, asset.decimal_digits);

  if (a.amount.gt(max)) {
    const m = CurrencyUtils.convertMinimalDenomToDenom(
      max.toString(),
      asset.ibcData,
      asset.label,
      asset.decimal_digits
    );
    return i18n.t("message.supply-limit-error", { amount: m });
  }

  return "";
}

function onSelect(event: AdvancedCurrencyFieldOption) {
  const index = assets.value.findIndex((item) => item == event);
  selectedCurrency.value = index;
}

function validateInputs() {
  const currency = assets.value[selectedCurrency.value];

  const verr = validateSupply();

  if (verr.length > 0) {
    error.value = verr;
    return error.value;
  }

  error.value = validateAmountV2(input.value, currency.balance.value);
  return error.value;
}
</script>
