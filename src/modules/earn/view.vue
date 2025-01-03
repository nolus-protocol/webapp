<template>
  <div class="col-span-12">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between px-4 lg:px-0 lg:pt-[25px]">
      <div class="left w-full md:w-1/2">
        <h1 class="m-0 text-20 font-semibold text-neutral-typography-200">
          {{ $t("message.earn-title") }}
        </h1>
      </div>
    </div>

    <div class="md:grid md:grid-cols-12 md:gap-4">
      <div class="md:col-span-7 lg:col-span-7">
        <!-- Assets -->
        <Table
          :class="['outline', { 'animate-pulse': loading }]"
          :columns="earningColumns"
          :title="$t('message.earning-assets')"
          class="mt-6"
        >
          <template
            v-if="loading"
            v-slot:body
          >
            <EarnAssetSkeleton />
          </template>
          <template
            v-else
            v-slot:body
          >
            <TransitionGroup
              appear
              name="fade"
            >
              <EarnLpnAsset
                v-for="lpn of lpnAsset"
                :key="lpn.key"
                :asset="lpn"
                :openSupplyWithdraw="() => openSupplyWithdrawDialog(lpn.key)"
              />
              <EarnNativeAsset
                key="nativeAsset"
                :asset="delegated"
                :openDelegateUndelegate="() => openDelegateUnDelegateDialog()"
                class="border-none"
              />
            </TransitionGroup>
          </template>
        </Table>
      </div>

      <div class="lg:co-span-5 md:col-span-5">
        <!-- Rewards -->
        <Table
          :title="$t('message.rewards')"
          class="mt-6"
        >
          <template v-slot:body>
            <EarnReward
              :cols="cols"
              :onClickClaim="onClickWithdrawRewards"
              :reward="reward"
            />
          </template>
        </Table>
      </div>
    </div>
  </div>

  <Modal
    v-if="showSupplyWithdrawDialog"
    route="supply"
    @close-modal="showSupplyWithdrawDialog = false"
  >
    <SupplyWithdrawDialog :selectedAsset="selectedAsset" />
  </Modal>

  <Modal
    v-if="showDelegateUndelegateDialog"
    route="delegate"
    @close-modal="showDelegateUndelegateDialog = false"
  >
    <DelegateUndelegateDialog />
  </Modal>

  <Modal
    v-if="showWithrawRewardsDialog"
    route="withdraw-rewards"
    @close-modal="showWithrawRewardsDialog = false"
  >
    <WithdrawRewardsDialog :amount="reward" />
  </Modal>

  <Modal
    v-if="showErrorDialog"
    route="alert"
    @close-modal="showErrorDialog = false"
  >
    <ErrorDialog
      :message="errorMessage"
      :title="$t('message.error-connecting')"
      :try-button="onClickTryAgain"
    />
  </Modal>
</template>

<script lang="ts" setup>
import type { AssetBalance } from "@/common/stores/wallet/types";
import type { Asset } from "./types";

import SupplyWithdrawDialog from "@/common/components/modals/SupplyWithdrawDialog.vue";
import DelegateUndelegateDialog from "@/common/components/modals/DelegateUndelegateDialog.vue";
import WithdrawRewardsDialog from "@/common/components/modals/WithdrawRewardsDialog.vue";

import Modal from "@/common/components/modals/templates/Modal.vue";
import ErrorDialog from "@/common/components/modals/ErrorDialog.vue";

import { EarnAssetSkeleton, EarnLpnAsset, EarnNativeAsset, EarnReward } from "./components";
import { onMounted, onUnmounted, provide, ref, watch } from "vue";
import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { AppUtils, Logger, NetworkUtils, WalletManager } from "@/common/utils";
import { Dec } from "@keplr-wallet/unit";
import { useWalletStore, WalletActions } from "@/common/stores/wallet";

