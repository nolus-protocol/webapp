<template>
  <div class="mb-sm-nolus-70 col-span-12">
    <!-- Header -->
    <div class="mt-4 flex flex-wrap items-center justify-between px-4 lg:mt-0 lg:px-0 lg:pt-[25px]">
      <div class="left w-full md:w-1/2">
        <h1 class="nls-font-700 nls-sm-title m-0 text-20 text-primary">
          {{ $t("message.leases") }}
        </h1>
      </div>
      <div class="right inline-flex w-full justify-start md:mt-0 md:w-1/2 md:justify-end">
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
        class="background border-standart shadow-box mt-12 h-[220px] px-1 outline md:px-0 lg:rounded-xl"
      >
        <div class="nls-12 text-dark-grey flex h-full flex-col items-center justify-center">
          <img
            src="/src/assets/icons/empty_lease.svg"
            class="m-4 inline-block"
            height="32"
            width="32"
          />
          <p class="text-center">
            {{ $t("message.empty-lease") }}
          </p>
          <a
            @click="showLeaseModal = true"
            class="mt-2 cursor-pointer text-[#2868E1]"
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
import LeaseDialog from "@/common/components/modals/LeaseDialog.vue";
import Modal from "@/common/components/modals/templates/Modal.vue";
import ErrorDialog from "@/common/components/modals/ErrorDialog.vue";

import { LeaseInfo } from "./components";
import { ref, provide, onMounted, onUnmounted, watch, type Ref } from "vue";
import { useLeases } from "@/common/composables";
import { useApplicationStore } from "@/common/stores/application";
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
  tryAgain: (): void => {}
});

onMounted(() => {
  timeOut = setInterval(() => {
    getLeases();
  }, CHECK_TIME);
});

onUnmounted(() => {
  clearInterval(timeOut);
});

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
