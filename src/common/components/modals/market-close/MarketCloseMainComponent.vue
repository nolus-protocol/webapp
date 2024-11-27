<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="state.selectedCurrency"
    :receiverAddress="state.receiverAddress"
    :amount="state.amount"
    :txType="$t(`message.${TxType.MARKET_CLOSE}`) + ':'"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onSendClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
  />
  <MarketCloseFormComponent
    v-else
    v-model="state"
    class="custom-scroll overflow-auto"
  />
</template>

<script setup lang="ts">
import type { ExternalCurrency, LeaseData } from "@/common/types";
import type { MarketCloseComponentProps } from "./types";
import type { Coin } from "@cosmjs/proto-signing";
import type { AssetBalance } from "@/common/stores/wallet/types";

import MarketCloseFormComponent from "./MarketCloseFormComponent.vue";
import ConfirmComponent from "../templates/ConfirmComponent.vue";

import { computed, inject, ref, watch, type PropType, onUnmounted } from "vue";
import { Lease } from "@nolus/nolusjs/build/contracts";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { Dec, Int } from "@keplr-wallet/unit";

import { CONFIRM_STEP } from "@/common/types";
import { TxType } from "@/common/types";
import { AssetUtils, Logger, SkipRouter, getMicroAmount, walletOperation } from "@/common/utils";
import { useWalletStore } from "@/common/stores/wallet";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import {
  NATIVE_ASSET,
  GAS_FEES,
  TIP,
  ErrorCodes,
  minimumLeaseAmount,
  ProtocolsConfig,
  PositionTypes
} from "@/config/global";
import { coin } from "@cosmjs/amino";
import { useLeaseConfig } from "@/common/composables";
import { useOracleStore } from "@/common/stores/oracle";
import { useApplicationStore } from "@/common/stores/application";
import { CurrencyDemapping } from "@/config/currencies";

const walletStore = useWalletStore();
const walletRef = storeToRefs(walletStore);
const oracle = useOracleStore();
const i18n = useI18n();
const app = useApplicationStore();
const timeOut = 200;
let time: NodeJS.Timeout;

const onModalClose = inject("onModalClose", () => {});
const getLeases = inject("getLeases", () => {});

const step = ref(CONFIRM_STEP.CONFIRM);
const showConfirmScreen = ref(false);
const props = defineProps({
  leaseData: {
    type: Object as PropType<LeaseData>
  }
});

onUnmounted(() => {
  clearTimeout(time);
});

const closeModal = onModalClose;
const { config } = useLeaseConfig(props.leaseData?.protocol as string, (error: Error | any) => {});

const balances = computed(() => {
  const assets: ExternalCurrency[] = [];

  const ticker =
    CurrencyDemapping[props.leaseData?.leaseStatus?.opened?.amount?.ticker!]?.ticker ??
    props.leaseData?.leaseStatus?.opened?.amount?.ticker;

  for (const key in app.currenciesData ?? {}) {
    const currency = app.currenciesData![key];
    const c = { ...currency };
    const item = walletStore.balances.find((item) => item.balance.denom == currency.ibcData);
    if (item) {
      c.balance = item!.balance;
      assets.push(c);
    }
  }

  return assets.filter((item) => item.key == `${ticker}@${props.leaseData?.protocol}`);
});

const state = ref({
  leaseInfo: props.leaseData?.leaseStatus?.opened,
  protocol: props.leaseData?.protocol,
  currentBalance: balances.value as ExternalCurrency[],
  selectedCurrency: balances.value[0] as ExternalCurrency,
  receiverAddress: props.leaseData?.leaseAddress || "",
  amount: "",
  amountErrorMsg: "",
  txHash: "",
  fee: coin(GAS_FEES.market_close_lease + TIP.amount, NATIVE_ASSET.denom),
  swapFee: 0,
  onNextClick: () => onNextClick()
} as MarketCloseComponentProps);

watch(
  () => state.value.selectedCurrency,
  () => {
    setSwapFee();
  }
);

watch(
  () => [...state.value.amount],
  (currentValue, oldValue) => {
    isAmountValid();
    setSwapFee();
  }
);

// async function setSwapFee() {
//   const asset = state.value.selectedCurrency;
//   state.value.swapFee = (await AppUtils.getSwapFee())[asset.ticker] ?? 0;
// }