import { claimRewardsMsg, type ContractData, Lpp } from "@nolus/nolusjs/build/contracts";
import { Contracts, NATIVE_ASSET, ProtocolsConfig, UPDATE_REWARDS_INTERVAL } from "@/config/global";
import { coin } from "@cosmjs/amino";
import { useApplicationStore } from "@/common/stores/application";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useAdminStore } from "@/common/stores/admin";
import { Table } from "web-components";
import { useOracleStore } from "@/common/stores/oracle";
import { Intercom } from "@/common/utils/Intercom";

const i18n = useI18n();

const wallet = useWalletStore();

let rewardsInterval: NodeJS.Timeout | undefined;
const cols = ref(3 as number);
const showSupplyWithdrawDialog = ref(false);
const showDelegateUndelegateDialog = ref(false);
const showWithrawRewardsDialog = ref(false);
const sort = [
  "OSMOSIS-OSMOSIS-ST_ATOM",
  "OSMOSIS-OSMOSIS-ALL_BTC",
  "OSMOSIS-OSMOSIS-ALL_SOL",
  "OSMOSIS-OSMOSIS-AKT",
  "OSMOSIS-OSMOSIS-USDC_NOBLE",
  "NEUTRON-ASTROPORT-USDC_NOBLE",
  "OSMOSIS-OSMOSIS-USDC_AXELAR",
  "NEUTRON-ASTROPORT-USDC_AXELAR"
];

const reward = ref({
  balance: coin(0, ChainConstants.COIN_MINIMAL_DENOM)
} as AssetBalance);

const delegated = ref({
  balance: coin(0, ChainConstants.COIN_MINIMAL_DENOM)
} as AssetBalance);

const claimContractData = ref([] as ContractData[]);
const selectedAsset = ref("");
const showErrorDialog = ref(false);
const errorMessage = ref("");
const loading = ref(true);
const lpnAsset = ref<Asset[] | []>([]);
const lpnReward = ref(new Dec(0));
const application = useApplicationStore();
const applicationRef = storeToRefs(application);
const admin = useAdminStore();
const oracle = useOracleStore();
const earningColumns = [
  { label: i18n.t("message.asset") },
  { label: i18n.t("message.deposit"), tooltip: i18n.t("message.deposit-tooltip"), class: "hidden md:flex" },
  { label: i18n.t("message.yield"), tooltip: i18n.t("message.earn-view-apr-tooltip"), class: "justify-end" }
];

onMounted(async () => {
  try {
    await Promise.allSettled([
      NetworkUtils.loadDelegations(),
      loadRewards(),
      loadLPNCurrency(),
      loadDelegated(),
      wallet[WalletActions.LOAD_STAKED_TOKENS]()
    ]);

    rewardsInterval = setInterval(async () => {
      await Promise.allSettled([NetworkUtils.loadDelegations(), loadRewards(), loadLPNCurrency(), loadDelegated()]);
    }, UPDATE_REWARDS_INTERVAL);

    loading.value = false;
  } catch (e: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = e?.message;
  }
});

onUnmounted(() => {
  clearInterval(rewardsInterval);
});

watch(
  () => wallet.balances,
  async (value) => {
    await Promise.allSettled([NetworkUtils.loadDelegations(), loadRewards(), loadLPNCurrency(), loadDelegated()]);
  }
);

watch(
  () => applicationRef.sessionExpired.value,
  (value) => {
    if (value) {
      clearInterval(rewardsInterval);
    }
  }
);

async function onClickTryAgain() {
  await Promise.all([loadRewards(), loadLPNCurrency()]);
}

function onClickWithdrawRewards() {
  showWithrawRewardsDialog.value = true;
}

function openSupplyWithdrawDialog(denom: string) {
  selectedAsset.value = denom;
  showSupplyWithdrawDialog.value = true;
}

async function loadRewards() {
  const [rewards, lpnRewards] = await Promise.all([NetworkUtils.loadDelegator(), getRewards()]);

  const total = rewards?.total?.[0];
  let value = new Dec("0").add(lpnRewards);

  if (total) {
    value = new Dec(total.amount).add(value);
  }

  reward.value = { balance: coin(value.truncate().toString(), NATIVE_ASSET.denom) };
}

