<template>
  <div class="flex flex-col items-center justify-center gap-y-4 self-center pb-4 text-center">
    <img
      v-if="image"
      v-bind="image"
      :src="emptyState[image.name as keyof typeof emptyState]"
      :class="['mx-auto w-full max-w-[255px] items-center object-contain', image.class]"
    />
    <span class="text-20 font-semibold text-typography-default">{{ title }}</span>
    <span class="text-14 font-normal text-typography-default">{{ description }}</span>
    <a
      v-if="link"
      :href="link.url"
      target="_blank"
      class="flex w-fit text-14 font-normal text-typography-link"
      >{{ link.label
      }}<SvgIcon
        name="help"
        class="rouded-full ml-1 fill-icon-link"
        size="s"
    /></a>
  </div>
</template>

<script lang="ts" setup>
import { type TooltipProps, SvgIcon } from "web-components";
import delegateNls from "@/assets/icons/empty-state/delegate-nls.png?url";
import depositAssets from "@/assets/icons/empty-state/deposit-assets.png?url";
import newLease from "@/assets/icons/empty-state/new-lease.png?url";
import noEntries from "@/assets/icons/empty-state/no-entries.png?url";
import noNotifications from "@/assets/icons/empty-state/no-notifications.png?url";
import noRewards from "@/assets/icons/empty-state/no-rewards.png?url";
import noResultsFound from "@/assets/icons/empty-state/no-results-found.png?url";
import positionHealth from "@/assets/icons/empty-state/position-health.png?url";
import positionSummary from "@/assets/icons/empty-state/position-summary.png?url";
import sessionTimeout from "@/assets/icons/empty-state/session-timeout.png?url";
import somethingWentWrong from "@/assets/icons/empty-state/something-went-wrong.png?url";
import strategies from "@/assets/icons/empty-state/strategies.png?url";

const emptyState = {
  "delegate-nls": delegateNls,
  "deposit-assets": depositAssets,
  "new-lease": newLease,
  "no-entries": noEntries,
  "no-notifications": noNotifications,
  "no-rewards": noRewards,
  "no-results-found": noResultsFound,
  "position-health": positionHealth,
  "position-summary": positionSummary,
  "session-timeout": sessionTimeout,
  "something-went-wrong": somethingWentWrong,
  strategies: strategies
};

defineProps<{
  image?: { alt?: string; class?: string; style?: string; name: string };
  title: string;
  description: string;
  link?: { url: string; label: string; tooltip?: TooltipProps };
}>();
</script>

<style scoped lang=""></style>
