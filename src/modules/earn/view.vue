<template>
  <div class="flex flex-col gap-8">
    <ListHeader :title="$t('message.earn')">
      <div
        class="flex gap-2"
        v-if="wallet.wallet"
      >
        <Button
          :label="$t('message.supply')"
          severity="secondary"
          size="large"
          @click="() => router.push(`/${RouteNames.EARN}/${EarnAssetsDialog.SUPPLY}`)"
        />
        <Button
          :label="$t('message.withdraw-title')"
          severity="secondary"
          size="large"
          @click="() => router.push(`/${RouteNames.EARN}/${EarnAssetsDialog.WITHDRAW}`)"
        />
      </div>
    </ListHeader>
    <div class="flex flex-col gap-8 lg:flex-row">
      <EarnAssets
        :stableAmount="stableAmount"
        :items="assetsRows"
        class="order-2 overflow-x-auto md:overflow-auto lg:order-none lg:flex-[60%]"
        :onSearch="onSearch"
      />
      <!-- <EarnRewards
        :rewards="lpnReward"
        :stableRewards="lpnRewardStable"
        class="order-1 lg:order-none lg:flex-[40%]"
      /> -->
    </div>
    <router-view></router-view>
  </div>
</template>

<script lang="ts" setup>
import ListHeader from "@/common/components/ListHeader.vue";
import PausedLabel from "./components/PausedLabel.vue";
import { Button } from "web-components";
import { RouteNames } from "@/router";

import { EarnAssets } from "./components";
import { EarnAssetsDialog } from "./enums";

import { computed, h, onMounted, onUnmounted, provide, ref, watch } from "vue";
import { type LabelProps, type TableRowItemProps } from "web-components";
import type { Asset } from "./types";
import { claimRewardsMsg, Lpp, type ContractData } from "@nolus/nolusjs/build/contracts";

import { AssetUtils, Logger, WalletManager } from "@/common/utils";
import {
  Contracts,
  NATIVE_ASSET,
  NATIVE_CURRENCY,
  ProtocolsConfig,
  SORT_PROTOCOLS,
  UPDATE_REWARDS_INTERVAL
} from "@/config/global";
import { useApplicationStore } from "@/common/stores/application";
import { CurrencyUtils, NolusClient } from "@nolus/nolusjs";
import { Coin, Dec } from "@keplr-wallet/unit";
import { useWalletStore } from "@/common/stores/wallet";
import { useAdminStore } from "@/common/stores/admin";
import { useOracleStore } from "@/common/stores/oracle";
import { Intercom } from "@/common/utils/Intercom";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

let interval: NodeJS.Timeout | undefined;
const lpnAsset = ref<Asset[] | []>([]);
const application = useApplicationStore();
const wallet = useWalletStore();
const admin = useAdminStore();
const oracle = useOracleStore();
const i18n = useI18n();
const router = useRouter();
const stableAmount = ref("0.00");
const lpnReward = ref<
  {
    amount: string;
    stableAmount: string;
    icon: string;
  }[]
>([]);
const lpnRewardStable = ref("0.00");
const claimContractData = ref([] as ContractData[]);
const search = ref("");

onMounted(async () => {
  try {
    await Promise.allSettled([loadLPNCurrency(), loadRewards()]);
    interval = setInterval(async () => {
      await Promise.allSettled([loadLPNCurrency(), loadRewards()]);
    }, UPDATE_REWARDS_INTERVAL);
  } catch (e: Error | any) {
    Logger.error(e);
  }
});

onUnmounted(() => {
  clearInterval(interval);
});

watch(
  () => [wallet.balances, application.protocolFilter],
  async (value) => {
    await Promise.allSettled([loadLPNCurrency(), loadRewards()]);
  }
);

function onSearch(data: string) {
  search.value = data;
}

async function loadLPNCurrency() {
  const lpnCurrencies: Asset[] = [];
  const protocols = Contracts.protocolsFilter[application.protocolFilter];

  const lpns = application.lpn?.filter((item) => {
    const c = application.currenciesData![item.key!];
    const [_currency, protocol] = c.key!.split("@");

    if (protocols.hold.includes(protocol)) {
      return true;
    }
    return false;
  });
  const promises = [];
  const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
  const claimContract: ContractData[] = [];
  let usdAmount = new Dec(0);

  for (const lpn of lpns ?? []) {
    const index = wallet.balances.findIndex((item) => item.balance.denom == lpn.ibcData);
    if (index > -1) {
      const fn = async () => {
        const c = application.currenciesData![lpn.key!];
        const [_currency, protocol] = c.key!.split("@");
        const contract = admin.contracts![protocol].lpp;
        const lppClient = new Lpp(cosmWasmClient, contract);
        let s = true;

        claimContract.push({
          contractAddress: contract,
          msg: claimRewardsMsg()
        });

        const walletAddress = wallet.wallet?.address ?? WalletManager.getWalletAddress();

        const [depositBalance, price, supply] = await Promise.all([
          lppClient.getLenderDeposit(walletAddress as string),
          lppClient.getPrice(),
          lppClient.getDepositCapacity()
        ]);

        if (Number(supply?.amount) == 0 || !ProtocolsConfig[protocol].supply) {
          s = false;
        }

        const calculatedPrice = new Dec(price.amount_quote.amount).quo(new Dec(price.amount.amount));
        const amount = new Dec(depositBalance.balance).mul(calculatedPrice).roundUp();
        usdAmount = usdAmount.add(
          new Dec(oracle.prices?.[lpn.key]?.amount ?? 0).mul(new Dec(amount, lpn.decimal_digits))
        );
        const currency = {
          key: c.key,
          supply: s,
          balance: {
            ...wallet.balances[index].balance
          }
        };
        currency.balance.amount = amount.toString();
        lpnCurrencies.push(currency);
      };
      promises.push(fn());
    }
  }

  await Promise.allSettled(promises);
  const items = [];
  Intercom.update({
    LentAmountUSD: usdAmount.toString()
  });

  for (const protocol of SORT_PROTOCOLS) {
    const index = lpnCurrencies.findIndex((item) => {
      const [_key, pr] = item.key.split("@");
      return pr == protocol;
    });
    if (index > -1) {
      items.push(lpnCurrencies[index]);
      lpnCurrencies.splice(index, 1);
    }
  }

  stableAmount.value = usdAmount.toString(2);
  claimContractData.value = claimContract;
  lpnAsset.value = [...items, ...lpnCurrencies].filter((item) => {
    const [_, p] = item.key.split("@");
    if (Contracts.ignoreProtocolsInEarn.includes(p)) {
      return false;
    }
    return true;
  });
}

