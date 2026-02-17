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
    class="popover-dropdown !h-fit !w-auto !max-w-[160px] !rounded-xl !border !border-border-default"
  >
    <template #content>
      <button
        v-if="showDetails"
        class="button-secondary w-full border-none px-3 py-3 text-left"
        @click="viewDetails"
      >
        {{ $t("message.details") }}
      </button>
      <button
        v-if="showClose"
        class="button-secondary w-full border-none px-3 py-3 text-left"
        @click="onClose"
      >
        {{ $t("message.close") }}
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
        @click="sharePnl"
      >
        {{ $t("message.share-position") }}
      </button>
    </template>
  </Popover>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { Button, Popover } from "web-components";
import type { LeaseInfo } from "@/common/api";
import { useRouter } from "vue-router";
import { RouteNames } from "@/router";
import { getLeaseStatus, TEMPLATES } from "../common";
import { SingleLeaseDialog } from "../../enums";

export type IAction = { lease: LeaseInfo; showClose: boolean; opened: boolean; showDetails?: boolean };

const props = defineProps<IAction>();

const popoverParent = ref();
const isOpen = ref(false);
const emit = defineEmits(["sharePnl", "click"]);
const router = useRouter();

onMounted(() => {
  isOpen.value = props.opened;
});

function viewDetails() {
  router.push(`/${RouteNames.LEASES}/${props.lease.address}`);
  close();
}

function sharePnl() {
  emit("sharePnl");
  close();
}

function repay() {
  router.push(`/${RouteNames.LEASES}/repay/${props.lease.address}`);
  close();
}

function onClose() {
  router.push(`/${RouteNames.LEASES}/${SingleLeaseDialog.CLOSE}/${props.lease.address}`);
  close();
}

function close() {
  isOpen.value = false;
  emit("click", false);
}
</script>
