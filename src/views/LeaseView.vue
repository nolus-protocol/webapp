<template>
  <div class="col-span-12 mb-sm-nolus-70">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between md:px-4 lg:pt-[25px] lg:px-0 px-2">
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
      <div
        v-if="leaseLoaded && leases.length == 0"
        class="background mt-12 border-standart shadow-box radius-medium radius-0-sm outline h-[220px]"
      >
        <div class="flex nls-12 text-dark-grey justify-center items-center flex-col h-full">
          <img
            src="/src/assets/icons/empty_lease.svg"
            class="inline-block m-4"
            height="32"
            width="32"
          >
          <p class="text-center">
            {{ $t("message.empty-lease") }}
          </p>
          <a
            @click="showLeaseModal = true"
            class="text-[#2868E1] mt-2 cursor-pointer"
          >
            {{ $t("message.lease-now") }}
          </a>
        </div>
      </div>
    </TransitionGroup>
  </div>

  <Modal
    v-if="showLeaseModal"
    @close-modal="onCloseLease"
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

import { ref, provide, onMounted, onUnmounted, watch } from "vue";
import { useLeases } from "@/composables/useLeases";
import { useApplicationStore } from "@/stores/application";
import { storeToRefs } from "pinia";

const showLeaseModal = ref(false);
const { leases, leaseLoaded, getLeases } = useLeases(onLeaseError);
const CHECK_TIME = 15000;
const applicaton = useApplicationStore();
const applicationRef = storeToRefs(applicaton);
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

watch(
  () => applicationRef.sessionExpired.value,
  (value) => {
    if (value) {
      clearInterval(timeOut);
    }
  }
);

function onCloseLease() {
  showLeaseModal.value = false;
}

function onLeaseError(e: Error | any) {
  errorDialog.value.showDialog = true;
  errorDialog.value.errorMessage = e.message;
  errorDialog.value.tryAgain = onTryAgain;
}

async function onTryAgain() {
  errorDialog.value.showDialog = false;
  errorDialog.value.errorMessage = "";
  getLeases();
}

provide("getLeases", getLeases);
</script>