async function getRewards() {
  try {
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
    const promises = [];
    let rewards = new Dec(0);

    for (const protocolKey in admin.contracts) {
      if (ProtocolsConfig[protocolKey].rewards) {
        const fn = async () => {
          try {
            const contract = admin.contracts![protocolKey].lpp;
            const lppClient = new Lpp(cosmWasmClient, contract);
            const walletAddress = wallet.wallet?.address ?? WalletManager.getWalletAddress();

            const lenderRewards = await lppClient.getLenderRewards(walletAddress);
            rewards = rewards.add(new Dec(lenderRewards.rewards.amount));
          } catch (e) {
            Logger.error(e);
          }
        };
        promises.push(fn());
      }
    }

    await Promise.allSettled(promises);
    lpnReward.value = rewards;

    return rewards;
  } catch (e) {
    Logger.error(e);
  }

  return new Dec(0);
}

async function loadDelegated() {
  const delegations = await NetworkUtils.loadDelegations();
  let decimalDelegated = new Dec(0);

  for (const item of delegations) {
    const d = new Dec(item.balance.amount);
    decimalDelegated = decimalDelegated.add(d);
  }

  delegated.value = { balance: coin(decimalDelegated.truncate().toString(), NATIVE_ASSET.denom) };
  Intercom.update({
    Nlsamountdelegated: new Dec(delegated.value.balance.amount ?? 0, NATIVE_ASSET.decimal_digits).toString()
  });
}

async function loadLPNCurrency() {
  const lpnCurrencies: Asset[] = [];
  const lpns = application.lpn;
  const promises = [];
  const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
  let usdAmount = new Dec(0);

  for (const lpn of lpns ?? []) {
    const index = wallet.balances.findIndex((item) => item.balance.denom == lpn.ibcData);
    if (index > -1) {
      const fn = async () => {
        const c = application.currenciesData![lpn.key!];
        const [_currency, protocol] = c.key!.split("@");
        const contract = admin.contracts![protocol].lpp;
        const lppClient = new Lpp(cosmWasmClient, contract);

        claimContractData.value.push({
          contractAddress: contract,
          msg: claimRewardsMsg()
        });

        const walletAddress = wallet.wallet?.address ?? WalletManager.getWalletAddress();

        const [depositBalance, price] = await Promise.all([
          lppClient.getLenderDeposit(walletAddress as string),
          lppClient.getPrice()
        ]);
        const calculatedPrice = new Dec(price.amount_quote.amount).quo(new Dec(price.amount.amount));
        const amount = new Dec(depositBalance.balance).mul(calculatedPrice).roundUp();
        usdAmount = usdAmount.add(
          new Dec(oracle.prices?.[lpn.key]?.amount ?? 0).mul(new Dec(amount, lpn.decimal_digits))
        );
        const currency = {
          key: c.key,
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

  Intercom.update({});

  for (const protocol of sort) {
    const index = lpnCurrencies.findIndex((item) => {
      const [_key, pr] = item.key.split("@");
      return pr == protocol;
    });
    if (index > -1) {
      items.push(lpnCurrencies[index]);
      lpnCurrencies.splice(index, 1);
    }
  }

  lpnAsset.value = [...items, ...lpnCurrencies].filter((item) => {
    const [t, p] = item.key.split("@");
    if (Contracts.ignoreProtocolsInEarn.includes(p)) {
      return false;
    }
    return true;
  });
}

function openDelegateUnDelegateDialog() {
  selectedAsset.value = `${NATIVE_ASSET.ticker}@${AppUtils.getDefaultProtocol()}`;
  showDelegateUndelegateDialog.value = true;
}

provide("loadRewards", loadRewards);
provide("loadLPNCurrency", loadLPNCurrency);
provide("loadDelegated", loadDelegated);
</script>
