<template>
  <Button
    ref="popoverParent"
    severity="tertiary"
    icon="more"
    size="small"
    class="ml-2 w-[40px] !p-2.5 text-icon-default"
    :class="popoverRef?.isOpen ? 'active' : ''"
    @click="popoverRef?.toggle()"
  />
  <Popover
    ref="popoverRef"
    position="bottom-right"
    :parent="popoverParent"
    :fullscreen-on-mobile="false"
    class="popover-dropdown !h-fit !w-auto !max-w-[160px] !rounded-xl !border !border-border-default"
  >
    <template #content>
      <button
        v-if="showDetails"
        class="button-secondary w-full border-none px-3 py-3 text-left"
        @click="navigate(`/${RouteNames.LEASES}/${lease.address}`)"
      >
        {{ $t("message.details") }}
      </button>
      <button
        v-if="showClose"
        class="button-secondary w-full border-none px-3 py-3 text-left"
        @click="navigate(`/${RouteNames.LEASES}/${SingleLeaseDialog.CLOSE}/${lease.address}`)"
      >
        {{ $t("message.close") }}
      </button>
      <button
        v-if="getLeaseStatus(lease) == TEMPLATES.opened"
        @click="navigate(`/${RouteNames.LEASES}/repay/${lease.address}`)"
        class="button-secondary w-full border-none px-3 py-3 text-left"
      >
        {{ $t("message.repay") }}
      </button>
      <button
        class="button-secondary w-full border-none px-3 py-3 text-left"
        @click="sharePnl"
      >
        {{ $t("message.share-position") }}
      </button>
    </template>
  </Popover>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { Button, Popover } from "web-components";
import type { LeaseInfo } from "@/common/api";
import { useRouter } from "vue-router";
import { RouteNames } from "@/router";
import { getLeaseStatus, TEMPLATES } from "../common";
import { SingleLeaseDialog } from "../../enums";

export type IAction = { lease: LeaseInfo; showClose: boolean; showDetails?: boolean };

defineProps<IAction>();
const popoverRef = ref<InstanceType<typeof Popover> | null>(null);
const popoverParent = ref();
const emit = defineEmits(["sharePnl"]);
const router = useRouter();

function navigate(path: string) {
  popoverRef.value?.close();
  router.push(path);
}

function sharePnl() {
  emit("sharePnl");
  popoverRef.value?.close();
}
</script>
