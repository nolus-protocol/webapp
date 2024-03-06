<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="state.selectedCurrency"
    :receiverAddress="state.receiverAddress"
    :amount="state.amount"
    :txType="$t(`message.${TxType.REPAY}`) + ':'"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onSendClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
  />
  <RepayFormComponent
    v-else
    v-model="state"
    class="custom-scroll overflow-auto"
  />
</template>

<script setup lang="ts">
import type { LeaseData } from "@/common/types";
import type { RepayComponentProps } from "./types";
import type { Coin } from "@cosmjs/proto-signing";
import type { AssetBalance } from "@/common/stores/wallet/types";

import RepayFormComponent from "./RepayFormComponent.vue";
import ConfirmComponent from "@/common/components/modals/templates/ConfirmComponent.vue";

import { computed, inject, ref, watch, type PropType, onMounted } from "vue";
import { Lease } from "@nolus/nolusjs/build/contracts";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { Dec, Int } from "@keplr-wallet/unit";

import { CONFIRM_STEP } from "@/common/types";
import { TxType } from "@/common/types";
import { LeaseUtils, getMicroAmount, walletOperation } from "@/common/utils";
import { useWalletStore } from "@/common/stores/wallet";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { coin } from "@cosmjs/amino";
import { useOracleStore } from "@/common/stores/oracle";
import { AssetUtils } from "@/common/utils";
import { useApplicationStore } from "@/common/stores/application";
import { AppUtils } from "@/common/utils";

import {
  NATIVE_ASSET,
  GAS_FEES,
  TIP,
  PERMILLE,
  PERCENT,
  ErrorCodes,
  IGNORE_LEASE_ASSETS,
  minimumLeaseAmount,
  CurrencyMapping
} from "@/config/global";

const walletStore = useWalletStore();
const oracle = useOracleStore();
const app = useApplicationStore();

const walletRef = storeToRefs(walletStore);
const i18n = useI18n();

const onModalClose = inject("onModalClose", () => {});
const getLeases = inject("getLeases", () => {});

const step = ref(CONFIRM_STEP.CONFIRM);
const showConfirmScreen = ref(false);

const closeModal = onModalClose;

const props = defineProps({
  leaseData: {
    type: Object as PropType<LeaseData>
  }
});

const balances = computed(() => {
  const balances = walletStore.balances;

  return balances.filter((item) => {
    const currency = walletStore.currencies[item.balance.denom];
    const lpns = (app.lpn ?? []).map((item) => item.key);

    let [ticker, network] = currency.ticker.split("@");

    if (CurrencyMapping[ticker as keyof typeof CurrencyMapping]) {
      ticker = CurrencyMapping[ticker as keyof typeof CurrencyMapping]?.ticker;
    }

    if (IGNORE_LEASE_ASSETS.includes(ticker)) {
      return false;
    }

    if (network != props.leaseData?.protocol) {
      return false;
    }

    return lpns.includes(currency.ticker) || app.lease?.[props.leaseData?.protocol as string].includes(ticker);
  });
});

const state = ref({
  leaseInfo: props.leaseData?.leaseStatus?.opened,
  currentBalance: balances.value as AssetBalance[],
  selectedCurrency: balances.value[0] as AssetBalance,
  receiverAddress: props.leaseData?.leaseAddress || "",
  amount: "",
  amountErrorMsg: "",
  txHash: "",
  fee: coin(GAS_FEES.repay_lease + TIP.amount, NATIVE_ASSET.denom),
  swapFee: 0,
  onNextClick: () => onNextClick()
} as RepayComponentProps);

onMounted(async () => {
  setSwapFee();
});

watch(
  () => state.value.selectedCurrency,
  () => {
    setSwapFee();
    isAmountValid();
  }
);

watch(
  () => [...state.value.amount],
  (currentValue, oldValue) => {
    isAmountValid();
  }
);

async function setSwapFee() {
  const asset = walletStore.getCurrencyInfo(state.value.selectedCurrency.balance.denom);
  state.value.swapFee = (await AppUtils.getSwapFee())[asset.ticker] ?? 0;
}

async function onNextClick() {
  if (isAmountValid()) {
    showConfirmScreen.value = true;
  }
}

