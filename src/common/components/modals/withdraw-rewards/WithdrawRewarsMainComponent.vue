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
  />
</template>

<script lang="ts" setup>
import ConfirmComponent from "@/common/components/modals/templates/ConfirmComponent.vue";
import type { WithdrawRewardsComponentProps } from "./types";
import type { AssetBalance } from "@/common/stores/wallet/types";
import { CONFIRM_STEP, TxType } from "@/common/types";

import { inject, ref, type PropType, computed } from "vue";
import { coin } from "@cosmjs/amino";
import { CurrencyUtils } from "@nolus/nolusjs";
import { Dec } from "@keplr-wallet/unit";
import { useWalletStore } from "@/common/stores/wallet";
import { AssetUtils, NetworkUtils, WalletManager, walletOperation } from "@/common/utils";
import { ErrorCodes, GAS_FEES, NATIVE_ASSET } from "@/config/global";
import { useAdminStore } from "@/common/stores/admin";

const walletStore = useWalletStore();
const showConfirmScreen = ref(true);
const address = WalletManager.getWalletAddress();
const loadRewards = inject("loadRewards", async () => {});

const props = defineProps({
  amount: {
    type: Object as PropType<AssetBalance>,
    required: true
  }
});

const parsedAmount = computed(() => {
  const balance = CurrencyUtils.convertCoinUNolusToNolus(props.amount.balance);
  if (balance) {
    const b = balance.toDec().toString();
    return b;
  }
  return "0";
});

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
  onClickOkBtn: () => onClickOkBtn()
} as WithdrawRewardsComponentProps);

const step = ref(CONFIRM_STEP.CONFIRM);
const closeModal = inject("onModalClose", () => () => {});
const onNextClick = () => {};
const admin = useAdminStore();

const onConfirmBackClick = () => {
  showConfirmScreen.value = false;
  closeModal();
};

const onClickOkBtn = () => {
  closeModal();
};

const onWithdrawRewards = async () => {
  try {
    await walletOperation(requestClaim);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
};

const requestClaim = async () => {
  try {
    if (walletStore.wallet) {
      step.value = CONFIRM_STEP.PENDING;

      const delegator = await NetworkUtils.loadDelegator();

      const data = delegator.rewards
        .filter((item: any) => {
          const coin = item?.reward?.[0];

          if (coin) {
            const asset = AssetUtils.getAssetInfoByDenom(coin.denom);
            const amount = new Dec(coin.amount, asset.coinDecimals);

            if (amount.isPositive()) {
              return true;
            }
          }

          return false;
        })
        .map((item: any) => {
          return {
            validator: item.validator_address,
            delegator: walletStore.wallet?.address
          };
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
    }
    await walletStore.UPDATE_BALANCES();
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
};
</script>
