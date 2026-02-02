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
      :itemsHeadline="[$t('message.assets'), $t('message.supplied')]"
      :item-template="
        (item: any) =>
          h<AssetItemProps>(AssetItem, {
            ...item,
            abbreviation: item.label,
            name: item.name,
            balance: item.balance.value
          })
      "
    >
    </AdvancedFormControl>

    <hr class="border-border-color" />
    <div class="flex flex-col gap-3 px-6 py-4 text-typography-default">
      <span class="text-16 font-semibold">{{ $t("message.preview") }}</span>
      <template v-if="isEmpty">
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
              $t('message.withdraw-rewards-preview', {
                amount: `${input} ${assets[selectedCurrency].label}`,
                amountStable: stable
              })
            "
          ></p>
        </div>
      </template>
    </div>
    <hr class="border-border-color" />
  </div>

  <div class="flex flex-1 flex-col justify-end gap-2 p-6">
    <Button
      size="large"
      severity="primary"
      :label="$t('message.withdraw')"
      @click="onNextClick"
      :loading="loading"
      :disabled="disabled"
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
  type AdvancedCurrencyFieldOption,
  type AssetItemProps,
  AssetItem,
  ToastType,
  SvgIcon
} from "web-components";
import { computed, inject, ref, watch } from "vue";
import { NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../config/global/network";
import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { Coin, Dec, Int } from "@keplr-wallet/unit";
import { getMicroAmount, Logger, validateAmountV2, WalletManager, walletOperation } from "@/common/utils";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { usePricesStore } from "@/common/stores/prices";
import { useConfigStore } from "@/common/stores/config";
import { CurrencyUtils, NolusClient, type NolusWallet } from "@nolus/nolusjs";
import { Lpp } from "@nolus/nolusjs/build/contracts";
import { h } from "vue";
import { Contracts } from "@/config/global";
import { useHistoryStore } from "@/common/stores/history";
import { useI18n } from "vue-i18n";

const configStore = useConfigStore();

const assets = computed(() => {
  const protocols = Contracts.protocolsFilter[configStore.protocolFilter];
  const lpns = configStore.lpn?.filter((item) => {
    const c = configStore.currenciesData![item.key!];
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
    const balance = formatNumber(value.toString(), lpn.decimal_digits);

    const price = new Dec(pricesStore.prices[lpn.key]?.price ?? 0);
    const stable = price.mul(value);

    data.push({
      name: lpn.name,
      value: lpn.key,
      label: lpn.shortName,
      icon: lpn.icon,
      balance: { value: balance, ticker: lpn.shortName },
      stable,
      decimal_digits: lpn.decimal_digits,
      price: `${NATIVE_CURRENCY.symbol}${formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`
    });
  }

  return data.sort((a, b) => {
    return Number(b.stable.sub(a.stable).toString(8));
  });
});

const i18n = useI18n();
const walletStore = useWalletStore();
const balancesStore = useBalancesStore();
const pricesStore = usePricesStore();
const historyStore = useHistoryStore();
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
  const asset = configStore.currenciesData?.[currency?.value];

  const price = new Dec(pricesStore.prices[asset?.key]?.price ?? 0);
  const v = input?.value?.length ? input?.value : "0";
  const stable = price.mul(new Dec(v));
  return `${NATIVE_CURRENCY.symbol}${formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`;
});

const isEmpty = computed(() => {
  if (input.value.length == 0 || Number(input.value) == 0) {
    return true;
  }
  return false;
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
    const lpns = configStore.lpn;
    const data = [];

    for (const lpn of lpns ?? []) {
      async function fn() {
        const walletAddress = walletStore.wallet?.address ?? WalletManager.getWalletAddress();
        const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
        const [_currency, protocol] = lpn.key.split("@");

        const lppClient = new Lpp(cosmWasmClient, configStore.contracts[protocol].lpp);
        const [depositBalance, price] = await Promise.all([
          lppClient.getLenderDeposit(walletAddress as string),
          lppClient.getPrice()
        ]);

        const calculatedPrice = new Dec(price.amount_quote.amount).quo(new Dec(price.amount.amount));
        const amount = new Dec(depositBalance.amount).mul(calculatedPrice);

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
      await onValidateAmount();

      disabled.value = true;
      await walletOperation(transferAmount);
    } catch (e) {
      Logger.error(e);
    } finally {
      disabled.value = false;
    }
  }
}

async function onValidateAmount() {
  const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
  const currency = configStore.currenciesData![assets.value[selectedCurrency.value].value];
  const [_currency, protocol] = currency.key.split("@");
  const lppClient = new Lpp(cosmWasmClient, configStore.contracts[protocol].lpp);
  const data = await lppClient.getLppBalance();
  const amount = CurrencyUtils.convertDenomToMinimalDenom(input.value, currency.ibcData, currency.decimal_digits);
  const balance = new Int(data.balance.amount);
  if (amount.amount.gt(balance)) {
    const total = new Dec(data.balance.amount, currency.decimal_digits);
    error.value = i18n.t("message.withdraw-lpp-balance-error", {
      balance: `${total.toString(currency.decimal_digits)} ${currency.shortName}`
    });
  }
}

async function transferAmount() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && error.value === "") {
    try {
      loading.value = true;

      const currency = configStore.currenciesData![assets.value[selectedCurrency.value].value];
      const microAmount = getMicroAmount(currency.ibcData, input.value);
      const asset = lpnBalances.value.find((item) => item.key == currency.key)!;

      const [_currency, protocol] = currency.key.split("@");

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const lppClient = new Lpp(cosmWasmClient, configStore.contracts[protocol].lpp);
      const price = await lppClient.getPrice();

      const calculatedPrice = new Dec(price.amount_quote.amount).quo(new Dec(price.amount.amount));

      if (microAmount.mAmount.amount.equals(asset.coin.amount as Int)) {
        const walletAddress = walletStore.wallet?.address ?? WalletManager.getWalletAddress();
        const amount = await lppClient.getLenderDeposit(walletAddress as string);
        microAmount.mAmount.amount = new Dec(amount.amount).truncate();
      } else {
        microAmount.mAmount.amount = new Dec(microAmount.mAmount.amount).quo(calculatedPrice).truncate();
      }

      const { txHash, txBytes, usedFee } = await lppClient.simulateBurnDepositTx(
        wallet,
        microAmount.mAmount.amount.toString()
      );

      await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      await Promise.all([loadLPNCurrency(), balancesStore.fetchBalances()]);
      historyStore.loadActivities();
      onClose();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.withdraw-successful")
      });
    } catch (e) {
      Logger.error(e);
      error.value = (e as Error).message;
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
