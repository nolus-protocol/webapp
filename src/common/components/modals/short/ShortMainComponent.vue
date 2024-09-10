<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="state.selectedDownPaymentCurrency"
    :receiverAddress="state.contractAddress"
    :amount="state.downPayment"
    :memo="state.memo"
    :txType="$t(`message.${TX_TYPE.LEASE}`) + ':'"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onSendClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    class="lg:p-10"
  />
  <ShortFormComponent
    v-else
    v-model="state"
    class="custom-scroll overflow-y-auto md:overflow-y-visible"
  />
</template>

<script setup lang="ts">
import ShortFormComponent from "./ShortFormComponent.vue";
import ConfirmComponent from "../templates/ConfirmComponent.vue";

import type { LeaseComponentProps } from "./types";

import { inject, ref, watch, onMounted } from "vue";
import { Leaser } from "@nolus/nolusjs/build/contracts";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { Dec, Int } from "@keplr-wallet/unit";

import { CONFIRM_STEP, type ExternalCurrency, type IObjectKeys } from "@/common/types";
import { TxType } from "@/common/types";
import { Logger, getMicroAmount, walletOperation } from "@/common/utils";
import { useWalletStore } from "@/common/stores/wallet";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { computed } from "vue";
import { coin } from "@cosmjs/amino";
import { useOracleStore } from "@/common/stores/oracle";
import { useApplicationStore } from "@/common/stores/application";
import { AppUtils } from "@/common/utils";
import { useAdminStore } from "@/common/stores/admin";
import { CurrencyMapping } from "@/config/currencies";

import {
  NATIVE_ASSET,
  GAS_FEES,
  TIP,
  WASM_EVENTS,
  INTEREST_DECIMALS,
  DEFAULT_LTD,
  PERMILLE,
  ErrorCodes,
  ProtocolsConfig,
  PositionTypes
} from "@/config/global";

const onModalClose = inject("onModalClose", () => {});
const walletStore = useWalletStore();
const oracle = useOracleStore();
const app = useApplicationStore();

const walletRef = storeToRefs(walletStore);
const i18n = useI18n();

const balances = computed(() => {
  let currencies: ExternalCurrency[] = [];

  for (const protocol in ProtocolsConfig) {
    if (ProtocolsConfig[protocol].type == PositionTypes.short) {
      for (const c of ProtocolsConfig[protocol].currencies) {
        const item = app.currenciesData?.[`${c}@${protocol}`];
        let balance = walletStore.balances.find((c) => c.balance.denom == item?.ibcData);
        currencies.push({ ...item, balance: balance?.balance } as ExternalCurrency);
      }
    }
  }

  return currencies;
});

const paymentBalances = computed(() => {
  const b = balances.value.filter((item) => {
    const [_, protocol] = item.key.split("@");

    if (!ProtocolsConfig[protocol].lease) {
      return false;
    }

    return true;
  });
  return b;
});

const leaseBalances = computed(() => {
  let currencies: ExternalCurrency[] = [];

  for (const protocol of app.protocols) {
    if (ProtocolsConfig[protocol].type == PositionTypes.short) {
      const c =
        app.lease![protocol].map((item) => {
          const currency = app.currenciesData![`${item}@${protocol}`];
          return currency;
        }) ?? [];
      currencies = [...currencies, ...c];
    }
  }
  return currencies;
});

const step = ref(CONFIRM_STEP.CONFIRM);
const TX_TYPE = ref(TxType);
const showConfirmScreen = ref(false);

const props = defineProps({
  selectedAsset: {
    type: String
  }
});

const state = ref({
  contractAddress: "",
  currentBalance: balances.value as ExternalCurrency[],
  selectedDownPaymentCurrency: paymentBalances.value[0] as ExternalCurrency,
  selectedCurrency: leaseBalances.value[0] as ExternalCurrency,
  dialogSelectedCurrency: props.selectedAsset,
  downPayment: "",
  memo: "",
  onNextClick: (price) => onNextClick(price),
  downPaymentErrorMsg: "",
  txHash: "",
  fee: coin(GAS_FEES.open_lease + TIP.amount, NATIVE_ASSET.denom),
  leaseApply: null,
  ltd: DEFAULT_LTD * PERMILLE
} as LeaseComponentProps);

