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
            $t('message.delegate-preview', { amount: `${input} ${NATIVE_ASSET.label}`, amountStable: stable })
          "
        ></p>
      </div>
    </template>
  </div>
  <hr class="border-border-color" />

  <div class="flex flex-1 flex-col justify-end">
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
        {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.delegateEstimation }}{{ $t("message.sec") }}
      </p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { AdvancedFormControl, Button, ToastType, SvgIcon } from "web-components";
import { computed, inject, ref } from "vue";
import { NATIVE_ASSET, NATIVE_CURRENCY, NATIVE_NETWORK, STAKING } from "../../../config/global/network";
import { useWalletStore } from "@/common/stores/wallet";
import { Dec } from "@keplr-wallet/unit";
import { AssetUtils, Logger, NetworkUtils, Utils, validateAmountV2, walletOperation } from "@/common/utils";
import { useOracleStore } from "@/common/stores/oracle";
import { coin } from "@cosmjs/stargate";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useI18n } from "vue-i18n";
const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});

const wallet = useWalletStore();
const oracle = useOracleStore();
const input = ref("0");
const error = ref("");
const loading = ref(false);
const disabled = ref(false);
const i18n = useI18n();
const loadDelegated = inject("loadDelegated", () => false);
const onClose = inject("close", () => {});

const assets = computed(() => {
  const balance = AssetUtils.formatNumber(
    new Dec(wallet.total_unls.balance.amount, NATIVE_ASSET.decimal_digits).toString(NATIVE_ASSET.decimal_digits),
    NATIVE_ASSET.decimal_digits
  );

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
    try {
      disabled.value = true;
      await walletOperation(delegate);
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

async function delegate() {
  try {
    loading.value = true;

    if (wallet.wallet && error.value.length == 0) {
      let validators = await getValidators();
      let division = STAKING.VALIDATORS_NUMBER;

      if (validators?.length > 0) {
        division = validators?.length;
      }

      const data = CurrencyUtils.convertNolusToUNolus(input.value);
      const amount = Number(data.amount.toString());
      const quotient = Math.floor(amount / division);
      const remainder = amount % division;
      const amounts = [];

      validators = validators.sort((a: any, b: any) => {
        return Number(b.commission.commission_rates.rate) - Number(a.commission.commission_rates.rate);
      });

      for (const v of validators) {
        amounts.push({
          value: quotient,
          validator: v.operator_address
        });
      }

      amounts[0].value += remainder;

      const delegations = amounts.map((item) => {
        return {
          validator: item.validator,
          amount: coin(item.value, data.denom)
        };
      });

      const { txHash, txBytes, usedFee } = await wallet.wallet.simulateDelegateTx(delegations);

      await wallet.wallet?.broadcastTx(txBytes as Uint8Array);
      await Promise.all([loadDelegated(), wallet.UPDATE_BALANCES()]);
      wallet.loadActivities();
      onClose();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.delegate-successful")
      });
    }
  } catch (err: Error | any) {
    error.value = err.toString();
    Logger.error(error);
  } finally {
    loading.value = false;
  }
}

async function getValidators() {
  const delegatorValidators = await NetworkUtils.loadDelegatorValidators();

  if (delegatorValidators.length > 0) {
    return delegatorValidators;
  }

  let validators = await NetworkUtils.loadValidators();
  let loadedValidators = [];
  if (validators.length > STAKING.SLICE) {
    validators = validators
      .slice(STAKING.SLICE)
      .filter((item: any) => {
        const date = new Date(item.unbonding_time);
        const time = Date.now() - date.getTime();

        if (time > STAKING.SLASHED_DAYS && !item.jailed) {
          return true;
        }

        return false;
      })
      .filter((item: any) => {
        const commission = Number(item.commission.commission_rates.rate);
        if (commission <= STAKING.PERCENT) {
          return true;
        }
        return false;
      });
  }

  for (let i = 0; i < STAKING.VALIDATORS_NUMBER; i++) {
    const index = Utils.getRandomInt(0, validators.length);
    loadedValidators.push(validators[index]);
    validators.splice(index, 1);
  }

  return loadedValidators;
}
</script>
