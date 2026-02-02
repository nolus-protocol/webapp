<template>
  <Button
    ref="popoverParent"
    severity="tertiary"
    icon="more"
    size="small"
    class="ml-2 w-[40px] !p-2.5 text-icon-default"
    @click="
      () => {
        isOpen = !isOpen;
        emit('click', isOpen);
        return isOpen;
      }
    "
  />
  <Popover
    v-if="isOpen"
    position="bottom-right"
    :parent="popoverParent"
    @close="
      () => {
        isOpen = !isOpen;
        emit('click', isOpen);
        return isOpen;
      }
    "
    class="max-w-[160px]"
  >
    <template #content>
      <Collect
        v-if="showCollect"
        :lease="lease"
        class="button-secondary flex !min-h-[unset] w-full justify-start rounded-none border-none !px-3 !py-3 text-16 !font-medium"
        severity="secondary"
        size="large"
        @click="close"
      />
      <button
        v-if="showClose"
        class="button-secondary w-full border-none px-3 py-3 text-left"
        @click="onClose"
      >
        {{ $t("message.close") }}
      </button>
      <button
        class="button-secondary w-full border-none px-3 py-3 text-left"
        @click="sharePnl"
      >
        {{ $t("message.share-position") }}
      </button>
      <button
        v-if="getLeaseStatus(lease) == TEMPLATES.opened"
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
import Collect from "./Collect.vue";
import { onMounted, ref } from "vue";
import { Button, Popover } from "web-components";
import type { LeaseInfo } from "@/common/api";
import { useRouter } from "vue-router";
import { RouteNames } from "@/router";
import { getLeaseStatus, TEMPLATES } from "../common";
import { SingleLeaseDialog } from "../../enums";

export type IAction = { lease: LeaseInfo; showCollect: boolean; showClose: boolean; opened: boolean };

const props = defineProps<IAction>();

const popoverParent = ref();
const isOpen = ref(false);
const emit = defineEmits(["sharePnl", "click"]);
const router = useRouter();

onMounted(() => {
  isOpen.value = props.opened;
});

function sharePnl() {
  emit("sharePnl");
  close();
}

function repay() {
  router.push(`/${RouteNames.LEASES}/repay/${props.lease.protocol.toLocaleLowerCase()}/${props.lease.address}`);
  close();
}

function onClose() {
  router.push(
    `/${RouteNames.LEASES}/${SingleLeaseDialog.CLOSE}/${props.lease.protocol.toLocaleLowerCase()}/${props.lease.address}`
  );
  close();
}

function history() {
  router.push(`/${RouteNames.LEASES}/${props.lease.protocol.toLocaleLowerCase()}/${props.lease.address}#history`);
  close();
}

function close() {
  isOpen.value = false;
  emit("click", false);
}
</script>
