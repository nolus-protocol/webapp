<template>
  <div class="flex flex-col gap-8">
    <ListHeader :title="$t('message.stake')">
      <Button
        v-if="walletConnected"
        :label="$t('message.delegate')"
        severity="secondary"
        size="large"
        @click="() => router.push(`/${RouteNames.STAKE}/${StakeDialog.DELEGATE}`)"
      />
      <Button
        v-if="walletConnected"
        :label="$t('message.undelegate')"
        severity="secondary"
        size="large"
        @click="() => router.push(`/${RouteNames.STAKE}/${StakeDialog.UNDELEGATE}`)"
      />
    </ListHeader>
    <div class="flex flex-col gap-8 lg:flex-row">
      <div class="order-2 lg:order-none lg:flex-[60%]">
        <DelegationOverview
          :delegated="delegated"
          :stableDelegated="stableDelegated"
          :validators="validatorRows"
          :showEmpty="showEmpty"
          :unboundingDelegations="unboundingDelegations"
        />
      </div>
      <div class="order-1 flex flex-col gap-8 lg:order-none lg:flex-[40%]">
        <StakingRewards
          :rewards="rewards"
          :stableRewards="stableRewards"
          :showEmpty="showEmpty"
        />
        <VestedOverview
          v-if="vestedTokens.length > 0"
          :vestedTokens="vestedTokens"
        />
      </div>
    </div>
    <router-view></router-view>
  </div>
</template>

<script lang="ts" setup>
import { Button, Label, type LabelProps, type TableRowItemProps } from "web-components";
import { RouteNames } from "@/router";
import type { IObjectKeys } from "@/common/types";

import ListHeader from "@/common/components/ListHeader.vue";
import VestedOverview from "./components/VestedOverview.vue";

import { StakeDialog } from "@/modules/stake/enums";
import { DelegationOverview, StakingRewards } from "./components";
import { computed, h, ref, watch } from "vue";
import { formatTokenBalance, formatUsd, formatMobileAmount, formatMobileUsd, formatPercent } from "@/common/utils/NumberFormatUtils";
import { isMobile } from "@/common/utils";
import { NATIVE_ASSET, NATIVE_CURRENCY, PERCENT } from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";
import { useStakingStore } from "@/common/stores/staking";
import { usePricesStore } from "@/common/stores/prices";
import { useConfigStore } from "@/common/stores/config";
import { Dec } from "@keplr-wallet/unit";
import { IntercomService } from "@/common/utils/IntercomService";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useWalletConnected } from "@/common/composables";
import RedelegateButton from "./components/RedelegateButton.vue";

const mobile = isMobile();
const wallet = useWalletStore();
const stakingStore = useStakingStore();
const pricesStore = usePricesStore();
const configStore = useConfigStore();

const i18n = useI18n();
const router = useRouter();
const walletConnected = useWalletConnected();

const vestedTokens = ref([] as { endTime: string; amount: { amount: string; denom: string } }[]);

// Watch for wallet connection changes (staking store is managed by connectionStore)
watch(
  () => wallet.wallet?.address,
  async (address) => {
    if (address) {
      await loadVested();
    } else {
      vestedTokens.value = [];
    }
  },
  { immediate: true }
);

async function loadVested() {
  vestedTokens.value = await wallet.LOAD_VESTED_TOKENS();
}

// Get native currency for price calculations
const nativeCurrency = computed(() => {
  return configStore.getCurrencyByTicker(NATIVE_ASSET.ticker);
});

const nativePrice = computed(() => {
  if (!nativeCurrency.value) return 0;
  return pricesStore.getPriceAsNumber(nativeCurrency.value.key);
});

// Total delegated amount
const delegated = computed(() => {
  return stakingStore.totalStaked;
});

// Total delegated in USD
const stableDelegated = computed(() => {
  const amount = new Dec(stakingStore.totalStaked, NATIVE_ASSET.decimal_digits);
  const stable = amount.mul(new Dec(nativePrice.value));

  // Update Intercom
  IntercomService.updateStaking({
    delegatedNls: amount.toString(),
    delegatedUsd: stable.toString(),
    validatorsCount: stakingStore.delegations.length
  });

  return stable.toString(2);
});

// Show empty state
const showEmpty = computed(() => {
  return !walletConnected.value || !stakingStore.hasPositions;
});

// Total rewards
const rewards = computed(() => {
  if (!stakingStore.hasPositions) return [];

  // Use totalRewards from store (already aggregated by backend)
  const rewardsAmount = new Dec(stakingStore.totalRewards, NATIVE_ASSET.decimal_digits);
  const stableAmount = rewardsAmount.mul(new Dec(nativePrice.value));

  return [
    {
      amount: `${formatTokenBalance(rewardsAmount)} ${NATIVE_ASSET.label}`,
      stableAmount: formatUsd(stableAmount.toString(2)),
      icon: NATIVE_ASSET.icon
    }
  ];
});

// Total rewards in USD
const stableRewards = computed(() => {
  const rewardsAmount = new Dec(stakingStore.totalRewards, NATIVE_ASSET.decimal_digits);
  const total = rewardsAmount.mul(new Dec(nativePrice.value));
  return total.toString(2);
});

// Unbonding delegations
const unboundingDelegations = computed<IObjectKeys[]>(() => {
  // Unbonding positions are now separate in the store
  return stakingStore.unbonding.map((u) => ({
    validator_address: u.validator_address,
    entries: u.entries.map((entry) => ({
      completion_time: entry.completion_time,
      balance: entry.balance
    }))
  }));
});

// Validator table rows
const validatorRows = computed<TableRowItemProps[]>(() => {
  return stakingStore.delegations
    .filter((position) => new Dec(position.balance.amount).gte(new Dec(1000)))
    .sort((a, b) => {
      const amountA = new Dec(a.balance.amount);
      const amountB = new Dec(b.balance.amount);
      return Number(amountB.sub(amountA).toString(8));
    })
    .map((position) => {
      const validator = stakingStore.getValidator(position.validator_address);
      const amount = new Dec(position.balance.amount, NATIVE_ASSET.decimal_digits);
      const stable = amount.mul(new Dec(nativePrice.value));
      const amountLabel = mobile ? formatMobileAmount(amount) : formatTokenBalance(amount);
      const stableLabel = mobile ? formatMobileUsd(stable) : formatUsd(stable.toString());

      // Commission rate as percentage
      const rate = validator ? formatPercent(new Dec(validator.commission_rate).mul(new Dec(PERCENT)).toString(2)) : formatPercent(0);

      const isJailed = validator?.jailed ?? false;

      if (mobile) {
        return {
          items: [
            {
              value: position.validator_moniker,
              variant: "left",
              class: "break-all"
            },
            {
              value: `${amountLabel} ${NATIVE_ASSET.label}`,
              subValue: stableLabel,
              variant: "right"
            }
          ]
        };
      }

      return {
        items: [
          {
            value: position.validator_moniker,
            subValue: validator?.website ?? "",
            variant: "left",
            class: "break-all"
          },
          {
            value: `${amountLabel} ${NATIVE_ASSET.label}`,
            subValue: stableLabel,
            variant: "right"
          },
          { value: rate, class: "max-w-[100px]" },
          {
            class: "max-w-[140px]",
            component: () =>
              isJailed
                ? h(RedelegateButton, { src: position.validator_address, amount: position.balance.amount })
                : h<LabelProps>(Label, { value: i18n.t("message.active"), variant: "secondary" })
          }
        ]
      };
    });
});
</script>
