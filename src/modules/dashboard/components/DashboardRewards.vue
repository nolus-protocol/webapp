<template>
  <Widget>
    <WidgetHeader
      :label="$t('message.staking-rewards')"
      :icon="{ name: 'list-sparkle' }"
    >
      <Button
        :label="$t('message.claim-rewards')"
        severity="secondary"
        size="large"
        :loading="loadingStaking"
        :disabled="disabled"
        @click="onWithdrawRewards"
      />
    </WidgetHeader>
    <div class="flex flex-col gap-y-2">
      <BigNumber
        :label="$t('message.unclaimed-staking')"
        :amount="{
          amount: rewards.stableAmount,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol
        }"
      />
    </div>
    <Asset
      :icon="rewards.icon"
      :amount="rewards.amount"
      :stable-amount="`${rewards.stableAmount}`"
    />
  </Widget>
</template>

<script lang="ts" setup>
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import BigNumber from "@/common/components/BigNumber.vue";
import { Button, Widget, Asset } from "web-components";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { AssetUtils, Logger, NetworkUtils, walletOperation } from "@/common/utils";
import { Dec } from "@keplr-wallet/unit";
import { NATIVE_ASSET, NATIVE_CURRENCY } from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";
import { ref, watch } from "vue";
import { useOracleStore } from "@/common/stores/oracle";

const wallet = useWalletStore();
const oracle = useOracleStore();

const loadingStaking = ref(false);
const disabled = ref(false);
const rewards = ref<{
  amount: string;
  stableAmount: string;
  icon: string;
}>({
  amount: `0.00 ${NATIVE_ASSET.label}`,
  stableAmount: `${NATIVE_CURRENCY.symbol}0.00`,
  icon: NATIVE_ASSET.icon
});

watch(
  () => [wallet.wallet, oracle.prices],
  async () => {
    try {
      await setRewards();
    } catch (e) {
      Logger.error(e);
    }
  },
  {
    immediate: true
  }
);

async function setRewards() {
  const [r] = await Promise.all([NetworkUtils.loadDelegator()]);
  const total = new Dec(new Dec(r?.total?.[0]?.amount ?? 0).truncate(), NATIVE_ASSET.decimal_digits);
  const currency = AssetUtils.getCurrencyByTicker(NATIVE_ASSET.ticker);
  const price = new Dec(oracle.prices?.[currency.key]?.amount ?? 0);
  const stable = price.mul(total);

  rewards.value = {
    amount: `${AssetUtils.formatNumber(total.toString(), NATIVE_ASSET.decimal_digits)} ${NATIVE_ASSET.label}`,
    stableAmount: AssetUtils.formatNumber(stable.toString(2), 2),
    icon: NATIVE_ASSET.icon
  };
}

async function onWithdrawRewards() {
  try {
    disabled.value = true;
    await walletOperation(requestClaim);
  } catch (error: Error | any) {
    Logger.error(error);
  } finally {
    disabled.value = false;
  }
}

async function requestClaim() {
  try {
    loadingStaking.value = true;
    if (wallet.wallet) {
      const delegator = await NetworkUtils.loadDelegator();

      const data = delegator.rewards
        .filter((item: any) => {
          const coin = item?.reward?.[0];

          if (coin) {
            const asset = AssetUtils.getCurrencyByDenom(coin.denom);
            const amount = new Dec(coin.amount, asset.decimal_digits);

            if (amount.isPositive()) {
              return true;
            }
          }

          return false;
        })
        .map((item: any) => {
          return {
            validator: item.validator_address,
            delegator: wallet.wallet?.address
          };
        });

      const { txHash, txBytes, usedFee } = await wallet.wallet.simulateWithdrawRewardTx(data);
      await wallet.wallet?.broadcastTx(txBytes as Uint8Array);

      setRewards();
    }
    await wallet.UPDATE_BALANCES();
  } catch (error: Error | any) {
    Logger.error(error);
  } finally {
    loadingStaking.value = false;
  }
}
</script>
