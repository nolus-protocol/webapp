<template>
  <div class="relative flex justify-center">
    <div
      class="items-center justify-center overflow-hidden"
      :class="[{ 'relative min-h-[400px] w-full': slider.length > 1 }]"
    >
      <template
        v-for="(slide, index) in slider"
        :key="slide.image?.name"
      >
        <div
          class="flex w-full flex-col items-center justify-center gap-y-4 self-center pb-4 text-center transition-transform duration-300"
          :style="{
            transform: `translateX(${(index - currentIndex) * 100}%)`,
            position: slider.length > 1 ? 'absolute' : 'relative'
          }"
        >
          <img
            v-if="slide.image"
            v-bind="slide.image"
            :src="emptyState[slide.image.name as keyof typeof emptyState]"
            :class="['mx-auto w-full max-w-[255px] items-center object-contain', slide.image.class]"
          />
          <span class="text-20 font-semibold text-typography-default">{{ slide.title }}</span>
          <span class="text-14 font-normal text-typography-default">{{ slide.description }}</span>
          <Button
            v-if="slide.button"
            :icon="slide.button.icon"
            icon-position="left"
            :label="slide.button.name"
            severity="secondary"
            size="large"
            @click="() => router.push(slide.button!.url)"
          />
          <button
            v-if="slide.link"
            @click="router.push(slide.link?.url)"
            :href="slide.link.url"
            target="_blank"
            class="flex w-fit text-14 font-normal text-typography-link"
          >
            {{ slide.link.label }}
            <SvgIcon
              name="help"
              class="rouded-full ml-1 fill-icon-link"
              size="s"
            />
          </button>
        </div>
      </template>
    </div>
    <div
      class="absolute flex w-full justify-between self-center md:w-[calc(70%)]"
      v-if="slider.length > 1"
    >
      <Button
        severity="secondary"
        icon="arrow-left"
        size="small"
        class="!p-2.5 text-icon-default"
        :disabled="currentIndex === 0"
        @click="prevImage"
      />
      <Button
        severity="secondary"
        icon="arrow-right"
        size="small"
        class="!p-2.5 text-icon-default"
        :disabled="currentIndex === slider.length - 1"
        @click="nextImage"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { Button, SvgIcon, type TooltipProps } from "web-components";
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
import government from "@/assets/icons/empty-state/government.png?url";
import networkRewards from "@/assets/icons/empty-state/network-rewards.png?url";
import unlockDiscounts from "@/assets/icons/empty-state/unlock-discounts.png?url";
import { ref } from "vue";
import { useRouter } from "vue-router";

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
  government: government,
  "network-rewards": networkRewards,
  "unlock-discounts": unlockDiscounts,
  strategies: strategies
};

const currentIndex = ref(0);
const router = useRouter();

const props = defineProps<{
  slider: {
    image?: { alt?: string; class?: string; style?: string; name: string };
    title: string;
    description: string;
    link?: { url: string; label: string; tooltip?: TooltipProps };
    button?: { name: string; icon: string; url: string };
  }[];
  // images?: { alt?: string; class?: string; style?: string; name: string }[];
}>();

function prevImage() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
  }
}

function nextImage() {
  if (currentIndex.value < props.slider?.length - 1) {
    currentIndex.value++;
  }
}
</script>

<style scoped lang=""></style>