const assetsRows = computed<TableRowItemProps[]>(() => {
  const param = search.value.toLowerCase();
  return lpnAsset.value
    .filter((item) => {
      if (param.length == 0) {
        return true;
      }
      const c = application.currenciesData![item.key];
      if (
        item.key.toLowerCase().includes(param) ||
        item.balance.denom.toLowerCase().includes(param) ||
        c.shortName?.toLowerCase()?.includes(param)
      ) {
        return true;
      }

      return false;
    })
    .map((item) => {
      const c = application.currenciesData![item.key!];

      const stable_b = CurrencyUtils.calculateBalance(
        oracle.prices[item.key]?.amount,
        new Coin(item.balance.denom, item.balance.amount.toString()),
        c.decimal_digits
      ).toDec();

      const balance = AssetUtils.formatNumber(new Dec(item.balance.amount, c.decimal_digits).toString(3), 3);
      const stable_balance = AssetUtils.formatNumber(stable_b.toString(2), 2);
      const [_ticker, protocol] = item.key?.split("@") ?? [];
      const apr = new Dec(application.apr?.[protocol] ?? 0).toString(2);

      return {
        supply: item.supply,
        balance,
        stable_balance,
        stable_balance_number: Number(stable_b.toString(2)),
        apr,
        currency: c
      };
    })
    .sort((a, b) => {
      return Number(b.stable_balance_number) - Number(a.stable_balance_number);
    })
    .map((item) => {
      const v = item.supply
        ? () =>
            h<LabelProps>(PausedLabel, {
              value: i18n.t("message.open"),
              variant: "success",
              class: "flex items-center"
            })
        : () =>
            h<LabelProps>(PausedLabel, {
              value: i18n.t("message.paused"),
              variant: "warning",
              class: "flex items-center"
            });

      return {
        items: [
          {
            value: item.currency.name,
            subValue: item.currency.shortName,
            image: item.currency.icon,
            variant: "left"
          },
          { value: `${item.balance}`, subValue: `${NATIVE_CURRENCY.symbol}${item.stable_balance}`, variant: "right" },
          { value: `${item.apr}%`, class: "text-typography-success" },
          { component: v }
        ]
      };
    });
});

async function loadRewards() {
  try {
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
    const promises = [];
    let rewards = new Dec(0);
    let stable = new Dec(0);
    const data: {
      amount: string;
      stableAmount: string;
      icon: string;
    }[] = [];

    for (const protocolKey in admin.contracts) {
      if (ProtocolsConfig[protocolKey].rewards) {
        const fn = async () => {
          try {
            const contract = admin.contracts![protocolKey].lpp;
            const lppClient = new Lpp(cosmWasmClient, contract);
            const walletAddress = wallet.wallet?.address ?? WalletManager.getWalletAddress();

            const lenderRewards = await lppClient.getLenderRewards(walletAddress);
            const c = application.currenciesData![`${NATIVE_ASSET.ticker}@${protocolKey}`];

            const a = new Dec(lenderRewards.rewards.amount, c.decimal_digits);
            const s = new Dec(oracle.prices[`${NATIVE_ASSET.ticker}@${protocolKey}`].amount).mul(a);

            stable = stable.add(s);
            rewards = rewards.add(a);
          } catch (e) {}
        };
        promises.push(fn());
      }
    }

    await Promise.allSettled(promises);

    data.push({
      amount: `${AssetUtils.formatNumber(rewards.toString(), NATIVE_ASSET.decimal_digits)} ${NATIVE_ASSET.label}`,
      stableAmount: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(stable.toString(2), 2)}`,
      icon: NATIVE_ASSET.icon
    });

    lpnReward.value = data;
    lpnRewardStable.value = stable.toString(2);
  } catch (e) {
    Logger.error(e);
  }

  return new Dec(0);
}

provide("loadLPNCurrency", loadLPNCurrency);
</script>
