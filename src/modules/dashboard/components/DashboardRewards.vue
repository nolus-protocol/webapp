<template>
  <Widget>
    <WidgetHeader
      :label="$t('message.rewards')"
      :icon="{ name: 'list-sparkle' }"
    />
    <div class="flex flex-col gap-y-2">
      <BigNumber
        :label="$t('message.unclaimed-rewards')"
        :amount="{
          amount: protocolRewards.toString(),
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol
        }"
      />
      <Button
        :label="$t('message.claim-earn-rewards')"
        severity="secondary"
        size="small"
        class="w-fit"
      />
    </div>
    <div class="flex flex-col gap-y-2">
      <BigNumber
        :label="$t('message.unclaimed-staking')"
        :amount="{
          amount: stakingRewards.toString(),
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol
        }"
      />
      <Button
        :label="$t('message.claim-stacking-rewards')"
        severity="secondary"
        size="small"
        class="w-fit"
        :loading="loadingStaking"
        @click="onWithdrawRewards"
      />
    </div>
  </Widget>
</template>

<script lang="ts" setup>
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import BigNumber from "@/common/components/BigNumber.vue";
import { Button, Widget } from "web-components";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { AssetUtils, Logger, NetworkUtils, WalletManager, walletOperation } from "@/common/utils";
import { Dec } from "@keplr-wallet/unit";
import { NATIVE_ASSET, NATIVE_CURRENCY, ProtocolsConfig } from "@/config/global";
import { NolusClient } from "@nolus/nolusjs";
import { Lpp } from "@nolus/nolusjs/build/contracts";
import { useWalletStore } from "@/common/stores/wallet";
import { useAdminStore } from "@/common/stores/admin";
import { ref, watch } from "vue";
import { useOracleStore } from "@/common/stores/oracle";

const wallet = useWalletStore();
const admin = useAdminStore();
const oracle = useOracleStore();

const stakingRewards = ref(new Dec(0));
const protocolRewards = ref(new Dec(0));
const loadingStaking = ref(false);

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
  const [r, lpnRewards] = await Promise.all([NetworkUtils.loadDelegator(), getRewards()]);
  const staking_rewards = new Dec(r?.total?.[0]?.amount ?? 0);

  stakingRewards.value = AssetUtils.getPriceByDenom(staking_rewards.truncate().toString(), NATIVE_ASSET.denom);
  protocolRewards.value = AssetUtils.getPriceByDenom(lpnRewards.truncate().toString(), NATIVE_ASSET.denom);
}

async function getRewards() {
  try {
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
    const promises = [];
    let rewards = new Dec(0);

    for (const protocolKey in admin.contracts) {
      if (ProtocolsConfig[protocolKey].rewards) {
        const fn = async () => {
          const contract = admin.contracts![protocolKey].lpp;
          const lppClient = new Lpp(cosmWasmClient, contract);
          const walletAddress = wallet.wallet?.address ?? WalletManager.getWalletAddress();

          const lenderRewards = await lppClient.getLenderRewards(walletAddress);
          rewards = rewards.add(new Dec(lenderRewards.rewards.amount));

          const [depositBalance, price] = await Promise.all([
            lppClient.getLenderDeposit(walletAddress as string),
            lppClient.getPrice()
          ]);
          const calculatedPrice = new Dec(price.amount_quote.amount).quo(new Dec(price.amount.amount));
          const amount = new Dec(depositBalance.balance).mul(calculatedPrice);
          const lpnReward = amount.sub(new Dec(depositBalance.balance)).truncateDec();
          const lpn = AssetUtils.getLpnByProtocol(protocolKey);

          rewards = rewards.add(new Dec(lpnReward.truncate(), lpn.decimal_digits));
        };
        promises.push(fn());
      }
    }

    await Promise.allSettled(promises);

    return rewards;
  } catch (e) {
    return new Dec(0);
  }
}

const onWithdrawRewards = async () => {
  try {
    await walletOperation(requestClaim);
  } catch (error: Error | any) {
    Logger.error(error);
  }
};

const requestClaim = async () => {
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
};
</script>