const getLeases = inject("getLeases", () => {});
let leaseAssetPrice: string | null;
let downPaymentRange: { [key: string]: { min: number; max: number } };

onMounted(async () => {
  downPaymentRange = await AppUtils.getDownpaymentRange();
});

watch(walletRef.balances, async () => {
  if (balances) {
    state.value.currentBalance = balances.value;
  }
});

watch(
  () => state.value.downPayment,
  () => {
    state.value.downPaymentErrorMsg = "";
    if (validateMinMaxValues()) {
      calculate();
    }
  }
);

watch(
  () => [state.value.selectedDownPaymentCurrency, state.value.selectedCurrency],
  () => {
    state.value.downPaymentErrorMsg = "";
    if (validateMinMaxValues()) {
      calculate();
    }
  }
);

watch(
  () => state.value.selectedCurrency,
  () => {
    calculate();
  }
);

watch(
  () => state.value.ltd,
  () => {
    calculate();
  }
);

async function calculate() {
  try {
    const downPaymentAmount = state.value.downPayment;

    if (downPaymentAmount) {
      const microAmount = getMicroAmount(
        state.value.selectedDownPaymentCurrency.balance.denom,
        state.value.downPayment
      );

      const currency = state.value.selectedDownPaymentCurrency;

      let [downPaymentTicker, protocol] = currency.key.split("@");

      if (
        CurrencyMapping[downPaymentTicker as keyof typeof CurrencyMapping] &&
        (protocol == AppUtils.getProtocols().osmosis || protocol == AppUtils.getProtocols().osmosis_noble)
      ) {
        downPaymentTicker = CurrencyMapping[downPaymentTicker as keyof typeof CurrencyMapping]?.ticker;
      }

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const admin = useAdminStore();

      const leaserClient = new Leaser(cosmWasmClient, admin.contracts![protocol].leaser);
      state.value.contractAddress = admin.contracts![protocol].leaser;

      const makeLeaseApplyResp = await leaserClient.leaseQuote(
        microAmount.mAmount.amount.toString(),
        downPaymentTicker,
        app.lease?.[protocol][0] as string,
        state.value.ltd
      );

      makeLeaseApplyResp.annual_interest_rate =
        makeLeaseApplyResp.annual_interest_rate / Math.pow(10, INTEREST_DECIMALS);
      makeLeaseApplyResp.annual_interest_rate_margin =
        makeLeaseApplyResp.annual_interest_rate_margin / Math.pow(10, INTEREST_DECIMALS);

      state.value.leaseApply = makeLeaseApplyResp;
    } else {
      state.value.leaseApply = null;
    }
  } catch (error) {
    state.value.leaseApply = null;
  }
}

async function onNextClick(price: string) {
  leaseAssetPrice = price;
  if (isDownPaymentAmountValid()) {
    showConfirmScreen.value = true;
  }
}