const setSwapFee = async () => {
  clearTimeout(time);
  if (isAmountValid()) {
    time = setTimeout(async () => {
      const lease = state.value.selectedCurrency;
      let currecy =
        app.currenciesData![`${props.leaseData?.leaseData?.leasePositionTicker}@${props.leaseData?.protocol}`];
      const lpn = AssetUtils.getLpnByProtocol(props.leaseData?.protocol as string);
      let microAmount = CurrencyUtils.convertDenomToMinimalDenom(
        state.value.amount,
        lease.balance.ibcData,
        lease.decimal_digits
      ).amount.toString();

      switch (ProtocolsConfig[props.leaseData?.protocol!].type) {
        case PositionTypes.short: {
          currecy = lease;
          microAmount = CurrencyUtils.convertDenomToMinimalDenom(
            state.value.amount,
            currecy.balance.ibcData,
            currecy.decimal_digits
          ).amount.toString();

          break;
        }
      }

      let amountIn = 0;
      let amountOut = 0;
      const [r] = await Promise.all([
        SkipRouter.getRoute(currecy.ibcData, lpn.ibcData, microAmount).then((data) => {
          amountIn += Number(data.usdAmountIn ?? 0);
          amountOut += Number(data.usdAmountOut ?? 0);

          return Number(data?.swapPriceImpactPercent ?? 0);
        })
      ]);
      const out_a = Math.max(amountOut, amountIn);
      const in_a = Math.min(amountOut, amountIn);

      const diff = out_a - in_a;
      let fee = 0;

      if (in_a > 0) {
        fee = diff / in_a;
      }

      state.value.swapFee = fee;
    }, timeOut);
  }
};

async function onNextClick() {
  if (isAmountValid()) {
    showConfirmScreen.value = true;
  }
}

async function onSendClick() {
  try {
    await walletOperation(marketCloseLease);
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

  const amount = state.value.amount;
  const currency = AssetUtils.getCurrencyByTicker(state.value.leaseInfo.amount.ticker!);
  const debt = new Dec(state.value.leaseInfo.amount.amount, Number(currency.decimal_digits));
  const minAmountCurrency = AssetUtils.getCurrencyByTicker(
    config.value?.config.lease_position_spec.min_asset.ticker as string
  )!;
  const minAmont = new Dec(
    config.value?.config.lease_position_spec.min_asset.amount ?? 0,
    Number(minAmountCurrency.decimal_digits)
  );
  const price = new Dec(oracle.prices[currency.key as string].amount);

  const minAmountTemp = new Dec(minimumLeaseAmount);
  const amountInStable = new Dec(amount.length == 0 ? "0" : amount).mul(price);

  if (amount || amount !== "") {
    const amountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(amount, "", Number(currency.decimal_digits));
    const value = new Dec(amountInMinimalDenom.amount, Number(currency.decimal_digits));

    const isLowerThanOrEqualsToZero = new Dec(amountInMinimalDenom.amount || "0").lte(new Dec(0));

    if (isLowerThanOrEqualsToZero) {
      state.value.amountErrorMsg = i18n.t("message.invalid-balance-low");
      isValid = false;
    }

    if (amountInStable.lt(minAmountTemp)) {
      state.value.amountErrorMsg = i18n.t("message.min-amount-allowed", {
        amount: minAmountTemp.quo(price).toString(Number(currency.decimal_digits)),
        currency: currency.shortName
      });
      isValid = false;
    } else if (value.gt(debt)) {
      state.value.amountErrorMsg = i18n.t("message.lease-only-max-error", {
        maxAmount: Number(debt.toString(Number(currency.decimal_digits))),
        symbol: currency.shortName
      });
      isValid = false;
    } else if (!value.equals(debt) && debt.sub(value).mul(price).lte(minAmont)) {
      state.value.amountErrorMsg = i18n.t("message.lease-min-amount", {
        amount: Number(minAmont.quo(price).toString(Number(currency.decimal_digits))),
        symbol: currency.shortName
      });
      isValid = false;
    }
  } else {
    state.value.amountErrorMsg = i18n.t("message.missing-amount");
    isValid = false;
  }

  return isValid;
}

function getCurrency() {
  const microAmount = getMicroAmount(state.value.selectedCurrency.balance.denom, state.value.amount);
  const amount = new Int(state.value.leaseInfo.amount.amount);

  if (amount.equals(microAmount.mAmount.amount)) {
    return undefined;
  }

  const currency = state.value.selectedCurrency;

  return {
    ticker: currency.ticker,
    amount: microAmount.mAmount.amount.toString()
  };
}

async function marketCloseLease() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && isAmountValid()) {
    step.value = CONFIRM_STEP.PENDING;
    try {
      const funds: Coin[] = [
        {
          denom: TIP.denom,
          amount: TIP.amount.toString()
        }
      ];

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(cosmWasmClient, state.value.receiverAddress);

      const { txHash, txBytes, usedFee } = await leaseClient.simulateClosePositionLeaseTx(wallet, getCurrency(), funds);

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
      Logger.error(error);
    }
  }
}

watch(walletRef.balances, (b: AssetBalance[]) => {
  if (b && !state.value.selectedCurrency) {
    state.value.selectedCurrency = balances.value[0];
  }
});
</script>
