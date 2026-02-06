<template>
  <div class="custom-scroll max-h-full flex-1 overflow-auto">
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
      :error-msg="validationError"
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
              $t('message.undelegate-preview', { amount: `${input} ${NATIVE_ASSET.label}`, amountStable: stable, date })
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
      :label="$t('message.undelegate')"
      @click="onNextClick"
      :loading="disabled"
    />
    <p class="text-center text-12 text-typography-secondary">
      {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.delegateEstimation }}{{ $t("message.sec") }}
    </p>
  </div>
</template>

<script lang="ts" setup>
import { AdvancedFormControl, Button, ToastType, SvgIcon } from "web-components";
import { computed, inject, ref } from "vue";
import { NATIVE_ASSET, NATIVE_NETWORK } from "../../../config/global/network";
import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { useStakingStore } from "@/common/stores/staking";
import { useHistoryStore } from "@/common/stores/history";
import { Dec } from "@keplr-wallet/unit";
import { formatDateTime, Logger, validateAmountV2, walletOperation } from "@/common/utils";
import { useRouter } from "vue-router";
import { RouteNames } from "@/router";
import { formatNumber, formatDecAsUsd } from "@/common/utils/NumberFormatUtils";
import { getCurrencyByTicker } from "@/common/utils/CurrencyLookup";
import { usePricesStore } from "@/common/stores/prices";
import { coin } from "@cosmjs/stargate";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useI18n } from "vue-i18n";
import { UNDELEGATE_DAYS } from "@/config/global";

const wallet = useWalletStore();
const balancesStore = useBalancesStore();
const stakingStore = useStakingStore();
const historyStore = useHistoryStore();
const pricesStore = usePricesStore();
const i18n = useI18n();

const router = useRouter();
const input = ref("0");
const validationError = ref("");
const disabled = ref(false);

const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});

// Staking store positions are fetched by connectionStore.connectWallet()

const date = computed(() => {
  const date = new Date();
  date.setDate(date.getDate() + UNDELEGATE_DAYS);
  return formatDateTime(date.toString());
});

const assets = computed(() => {
  // Use staking store delegations
  const amount = new Dec(stakingStore.totalStaked, NATIVE_ASSET.decimal_digits);
  const balance = formatNumber(amount.toString(NATIVE_ASSET.decimal_digits), NATIVE_ASSET.decimal_digits);

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
  try {
    const currency = getCurrencyByTicker(NATIVE_ASSET.ticker);
    const price = new Dec(pricesStore.prices[currency.key]?.price ?? 0);
    const v = input?.value?.length ? input?.value : "0";
    const stable = price.mul(new Dec(v));
    return formatDecAsUsd(stable);
  } catch (e) {
    return "";
  }
});

const isEmpty = computed(() => {
  if (input.value.length == 0 || Number(input.value) == 0) {
    return true;
  }
  return false;
});

function onInput(data: string) {
  input.value = data;
  validateInputs();
}

async function onNextClick() {
  if (validateInputs().length == 0) {
    disabled.value = true;
    try {
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
  validationError.value = validateAmountV2(input.value, selectedCurrency.balance.value);
  return validationError.value;
}

async function undelegate() {
  if (!wallet.wallet) return;

  const amountToTransfer = CurrencyUtils.convertNolusToUNolus(input.value);

  let amountToTransferDecimal = amountToTransfer.amount.toDec();
  const transactions = [];

  for (const delegation of stakingStore.delegations) {
    const amount = new Dec(delegation.balance.amount);
    const rest = amountToTransferDecimal.sub(amount);

    if (rest.isNegative() || rest.isZero()) {
      const transfer = new Dec(amountToTransferDecimal.toString());
      transactions.push({
        validator: delegation.validator_address,
        amount: coin(transfer.truncate().toString(), NATIVE_ASSET.denom)
      });
      break;
    } else {
      const transfer = new Dec(amount.toString());
      transactions.push({
        validator: delegation.validator_address,
        amount: coin(transfer.truncate().toString(), NATIVE_ASSET.denom)
      });
    }

    amountToTransferDecimal = rest;
  }

  const { txBytes } = await wallet.wallet.simulateUndelegateTx(transactions);

  await wallet.wallet?.broadcastTx(txBytes as Uint8Array);
  await Promise.all([stakingStore.fetchPositions(), balancesStore.fetchBalances()]);
  historyStore.loadActivities();
  router.push(`/${RouteNames.STAKE}`);
  onShowToast({
    type: ToastType.success,
    message: i18n.t("message.undelegate-successful")
  });
}
</script>
