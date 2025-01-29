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
    :itemsHeadline="[$t('message.assets'), $t('message.supplied')]"
    :item-template="
      (item: any) =>
        h<AssetItemProps>(AssetItem, {
          ...item,
          abbreviation: item.label,
          name: item.name,
          balance: item.balance.value,
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
      :label="$t('message.withdraw')"
      @click="onNextClick"
      :loading="loading"
      :disabled="disabled"
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
  AssetItem,
  ToastType
} from "web-components";
import { computed, inject, ref, watch } from "vue";
import { NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../config/global/network";
import { useWalletStore, WalletActions } from "@/common/stores/wallet";
import { Coin, Dec, Int } from "@keplr-wallet/unit";
import { AssetUtils, getMicroAmount, Logger, validateAmountV2, WalletManager, walletOperation } from "@/common/utils";
import { useOracleStore } from "@/common/stores/oracle";
import { useApplicationStore } from "@/common/stores/application";
import { NolusClient, type NolusWallet } from "@nolus/nolusjs";
import { Lpp } from "@nolus/nolusjs/build/contracts";
import { useAdminStore } from "@/common/stores/admin";
import { h } from "vue";
import { MAX_DECIMALS, Contracts } from "@/config/global";
import { useI18n } from "vue-i18n";

const assets = computed(() => {
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
    const asset = lpnBalances.value.find((item) => item.key == lpn.key);
    const value = new Dec(asset?.coin?.amount.toString() ?? 0, lpn.decimal_digits);
    const balance = AssetUtils.formatNumber(value.toString(), lpn.decimal_digits);

    const price = new Dec(oracle.prices?.[lpn.key]?.amount ?? 0);
    const stable = price.mul(value);

    data.push({
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

  return data.sort((a, b) => {
    return Number(b.stable.sub(a.stable).toString(8));
  });
});

const i18n = useI18n();
const walletStore = useWalletStore();
const oracle = useOracleStore();
const application = useApplicationStore();
const admin = useAdminStore();
const loadLPNCurrency = inject("loadLPNCurrency", () => false);
const onClose = inject("close", () => {});
const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});

const input = ref("0");
const error = ref("");
const loading = ref(false);
const disabled = ref(false);
const selectedCurrency = ref(0);
const lpnBalances = ref<
  {
    coin: Coin;
    key: string;
  }[]
>([]);

const stable = computed(() => {
  const currency = assets.value[selectedCurrency.value];
  const asset = application.currenciesData![currency.value];

  const price = new Dec(oracle.prices?.[asset.key]?.amount ?? 0);
  const v = input?.value?.length ? input?.value : "0";
  const stable = price.mul(new Dec(v));
  return `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`;
});

watch(
  () => walletStore.wallet,
  async () => {
    fetchDepositBalance();
  },
  {
    immediate: true
  }
);
async function fetchDepositBalance() {
  try {
    const lpns = application.lpn;
    const data = [];

    for (const lpn of lpns ?? []) {
      async function fn() {
        const walletAddress = walletStore.wallet?.address ?? WalletManager.getWalletAddress();
        const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
        const [_currency, protocol] = lpn.key.split("@");

        const lppClient = new Lpp(cosmWasmClient, admin.contracts![protocol].lpp);
        const [depositBalance, price] = await Promise.all([
          lppClient.getLenderDeposit(walletAddress as string),
          lppClient.getPrice()
        ]);

        const calculatedPrice = new Dec(price.amount_quote.amount).quo(new Dec(price.amount.amount));
        const amount = new Dec(depositBalance.balance).mul(calculatedPrice);

        return { coin: new Coin(lpn.ibcData, amount.roundUp().toString()), key: lpn.key };
      }
      data.push(fn());
    }
    lpnBalances.value = await Promise.all(data);
  } catch (e) {
    Logger.error(e);
  }
}

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
      const asset = lpnBalances.value.find((item) => item.key == currency.key)!;

      const [_currency, protocol] = currency.key.split("@");

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const lppClient = new Lpp(cosmWasmClient, admin.contracts![protocol].lpp);
      const price = await lppClient.getPrice();

      const calculatedPrice = new Dec(price.amount_quote.amount).quo(new Dec(price.amount.amount));

      if (microAmount.mAmount.amount.equals(asset.coin.amount as Int)) {
        const walletAddress = walletStore.wallet?.address ?? WalletManager.getWalletAddress();
        const amount = await lppClient.getLenderDeposit(walletAddress as string);
        microAmount.mAmount.amount = new Dec(amount.balance).truncate();
      } else {
        microAmount.mAmount.amount = new Dec(microAmount.mAmount.amount).quo(calculatedPrice).truncate();
      }

      const { txHash, txBytes, usedFee } = await lppClient.simulateBurnDepositTx(
        wallet,
        microAmount.mAmount.amount.toString()
      );

      await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      await Promise.all([loadLPNCurrency(), walletStore[WalletActions.UPDATE_BALANCES]()]);
      onClose();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.withdraw-successful")
      });
    } catch (error) {
      Logger.error(error);
    } finally {
      loading.value = false;
    }
  }
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
