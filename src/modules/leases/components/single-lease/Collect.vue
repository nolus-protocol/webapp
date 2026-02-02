<template>
  <Button
    :class="$attrs.class"
    :label="$t('message.collect')"
    :severity="severity"
    :size="size"
    :disabled="isCollectDisabled"
    :loading="isCollectLoading || loadingCollect"
    @click="onClaimSubmit"
  />
</template>

<script lang="ts" setup>
import type { LeaseInfo } from "@/common/api";
import { Button, ToastType, type ButtonSize, type ButtonType } from "web-components";
import { useWalletStore } from "@/common/stores/wallet";
import { useI18n } from "vue-i18n";
import { computed, inject, ref } from "vue";
import { Logger, walletOperation } from "@/common/utils";
import { NolusClient, NolusWallet } from "@nolus/nolusjs";
import { Lease } from "@nolus/nolusjs/build/contracts";

export interface ICollect {
  lease: LeaseInfo;
  severity: ButtonType;
  size: ButtonSize;
}

const props = defineProps<ICollect>();
const walletStore = useWalletStore();
const i18n = useI18n();
const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});
const reload = inject("reload", () => {});

const isCollectLoading = ref(false);
const isCollectDisabled = ref(false);

async function onClaim(lease: LeaseInfo) {
  if (lease.status === "closing" || lease.status === "paid_off") {
    try {
      isCollectLoading.value = true;

      const wallet = walletStore.wallet as NolusWallet;
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(cosmWasmClient, lease.address);

      const { txHash, txBytes, usedFee } = await leaseClient.simulateClosePositionLeaseTx(wallet);

      await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      walletStore.loadActivities();
      reload();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.claim-successful")
      });
    } catch (e) {
      Logger.error(e);
    } finally {
      isCollectLoading.value = false;
    }
  }
}

async function onClaimSubmit() {
  try {
    isCollectDisabled.value = true;
    await walletOperation(() => onClaim(props.lease));
  } catch (error: Error | any) {
    Logger.error(error);
  } finally {
    isCollectDisabled.value = false;
  }
}

const loadingCollect = computed(() => {
  // Check if lease is in closing status with in_progress state
  if (props.lease.status === "closing" && props.lease.in_progress) {
    const inProgress = props.lease.in_progress;
    if (inProgress === "transfer_in_init" || inProgress === "transfer_in_finish") {
      return true;
    }
  }

  return false;
});
</script>
