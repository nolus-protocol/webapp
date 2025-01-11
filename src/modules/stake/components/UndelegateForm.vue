<template>
  <AdvancedFormControl
    id="receive-send"
    :currencyOptions="assets"
    class="px-6 py-4"
    labelAdvanced
    :balanceLabel="$t('message.balance')"
    :selectedCurrencyOption="assets[0]"
    placeholder="0"
    :calculatedBalance="stable"
    @input="onInput"
    :error-msg="error"
  >
    <template v-slot:label>
      <div class="flex items-center gap-1">
        {{ $t("message.amount-in") }}
        <span class="flex items-center gap-1 font-normal">
          <img :src="NATIVE_ASSET.icon" /> {{ NATIVE_ASSET.label }}</span
        >
      </div>
    </template>
  </AdvancedFormControl>
  <hr class="border-border-color" />
  <hr class="border-border-color" />
  <div class="flex flex-col gap-2 p-6">
    <Button
      size="large"
      severity="primary"
      :label="$t('message.delegate')"
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
import { AdvancedFormControl, Button, ToastType } from "web-components";
import { computed, inject, ref, watch } from "vue";
import { NATIVE_ASSET, NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../config/global/network";
import { useWalletStore } from "@/common/stores/wallet";
import { Dec } from "@keplr-wallet/unit";
import { AssetUtils, Logger, NetworkUtils, validateAmountV2, walletOperation } from "@/common/utils";
import { useOracleStore } from "@/common/stores/oracle";
import { coin } from "@cosmjs/stargate";
import { CurrencyUtils } from "@nolus/nolusjs";
import type { IObjectKeys } from "@/common/types";
import { useI18n } from "vue-i18n";

const wallet = useWalletStore();
const oracle = useOracleStore();
const i18n = useI18n();

const input = ref("0");
const error = ref("");
const loading = ref(false);
const disabled = ref(false);
const loadDelegated = inject("loadDelegated", () => false);
const delegatedData = ref<IObjectKeys[]>([]);
const onClose = inject("close", () => {});

const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});

watch(
  () => wallet.wallet,
  async () => {
    const [delegated] = await Promise.all([NetworkUtils.loadDelegations()]);
    delegatedData.value = delegated;
  },
  {
    immediate: true
  }
);

const assets = computed(() => {
  let amount = new Dec(0, NATIVE_ASSET.decimal_digits);

  for (const item of delegatedData.value) {
    const d = new Dec(item.balance.amount, NATIVE_ASSET.decimal_digits);
    amount = amount.add(d);
  }

  const balance = AssetUtils.formatNumber(amount.toString(NATIVE_ASSET.decimal_digits), NATIVE_ASSET.decimal_digits);

  return [
    {
      value: NATIVE_ASSET.denom,
      label: NATIVE_ASSET.label,
      icon: NATIVE_ASSET.icon,
      balance: { value: balance, ticker: NATIVE_ASSET.label }
    }
  ];
});

const stable = computed(() => {
  const currency = AssetUtils.getCurrencyByTicker(NATIVE_ASSET.ticker);
  const price = new Dec(oracle.prices?.[currency.key]?.amount ?? 0);
  const v = input?.value?.length ? input?.value : "0";
  const stable = price.mul(new Dec(v));
  return `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`;
});

function onInput(data: string) {
  input.value = data;
  validateInputs();
}

async function onNextClick() {
  if (validateInputs().length == 0) {
    try {
      disabled.value = true;
      await walletOperation(undelegate);
    } catch (e) {
      Logger.error(e);
    } finally {
      disabled.value = false;
    }
  }
}

function validateInputs() {
  const selectedCurrency = assets.value[0];
  error.value = validateAmountV2(input.value, selectedCurrency.balance.value);
  return error.value;
}

async function undelegate() {
  if (wallet.wallet) {
    try {
      loading.value = true;

      const amountToTransfer = CurrencyUtils.convertNolusToUNolus(input.value);

      let amountToTransferDecimal = amountToTransfer.amount.toDec();
      const transactions = [];

      for (const item of delegatedData.value) {
        const amount = new Dec(item.balance.amount);

        const rest = amountToTransferDecimal.sub(amount);

        if (rest.isNegative() || rest.isZero()) {
          const transfer = new Dec(amountToTransferDecimal.toString());
          transactions.push({
            validator: item.delegation.validator_address,
            amount: coin(transfer.truncate().toString(), NATIVE_ASSET.denom)
          });
          break;
        } else {
          const transfer = new Dec(amount.toString());
          transactions.push({
            validator: item.delegation.validator_address,
            amount: coin(transfer.truncate().toString(), NATIVE_ASSET.denom)
          });
        }

        amountToTransferDecimal = rest;
      }

      const { txHash, txBytes, usedFee } = await wallet.wallet.simulateUndelegateTx(transactions);

      await wallet.wallet?.broadcastTx(txBytes as Uint8Array);
      await Promise.all([loadDelegated(), wallet.UPDATE_BALANCES()]);
      onClose();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.undelegate-successful")
      });
    } catch (err: Error | any) {
      error.value = err.toString();
      Logger.error(error);
    } finally {
      loading.value = false;
    }
  }
}
</script>