async function onSendClick() {
  try {
    await walletOperation(openLease);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

function onConfirmBackClick() {
  showConfirmScreen.value = false;
}

function onClickOkBtn() {
  onModalClose();
}

function isDownPaymentAmountValid() {
  let isValid = true;
  state.value.downPaymentErrorMsg = "";

  const selectedDownPaymentDenom = state.value.selectedDownPaymentCurrency.balance.denom;
  const downPaymentAmount = state.value.downPayment;
  const currentBalance = getCurrentBalanceByDenom(selectedDownPaymentDenom);

  if (currentBalance) {
    if (downPaymentAmount || downPaymentAmount !== "") {
      const downPaymentAmountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
        downPaymentAmount,
        "",
        currentBalance.decimal_digits
      );

      const isLowerThanOrEqualsToZero = new Dec(downPaymentAmountInMinimalDenom.amount || "0").lte(new Dec(0));

      const isGreaterThanWalletBalance = new Int(downPaymentAmountInMinimalDenom.amount.toString() || "0").gt(
        currentBalance?.balance?.amount
      );

      if (isLowerThanOrEqualsToZero) {
        state.value.downPaymentErrorMsg = i18n.t("message.invalid-balance-low");
        isValid = false;
      }

      if (isGreaterThanWalletBalance) {
        state.value.downPaymentErrorMsg = i18n.t("message.invalid-balance-big");
        isValid = false;
      }

      if (!validateMinMaxValues()) {
        isValid = false;
      }
    } else {
      state.value.downPaymentErrorMsg = i18n.t("message.missing-amount");
      isValid = false;
    }
  }

  return isValid;
}

function validateMinMaxValues(): boolean {
  try {
    let isValid = true;
    const downPaymentAmount = state.value.downPayment;
    const currentBalance = state.value.selectedDownPaymentCurrency;

    const currency = state.value.selectedCurrency;
    const downPaymentCurrency = state.value.selectedDownPaymentCurrency;
    const range = downPaymentRange?.[currency.ticker];
    const rangedownPaymentCurrency = downPaymentRange?.[downPaymentCurrency.ticker];
    const values: number[] = [];

    if (range?.max != null) {
      values.push(range.max);
    }

    if (rangedownPaymentCurrency?.max != null) {
      values.push(rangedownPaymentCurrency.max);
    }

    const max = Math.min(...values);

    if (currentBalance) {
      if (downPaymentAmount || downPaymentAmount !== "") {
        const leaseMax = new Dec(max);
        const leaseMin = new Dec(range.min);

        const price = oracle.prices[currentBalance!.ibcData as string];

        const downPaymentAmountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
          downPaymentAmount,
          currentBalance.ibcData,
          currentBalance.decimal_digits
        );
        const balance = CurrencyUtils.calculateBalance(
          price.amount,
          downPaymentAmountInMinimalDenom,
          currentBalance.decimal_digits
        ).toDec();

        if (balance.lt(leaseMin)) {
          state.value.downPaymentErrorMsg = i18n.t("message.lease-min-error", {
            minAmount: Math.ceil((range.min / Number(price.amount)) * 1000) / 1000,
            maxAmount: Math.ceil((max / Number(price.amount)) * 1000) / 1000,
            symbol: currentBalance.shortName
          });
          isValid = false;
        }

        if (balance.gt(leaseMax)) {
          state.value.downPaymentErrorMsg = i18n.t("message.lease-max-error", {
            minAmount: Math.ceil((range.min / Number(price.amount)) * 1000) / 1000,
            maxAmount: Math.ceil((max / Number(price.amount)) * 1000) / 1000,
            symbol: currentBalance.shortName
          });
          isValid = false;
        }
      }
    }

    return isValid;
  } catch (error) {
    state.value.downPaymentErrorMsg = i18n.t("message.integer-out-of-range");
    return false;
  }
}

function getCurrentBalanceByDenom(denom: string) {
  for (let currency of state.value.currentBalance) {
    if (currency.balance.denom == denom) {
      return currency;
    }
  }
}

async function openLease() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && isDownPaymentAmountValid()) {
    step.value = CONFIRM_STEP.PENDING;
    try {
      const microAmount = getMicroAmount(
        state.value.selectedDownPaymentCurrency.balance.denom,
        state.value.downPayment
      );

      const funds = [
        {
          denom: microAmount.coinMinimalDenom,
          amount: microAmount.mAmount.amount.toString()
        },
        {
          denom: TIP.denom,
          amount: TIP.amount.toString()
        }
      ];

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const admin = useAdminStore();

      let [_, protocol] = state.value.selectedCurrency.key.split("@");

      const leaserClient = new Leaser(cosmWasmClient, admin.contracts![protocol].leaser);

      const { txHash, txBytes, usedFee } = await leaserClient.simulateOpenLeaseTx(
        wallet,
        app.lease?.[protocol][0] as string,
        state.value.ltd,
        funds
      );

      state.value.txHash = txHash;

      if (usedFee?.amount?.[0]) {
        state.value.fee = usedFee.amount[0];
      }

      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;

      const item = tx?.events.find((item: IObjectKeys) => {
        return item.type == WASM_EVENTS["wasm-ls-request-loan"].key;
      });

      const data = item?.attributes[WASM_EVENTS["wasm-ls-request-loan"].index];

      if (data && leaseAssetPrice) {
        localStorage.setItem(
          data.value,
          JSON.stringify({
            leasePositionTicker: state.value.selectedCurrency.key
          })
        );
      }

      getLeases();
    } catch (error: Error | any) {
      switch (error.code) {
        case ErrorCodes.GasError: {
          step.value = CONFIRM_STEP.GasError;
          break;
        }
        default: {
          step.value = CONFIRM_STEP.ERROR;
          break;
        }
      }
      Logger.error(error);
    }
  }
}
</script>
