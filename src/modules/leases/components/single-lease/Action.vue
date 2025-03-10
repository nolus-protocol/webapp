<template>
  <Button
    ref="popoverParent"
    severity="tertiary"
    icon="more"
    size="small"
    class="ml-2 !p-2.5 text-icon-default"
    @click="isOpen = !isOpen"
  />
  <Popover
    v-if="isOpen"
    position="bottom-right"
    :parent="popoverParent"
    @close="isOpen = !isOpen"
    class="max-w-[160px]"
  >
    <template #content>
      <button
        class="button-secondary w-full border-none px-3 py-3 text-left"
        @click="onShowDetails"
      >
        {{ $t("message.details") }}
      </button>
      <button
        class="button-secondary w-full border-none px-3 py-3 text-left"
        @click="sharePnl"
      >
        {{ $t("message.share-position") }}
      </button>
      <button
        v-if="getStatus(lease) == TEMPLATES.opened"
        @click="repay"
        class="button-secondary w-full border-none px-3 py-3 text-left"
      >
        {{ $t("message.repay") }}
      </button>
      <button
        class="button-secondary w-full border-none px-3 py-3 text-left"
        @click="history"
      >
        {{ $t("message.history") }}
      </button>
    </template>
  </Popover>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { Button, Popover } from "web-components";
import type { LeaseData } from "@/common/types";
import { useRouter } from "vue-router";
import { RouteNames } from "@/router";
import { getStatus, TEMPLATES } from "../common";

export type IAction = { lease: LeaseData };

const props = defineProps<IAction>();

const popoverParent = ref();
const isOpen = ref(false);
const emit = defineEmits(["sharePnl"]);
const router = useRouter();

function sharePnl() {
  emit("sharePnl");
  close();
}

function repay() {
  router.push(`/${RouteNames.LEASES}/repay/${props.lease.protocol.toLocaleLowerCase()}/${props.lease.leaseAddress}`);
  close();
}

function history() {
  router.push(`/${RouteNames.LEASES}/${props.lease.protocol.toLocaleLowerCase()}/${props.lease.leaseAddress}#history`);
  close();
}

function onShowDetails() {
  router.push(`/${RouteNames.LEASES}/${props.lease.protocol.toLocaleLowerCase()}/${props.lease.leaseAddress}`);
  close();
}

function close() {
  isOpen.value = false;
}
</script>
