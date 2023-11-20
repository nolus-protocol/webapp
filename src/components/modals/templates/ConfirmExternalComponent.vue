<template>
  <!-- Header -->
  <div
    class="flex modal-send-receive-header"
    :class="{ 'no-border': !isStepCustomError }"
  >
    <div class="navigation-header">
      <button
        v-if="isStepConfirm"
        class="back-arrow"
        type="button"
        @click="onBackButtonClick"
      >
        <ArrowLeftIcon
          aria-hidden="true"
          class="h-5 w-5"
        />
      </button>
      <div class="flex flex-col justify-center items-center">
        <CheckIcon
          v-if="isStepSuccess"
          class="h-14 w-14 radius-circle p-2 success-icon mb-2"
        />
        <XMarkIcon
          v-if="isStepError || isStepCustomError"
          class="h-14 w-14 radius-circle p-2 error-icon mb-2"
        />
        <h1
          v-if="isStepCustomError"
          class="nls-font-700 text-28 md:text-32 text-center text-primary"
        >
          {{ $t(`message.${step}`, { symbol: networkSymbol }) }}
        </h1>
        <h1
          v-else
          class="nls-font-700 text-28 md:text-32 text-center text-primary"
        >
          {{ $t(`message.${step}`) }}
        </h1>
      </div>
    </div>
  </div>

  <div
    class="modal-form"
    v-if="isStepCustomError"
  >
    <div class="py-[28px]">
      {{ $t('message.gassErrorExternalMsg', { symbol: networkSymbol }) }}
    </div>
    <div class="px-[12px] pb-[28px]">
      <button
        class="btn btn-primary btn-large-primary w-auto"
        @click="btnAction"
      >
        {{ $t("message.close") }}
      </button>
    </div>
  </div>

  <form
    @submit.prevent="btnAction"
    class="modal-form"
    v-else
  >
    <!-- Input Area -->
    <div class="modal-send-receive-input-area pt-0">
      <div class="block bg-light-grey radius-rounded p-4 text-left break-words mt-[25px]">
        <div class="block">
          <p class="text-14 nls-font-400 text-primary m-0">{{ txType }}</p>
          <p class="text-14 text-primary nls-font-700 m-0">
            {{ receiverAddress }}
          </p>
        </div>

        <div
          v-if="memo"
          class="block mt-3"
        >
          <p class="text-14 nls-font-400 text-primary m-0">
            {{ $t("message.memo") }}:
          </p>
          <p class="text-14 text-primary nls-font-700 m-0">
            {{ memo }}
          </p>
        </div>

        <div class="block mt-3">
          <p class="text-14 nls-font-400 text-primary m-0">
            {{ $t("message.amount") }}
          </p>
          <p class="text-14 text-primary nls-font-700 m-0">
            {{ formatAmount(amount) }}
          </p>
        </div>

        <div
          v-if="txHash"
          class="block mt-3"
        >
          <p class="text-14 nls-font-400 text-primary m-0">
            {{ $t("message.tx-hash") }}:
          </p>
          <a
            :href="`${networkData.explorer}/${txHash}`"
            class="text-14 m-0 his-url"
            target="_blank"
          >
            {{ StringUtils.truncateString(txHash, 6, 6) }}
          </a>
        </div>
        <div
          v-if="fee"
          class="block mt-3"
        >
          <p class="text-14 nls-font-400 text-primary m-0">
            {{ $t("message.tx-and-fee") }}:
          </p>
          <p class="text-14 text-primary nls-font-700 m-0">
            {{ calculateFee(fee) }}
          </p>
        </div>
      </div>

      <div
        v-if="isStepConfirm && isMnemonicWallet()"
        class="block text-left mt-3"
      >
        <InputField
          id="password"
          :value="password"
          :label="$t('message.password')"
          name="password"
          type="password"
          :error-msg="errorMessage"
          :is-error="errorMessage !== ''"
          @input="(event: Event) => $emit('passwordUpdate', (event.target as HTMLInputElement).value)"
        >
        </InputField>
      </div>
    </div>

    <!-- Actions -->
    <div class="modal-send-receive-actions">
      <button :class="`btn btn-primary btn-large-primary ${isStepPending ? 'js-loading' : ''
        }`">
        {{ isStepConfirm ? $t("message.confirm") : $t("message.ok") }}
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import InputField from "@/components/InputField.vue";
import type { AssetBalance } from "@/stores/wallet/state";
import type { Coin } from "@cosmjs/amino";

import { computed, inject, onMounted, ref } from "vue";
import { ArrowLeftIcon, CheckIcon, XMarkIcon } from "@heroicons/vue/24/solid";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetUtils, EnvNetworkUtils, StringUtils, WalletUtils } from "@/utils";
import { CONFIRM_STEP } from "@/types";
import { useI18n } from "vue-i18n";
import { NETWORKS_DATA } from "@/networks";

const errorMessage = ref("");
const i18n = useI18n();

interface Props {
  selectedCurrency: AssetBalance;
  receiverAddress: string;
  password: string;
  amount: string;
  networkKey: string;
  memo?: string;
  txType: string;
  txHash: string;
  step: CONFIRM_STEP;
  fee?: Coin;
  networkSymbol?: string;
  networkCurrencies: {
    [key: string]: {
      name: string;
      symbol: string;
      decimal_digits: string;
      ibc_route: string[];
      ticker: string;
      icon: string;
    }
  },
  onSendClick: () => void;
  onBackClick: () => void;
  onOkClick: () => void;
}

defineEmits(["passwordUpdate"]);

const props = defineProps<Props>();
const isStepConfirm = computed(() => props.step === CONFIRM_STEP.CONFIRM);
const isStepPending = computed(() => props.step === CONFIRM_STEP.PENDING);
const isStepSuccess = computed(() => props.step === CONFIRM_STEP.SUCCESS);
const isStepError = computed(() => props.step === CONFIRM_STEP.ERROR);
const isStepCustomError = computed(() => props.step === CONFIRM_STEP.GasErrorExternal);

const networkData = computed(() => {
  return NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()].supportedNetworks[props.networkKey];
})

const networkSymbol = computed(() => {
  return AssetUtils.getAssetInfo(props.networkSymbol as string);
})

const btnAction = computed(() => {
  if (!checkValidation()) {
    return () => { };
  }
  return isStepConfirm.value ? props.onSendClick : props.onOkClick;
});

const checkValidation = () => {
  if (props.password.length == 0 && isMnemonicWallet()) {
    errorMessage.value = i18n.t("message.empty-password");
    return false;
  }
  return true;
};

const setShowDialogHeader = inject("setShowDialogHeader", (n: boolean) => { });

onMounted(() => {
  setShowDialogHeader(false);
});

const onBackButtonClick = () => {
  setShowDialogHeader(true);
  props.onBackClick();
}

const formatAmount = (value: string) => {
  const selectedCurrency = props.selectedCurrency;

  if (!selectedCurrency) {
    return;
  }

  const coinMinimalDenom = AssetUtils.makeIBCMinimalDenom(selectedCurrency.ibc_route!, selectedCurrency.symbol!);
  
  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
    value,
    coinMinimalDenom,
    selectedCurrency.decimals!
  );

  return CurrencyUtils.convertMinimalDenomToDenom(
    minimalDenom.amount.toString(),
    coinMinimalDenom,
    selectedCurrency.shortName!,
    selectedCurrency.decimals!
  );
}

const calculateFee = (coin: Coin) => {
  const currency = props.networkCurrencies[networkData.value.ticker];
  return CurrencyUtils.convertMinimalDenomToDenom(
    coin.amount.toString(),
    AssetUtils.makeIBCMinimalDenom(currency.ibc_route, currency.symbol),
    props.networkSymbol as string,
    Number(currency.decimal_digits)
  );
}

function isMnemonicWallet() {
  return WalletUtils.isConnectedViaMnemonic();
}
</script>
