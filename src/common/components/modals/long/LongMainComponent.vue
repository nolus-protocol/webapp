<template>
  <ConfirmComponent
    class="lg:p-10"
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
  />
  <LongFormComponent
    v-else
    v-model="state"
    class="custom-scroll overflow-y-auto md:overflow-y-visible"
  />
</template>

<script setup lang="ts">
import LongFormComponent from "./LongFormComponent.vue";
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
  PositionTypes,
  Contracts
} from "@/config/global";

const onModalClose = inject("onModalClose", () => {});
const walletStore = useWalletStore();
const oracle = useOracleStore();
const app = useApplicationStore();

const walletRef = storeToRefs(walletStore);
const i18n = useI18n();
const ignoreLeaseAssets = ref<string[]>();

onMounted(async () => {
  ignoreLeaseAssets.value = await AppUtils.getIgnoreLeaseAssets();
});

const balances = computed(() => {
  let currencies: ExternalCurrency[] = [];

  for (const protocol in ProtocolsConfig) {
    if (ProtocolsConfig[protocol].type == PositionTypes.long) {
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
  const lpns = (app.lpn ?? []).map((item) => item.key);

  const b = balances.value.filter((item) => {
    const [ticker, protocol] = item.key.split("@");

    if (!ProtocolsConfig[protocol].lease) {
      return false;
    }

    return lpns.includes(ticker) || app.leasesCurrencies.includes(ticker);
  });
  return b;
});

const leaseBalances = computed(() => {
  const c = balances.value
    .filter((item) => {
      let [ticker, protocol] = item.key.split("@");
      if (CurrencyMapping[ticker as keyof typeof CurrencyMapping]) {
        ticker = CurrencyMapping[ticker as keyof typeof CurrencyMapping]?.ticker;
      }

      if (ignoreLeaseAssets.value?.includes(ticker) || ignoreLeaseAssets.value?.includes(`${ticker}@${protocol}`)) {
        return false;
      }

      return app.leasesCurrencies.includes(ticker);
    })
    .map((item) => {
      return item;
    });

  return c;
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
  selectedDownPaymentCurrency: paymentBalances.value.find(
    (item) => item.key == Contracts.longDefault
  ) as ExternalCurrency,
  selectedCurrency: leaseBalances.value.find((item) => item.key == Contracts.longDefault) as ExternalCurrency,
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

watch(walletRef.balances, async () => {
  if (balances) {
    state.value.currentBalance = balances.value;
  }
});

watch(
  () => state.value.downPayment,
  async () => {
    state.value.downPaymentErrorMsg = "";
    if (await validateMinMaxValues()) {
      calculate();
    }
  }
);

watch(
  () => [state.value.selectedDownPaymentCurrency, state.value.selectedCurrency],
  async () => {
    state.value.downPaymentErrorMsg = "";
    if (await validateMinMaxValues()) {
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
    state.value.downPaymentErrorMsg = "";
    if (downPaymentAmount) {
      const microAmount = getMicroAmount(
        state.value.selectedDownPaymentCurrency.balance.denom,
        state.value.downPayment
      );

      const currency = state.value.selectedDownPaymentCurrency;
      const lease = state.value.selectedCurrency;

      let [downPaymentTicker, protocol] = currency.key.split("@");
      let [leaseTicker] = lease.key.split("@");

      if (
        CurrencyMapping[downPaymentTicker as keyof typeof CurrencyMapping] &&
        (protocol == AppUtils.getProtocols().osmosis || protocol == AppUtils.getProtocols().osmosis_noble)
      ) {
        downPaymentTicker = CurrencyMapping[downPaymentTicker as keyof typeof CurrencyMapping]?.ticker;
      }

      if (CurrencyMapping[leaseTicker as keyof typeof CurrencyMapping]) {
        leaseTicker = CurrencyMapping[leaseTicker as keyof typeof CurrencyMapping]?.ticker;
      }

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const admin = useAdminStore();

      const leaserClient = new Leaser(cosmWasmClient, admin.contracts![protocol].leaser);
      state.value.contractAddress = admin.contracts![protocol].leaser;

      const makeLeaseApplyResp = await leaserClient.leaseQuote(
        microAmount.mAmount.amount.toString(),
        downPaymentTicker,
        leaseTicker,
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
  } catch (error: Error | any) {
    state.value.downPaymentErrorMsg = i18n.t("message.no-liquidity");
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

async function validateMinMaxValues(): Promise<boolean> {
  try {
    let isValid = true;
    const downPaymentAmount = state.value.downPayment;
    const currentBalance = state.value.selectedDownPaymentCurrency;

    const [c, p] = state.value.selectedCurrency.key.split("@");

    const range = (await AppUtils.getDownpaymentRange(p))[c];

    if (currentBalance) {
      if (downPaymentAmount || downPaymentAmount !== "") {
        const price = oracle.prices[state.value.selectedDownPaymentCurrency.key as string];

        const max = new Dec(range?.max ?? 0);
        const min = new Dec(range?.min ?? 0);

        const leaseMax = max.quo(new Dec(price.amount));
        const leaseMin = min.quo(new Dec(price.amount));

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

        if (balance.lt(min)) {
          state.value.downPaymentErrorMsg = i18n.t("message.lease-min-error", {
            minAmount: leaseMin.toString(state.value.selectedDownPaymentCurrency.decimal_digits),
            maxAmount: leaseMax.toString(state.value.selectedDownPaymentCurrency.decimal_digits),
            symbol: state.value.selectedDownPaymentCurrency.shortName
          });
          isValid = false;
        }

        if (balance.gt(max)) {
          state.value.downPaymentErrorMsg = i18n.t("message.lease-max-error", {
            minAmount: leaseMin.toString(state.value.selectedDownPaymentCurrency.decimal_digits),
            maxAmount: leaseMax.toString(state.value.selectedDownPaymentCurrency.decimal_digits),
            symbol: state.value.selectedDownPaymentCurrency.shortName
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
        }
        // {
        //   denom: TIP.denom,
        //   amount: TIP.amount.toString()
        // }
      ];

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const admin = useAdminStore();

      let [leaseTicker, protocol] = state.value.selectedCurrency.key.split("@");

      const leaserClient = new Leaser(cosmWasmClient, admin.contracts![protocol].leaser);

      if (CurrencyMapping[leaseTicker as keyof typeof CurrencyMapping]) {
        leaseTicker = CurrencyMapping[leaseTicker as keyof typeof CurrencyMapping]?.ticker;
      }

      const { txHash, txBytes, usedFee } = await leaserClient.simulateOpenLeaseTx(
        wallet,
        leaseTicker,
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
