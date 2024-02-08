<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="state.selectedCurrency"
    :receiver-address="address"
    :password="state.password"
    :amount="state.amount"
    :txType="$t(`message.${TxType.GET_REWARD}`)"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onWithdrawRewards"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value) => (state.password = value)"
  />
</template>

<script lang="ts" setup>
import ConfirmComponent from "@/components/modals/templates/ConfirmComponent.vue";
import type { WithdrawRewardsComponentProps } from "@/types/component";
import type { AssetBalance } from "@/stores/wallet/state";

import { CONFIRM_STEP } from "@/types/ConfirmStep";
import { TxType } from "@/types/TxType";
import { walletOperation } from "@/components/utils";
import { inject, onUnmounted, ref, type PropType, computed } from "vue";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";
import { NATIVE_ASSET, GAS_FEES, ErrorCodes } from "@/config/env";
import { AssetUtils, WalletManager } from "@/utils";
import { coin } from "@cosmjs/amino";
import { CurrencyUtils } from "@nolus/nolusjs";
import { SNACKBAR } from "@/config/env";
import { Dec } from "@keplr-wallet/unit";
import { useAdminStore } from "@/stores/admin";

const walletStore = useWalletStore();
const showConfirmScreen = ref(true);
const address = WalletManager.getWalletAddress();
const loadRewards = inject("loadRewards", async () => { });

const props = defineProps({
  amount: {
    type: Object as PropType<AssetBalance>,
    required: true,
  },
});

const parsedAmount = computed(() => {
  const balance = CurrencyUtils.convertCoinUNolusToNolus(props.amount.balance);
  if (balance) {
    const b = balance.toDec().toString();
    return b;
  }
  return '0'
})

const state = ref({
  currentBalance: walletStore.balances,
  selectedCurrency: walletStore.balances.find((item) => item.balance.denom == NATIVE_ASSET.denom),
  amount: parsedAmount.value,
  password: "",
  txHash: "",
  fee: coin(GAS_FEES.withdraw_delegator_reward, NATIVE_ASSET.denom),
  onNextClick: () => onNextClick(),
  onSendClick: () => onWithdrawRewards(),
  onConfirmBackClick: () => onConfirmBackClick(),
  onClickOkBtn: () => onClickOkBtn(),
} as WithdrawRewardsComponentProps);

const step = ref(CONFIRM_STEP.CONFIRM);
const closeModal = inject("onModalClose", () => () => { });
const onNextClick = () => { }
const snackbarVisible = inject("snackbarVisible", () => false);
const showSnackbar = inject("showSnackbar", (type: string, transaction: string) => { });
const admin = useAdminStore();

onUnmounted(() => {
  if (CONFIRM_STEP.PENDING == step.value) {
    showSnackbar(SNACKBAR.Queued, state.value.txHash);
  }
});

const onConfirmBackClick = () => {
  showConfirmScreen.value = false;
  closeModal();
}

const onClickOkBtn = () => {
  closeModal();
}

const onWithdrawRewards = async () => {
  try {
    await walletOperation(requestClaim, state.value.password);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

const requestClaim = async () => {
  try {

    if (walletStore.wallet) {
      step.value = CONFIRM_STEP.PENDING;

      const delegator = await walletStore[WalletActionTypes.LOAD_DELEGATOR]();

      const data = delegator.rewards.filter((item: any) => {
        const coin = item?.reward?.[0];

        if (coin) {
          const asset = AssetUtils.getAssetInfoByDenom(coin.denom);
          const amount = new Dec(coin.amount, asset.coinDecimals);

          if (amount.isPositive()) {
            return true;
          }
        }

        return false;
      }).map((item: any) => {
        return {
          validator: item.validator_address,
          delegator: walletStore.wallet?.address
        }
      });

      const contracts = [];

      for (const protocolKey in admin.contracts) {
        const protocol = admin.contracts[protocolKey].lpp;
        contracts.push(protocol);
      }

      const { txHash, txBytes, usedFee } = await walletStore.wallet.simulateClaimRewards(data, contracts);
      state.value.txHash = txHash;

      if (usedFee?.amount?.[0]) {
        state.value.fee = usedFee.amount[0];
      }

      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;
      loadRewards();
      if (snackbarVisible()) {
        showSnackbar(isSuccessful ? SNACKBAR.Success : SNACKBAR.Error, txHash);
      }

    }
    await walletStore[WalletActionTypes.UPDATE_BALANCES]();

  } catch (error: Error | any) {
    switch (error.code) {
      case (ErrorCodes.GasError): {
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
</script>