async function onSendClick() {
  try {
    await walletOperation(repayLease);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

function onConfirmBackClick() {
  showConfirmScreen.value = false;
}

function onClickOkBtn() {
  closeModal();
}

function isAmountValid() {
  let isValid = true;
  state.value.amountErrorMsg = "";

  const selectedPaymentDenom = state.value.selectedCurrency.balance.denom;
  const amount = state.value.amount;
  const currentBalance = getCurrentBalanceByDenom(selectedPaymentDenom);

  if (currentBalance) {
    if (amount || amount !== "") {
      const coinData = walletStore.getCurrencyInfo(currentBalance?.balance?.denom);
      const asset = walletStore.getCurrencyByTicker(coinData.ticker);
      const price = oracle.prices[asset!.ibcData as string];

      const amountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(amount, "", coinData.coinDecimals);
      const balance = CurrencyUtils.calculateBalance(price.amount, amountInMinimalDenom, coinData.coinDecimals).toDec();
      const minAmount = new Dec(minimumLeaseAmount);
      const p = new Dec(price.amount);
      const amountInStable = new Dec(amount.length == 0 ? "0" : amount).mul(p);

      let debt = outStandingDebt();
      const swap = hasSwapFee();

      if (swap) {
        debt = debt.add(debt.mul(new Dec(state.value.swapFee)));
      }

      const debtInCurrencies = debt.quo(new Dec(price.amount));
      const minAmountCurrency = minAmount.quo(p);

      const isLowerThanOrEqualsToZero = new Dec(amountInMinimalDenom.amount || "0").lte(new Dec(0));

      const isGreaterThanWalletBalance = new Int(amountInMinimalDenom.amount.toString() || "0").gt(
        currentBalance?.balance?.amount
      );

      if (isLowerThanOrEqualsToZero) {
        state.value.amountErrorMsg = i18n.t("message.invalid-balance-low");
        isValid = false;
      }

      if (isGreaterThanWalletBalance) {
        state.value.amountErrorMsg = i18n.t("message.invalid-balance-big");
        isValid = false;
      }

      if (amountInStable.lt(minAmount)) {
        state.value.amountErrorMsg = i18n.t("message.min-amount-allowed", {
          amount: minAmountCurrency.toString(Number(asset!.decimal_digits)),
          currency: asset!.shortName
        });
        isValid = false;
      }

      if (balance.gt(debt) && debt.gt(minAmountCurrency)) {
        state.value.amountErrorMsg = i18n.t("message.lease-only-max-error", {
          maxAmount: Number(debtInCurrencies.toString(Number(coinData.coinDecimals))),
          symbol: coinData.shortName
        });
        isValid = false;
      }
    } else {
      state.value.amountErrorMsg = i18n.t("message.missing-amount");
      isValid = false;
    }
  }

  return isValid;
}

async function repayLease() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && isAmountValid()) {
    step.value = CONFIRM_STEP.PENDING;
    try {
      const microAmount = getMicroAmount(state.value.selectedCurrency.balance.denom, state.value.amount);

      const funds: Coin[] = [
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
      const leaseClient = new Lease(cosmWasmClient, state.value.receiverAddress);

      const { txHash, txBytes, usedFee } = await leaseClient.simulateRepayLeaseTx(wallet, funds);

      state.value.txHash = txHash;

      if (usedFee?.amount?.[0]) {
        state.value.fee = usedFee.amount[0];
      }

      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;

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
    }
  }
}

function getCurrentBalanceByDenom(denom: string) {
  for (let currency of state.value.currentBalance) {
    if (currency.balance.denom == denom) {
      return currency;
    }
  }
}

function outStandingDebt() {
  const data = state.value.leaseInfo;
  const info = AssetUtils.getAssetInfo(data.principal_due.ticker);
  const additional = new Dec(additionalInterest().roundUp(), info.coinDecimals);
  const debt = new Dec(data.principal_due.amount, info.coinDecimals)
    .add(new Dec(data.overdue_margin.amount, info.coinDecimals))
    .add(new Dec(data.overdue_interest.amount, info.coinDecimals))
    .add(new Dec(data.due_margin.amount, info.coinDecimals))
    .add(new Dec(data.due_interest.amount, info.coinDecimals))
    .add(additional);
  return debt;
}

function additionalInterest() {
  const data = state.value.leaseInfo;
  if (data) {
    const principal_due = new Dec(data.principal_due.amount);
    const loanInterest = new Dec(data.loan_interest_rate / PERMILLE).add(new Dec(data.margin_interest_rate / PERCENT));
    const debt = LeaseUtils.calculateAditionalDebt(principal_due, loanInterest);

    return debt;
  }

  return new Dec(0);
}

function hasSwapFee() {
  const selectedCurrencyInfo = walletStore.getCurrencyInfo(state.value.selectedCurrency.balance.denom as string);
  const lpns = (app.lpn ?? []).map((item) => item.key);
  const isLpn = lpns.find((lpn) => {
    const [lpnTicker] = lpn!.split("@");
    return selectedCurrencyInfo.ticker == lpnTicker;
  });
  if (isLpn) {
    return false;
  }
  return true;
}

watch(walletRef.balances, (b: AssetBalance[]) => {
  if (b) {
    if (!state.value.selectedCurrency) {
      state.value.selectedCurrency = balances.value[0];
    }
  }
});
</script>
