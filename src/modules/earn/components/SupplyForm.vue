<template>
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
          info: item.disabled ? () => h(Info) : null,
          max_decimals: item.decimal_digits > MAX_DECIMALS ? MAX_DECIMALS : item.decimal_digits
        })
    "
  >
  </AdvancedFormControl>

  <hr class="border-border-color" />
  <div class="flex flex-col gap-3 px-6 py-4 text-typography-default">
    <span class="text-16 font-semibold">{{ $t("message.preview") }}</span>
    <div class="flex items-center gap-2 text-14">
      <SvgIcon
        name="list-sparkle"
        class="fill-icon-secondary"
      />
      {{ $t("message.preview-input") }}
    </div>
  </div>
  <hr class="border-border-color" />

  <div class="flex flex-col gap-2 p-6">
    <Button
      size="large"
      severity="primary"
      :label="$t('message.supply')"
      @click="onNextClick"
      :disabled="disabled || assets[selectedCurrency].disabled"
      :loading="loading"
    />
    <p class="text-center text-12 text-typography-secondary">
      {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.longOperationsEstimation }}{{ $t("message.sec") }}
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
  AssetItem
} from "web-components";
import { computed, inject, onMounted, ref } from "vue";
import { NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../config/global/network";
import { useWalletStore, WalletActions } from "@/common/stores/wallet";
import { Dec } from "@keplr-wallet/unit";
import { AssetUtils, getMicroAmount, Logger, validateAmountV2, walletOperation } from "@/common/utils";
import { useOracleStore } from "@/common/stores/oracle";
import { useApplicationStore } from "@/common/stores/application";
import { ProtocolsConfig, SORT_PROTOCOLS, MAX_DECIMALS } from "@/config/global";
import { NolusClient, type NolusWallet } from "@nolus/nolusjs";
import { Lpp } from "@nolus/nolusjs/build/contracts";
import { useAdminStore } from "@/common/stores/admin";
import { h } from "vue";
import Info from "./Info.vue";

const assets = computed(() => {
  const lpns = application.lpn;
  const data = [];

  for (const lpn of lpns ?? []) {
    const [_, p] = lpn.key.split("@");
    const asset = AssetUtils.getBalance(lpn.ibcData);
    const value = new Dec(asset.balance.amount, lpn.decimal_digits);

    const balance = AssetUtils.formatNumber(value.toString(), lpn.decimal_digits);
    const price = new Dec(oracle.prices?.[lpn.key]?.amount ?? 0);
    const stable = price.mul(value);
    data.push({
      disabled: !supply.value[p],
      name: lpn.name,
      value: lpn.key,
      label: lpn.shortName,
      icon: lpn.icon,
      balance: { value: balance, ticker: lpn.shortName },
      stable,
      decimal_digits: lpn.decimal_digits,
      price: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`
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
});

const walletStore = useWalletStore();
const oracle = useOracleStore();
const application = useApplicationStore();
const admin = useAdminStore();
const loadLPNCurrency = inject("loadLPNCurrency", () => false);
const onClose = inject("close", () => {});

const input = ref("0");
const error = ref("");
const loading = ref(false);
const disabled = ref(false);
const supply = ref<{ [key: string]: boolean }>({});

const selectedCurrency = ref(0);

const stable = computed(() => {
  const currency = assets.value[selectedCurrency.value];
  const asset = application.currenciesData![currency.value];

  const price = new Dec(oracle.prices?.[asset.key]?.amount ?? 0);
  const v = input?.value?.length ? input?.value : "0";
  const stable = price.mul(new Dec(v));
  return `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`;
});

onMounted(() => {
  fetchDepositCapacity();
});

function onInput(data: string) {
  input.value = data;
  validateInputs();
}

async function onNextClick() {
  if (validateInputs().length == 0) {
    try {
      disabled.value = true;
      await walletOperation(transferAmount);
    } catch (e) {
      Logger.error(e);
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
      const lppClient = new Lpp(cosmWasmClient, admin.contracts![protocol].lpp);

      const { txHash, txBytes, usedFee } = await lppClient.simulateDepositTx(wallet, [
        {
          denom: microAmount.coinMinimalDenom,
          amount: microAmount.mAmount.amount.toString()
        }
      ]);

      await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      await Promise.all([walletStore[WalletActions.UPDATE_BALANCES](), loadLPNCurrency()]);
      onClose();
    } catch (error: Error | any) {
      Logger.error(error);
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
      const contract = admin.contracts![protocol].lpp;
      const lppClient = new Lpp(cosmWasmClient, contract);
      const supply = await lppClient.getDepositCapacity();

      if (Number(supply?.amount) == 0 || !ProtocolsConfig[protocol].supply) {
        value[protocol] = false;
      } else {
        value[protocol] = true;
      }
    };

    data.push(fn());
  }

  await Promise.all(data);
  supply.value = value;
}

function onSelect(event: AdvancedCurrencyFieldOption) {
  const index = assets.value.findIndex((item) => item == event);
  selectedCurrency.value = index;
}

function validateInputs() {
  const currency = assets.value[selectedCurrency.value];
  error.value = validateAmountV2(input.value, currency.balance.value);
  return error.value;
}
</script>
