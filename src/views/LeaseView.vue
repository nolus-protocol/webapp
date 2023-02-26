<template>
  <div class="col-span-12 mb-sm-nolus-70">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between px-4 lg:pt-[25px] lg:px-0">
      <div class="left w-full md:w-1/2">
        <h1 class="text-20 nls-font-700 text-primary m-0 nls-sm-title">
          {{ $t("message.leases") }}
        </h1>
      </div>
      <div class="right w-full md:w-1/2 md:mt-0 inline-flex justify-start md:justify-end">
        <button
          class="btn btn-primary btn-large-primary w-full md:w-auto"
          @click="showLeaseModal = true"
        >
          {{ $t("message.lease-new") }}
        </button>
      </div>
    </div>

    <!-- Leases -->

    <TransitionGroup
      name="fade-long"
      appear
      tag="div"
    >
      <div
        v-for="lease in leases"
        :key="lease.leaseAddress"
      >
        <LeaseInfo :lease-info="lease" />
      </div>
    </TransitionGroup>
  </div>

  <Modal
    v-if="showLeaseModal"
    @close-modal="showLeaseModal = false"
    route="create"
  >
    <LeaseDialog />
  </Modal>
  <Modal
    v-if="errorDialog.showDialog"
    @close-modal="errorDialog.showDialog = false"
  >
    <ErrorDialog
      :title="$t('message.error-connecting')"
      :message="errorDialog.errorMessage"
      :try-button="onTryAgain"
    />
  </Modal>
</template>

<script lang="ts" setup>
import LeaseDialog from "@/components/modals/LeaseDialog.vue";
import Modal from "@/components/modals/templates/Modal.vue";
import ErrorDialog from "@/components/modals/ErrorDialog.vue";
import LeaseInfo from "@/components/LeaseInfo.vue";

import { ref, provide, onMounted, onUnmounted } from "vue";
import { useLeases } from "@/composables/useLeases";

const showLeaseModal = ref(false);
const { leases, getLeases } = useLeases(onLeaseError, showModal);
const CHECK_TIME = 15000;
let timeOut: NodeJS.Timeout;

const errorDialog = ref({
  showDialog: false,
  errorMessage: "",
  tryAgain: (): void => { },
});

onMounted(() => {
  timeOut = setInterval(() => {
    getLeases();
  }, CHECK_TIME);
});

onUnmounted(() => {
  clearInterval(timeOut);
})

function onLeaseError(e: Error | any) {
  errorDialog.value.showDialog = true;
  errorDialog.value.errorMessage = e.message;
  errorDialog.value.tryAgain = onTryAgain;
}

function showModal() {
  showLeaseModal.value = true;
}

async function onTryAgain() {
  errorDialog.value.showDialog = false;
  errorDialog.value.errorMessage = "";
  getLeases();
}

provide("getLeases", getLeases);
</script>
