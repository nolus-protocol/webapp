<template>
  <div class="mb-sm-nolus-70 col-span-12">
    <!-- Header -->
    <div class="mt-4 flex flex-wrap items-center justify-between px-4 lg:mt-0 lg:px-0 lg:pt-[25px]">
      <div class="left w-full md:w-1/2">
        <h1 class="nls-font-700 nls-sm-title m-0 text-20 text-primary">
          {{ $t("message.leases") }}
        </h1>
        <!-- <div
          class="background border-standart shadow-box inline-flex h-full max-h-[44px] items-center px-[14px] py-[12px] lg:rounded-md"
        >
          <span class="icon icon-sort"> </span>

          <button
            class="flex"
            @click="setSort(Sort.date)"
          >
            <span class="nls-font-400 ml-[21px] uppercase text-primary">{{ $t("message.date") }}</span>
            <div class="ml-[2px] flex flex-col">
              <span
                class="icon icon-arrow-up-sort !text-[7px] text-[#8396B1]"
                :class="{ '!text-[#2868E1]': SORT_TYPE.sort == Sort.date && SORT_TYPE.type == SortType.asc }"
              >
              </span>
              <span
                class="icon icon-arrow-down-sort !text-[7px] text-[#8396B1]"
                :class="{ '!text-[#2868E1]': SORT_TYPE.sort == Sort.date && SORT_TYPE.type == SortType.desc }"
              >
              </span>
            </div>
          </button>

          <button
            class="flex"
            @click="setSort(Sort.size)"
          >
            <span class="nls-font-400 ml-[21px] uppercase text-primary">{{ $t("message.size") }}</span>
            <div class="ml-[2px] flex flex-col">
              <span
                class="icon icon-arrow-up-sort !text-[7px] text-[#8396B1]"
                :class="{ '!text-[#2868E1]': SORT_TYPE.sort == Sort.size && SORT_TYPE.type == SortType.asc }"
              >
              </span>
              <span
                class="icon icon-arrow-down-sort !text-[7px] text-[#8396B1]"
                :class="{ '!text-[#2868E1]': SORT_TYPE.sort == Sort.size && SORT_TYPE.type == SortType.desc }"
              >
              </span>
            </div>
          </button>

          <button
            class="flex"
            @click="setSort(Sort.pnl)"
          >
            <span class="nls-font-400 ml-[21px] uppercase text-primary">{{ $t("message.pnl") }}</span>
            <div class="ml-[2px] flex flex-col">
              <span
                class="icon icon-arrow-up-sort !text-[7px] text-[#8396B1]"
                :class="{ '!text-[#2868E1]': SORT_TYPE.sort == Sort.pnl && SORT_TYPE.type == SortType.asc }"
              >
              </span>
              <span
                class="icon icon-arrow-down-sort !text-[7px] text-[#8396B1]"
                :class="{ '!text-[#2868E1]': SORT_TYPE.sort == Sort.pnl && SORT_TYPE.type == SortType.desc }"
              >
              </span>
            </div>
          </button>
        </div> -->
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
import { ref, provide, onMounted, onUnmounted, watch } from "vue";
import { useLeases } from "@/common/composables";
import { useApplicationStore } from "@/common/stores/application";
import { storeToRefs } from "pinia";
import { Sort, SortType } from "./types";

const showLeaseModal = ref(false);
const { leases, leaseLoaded, getLeases } = useLeases(onLeaseError);
const CHECK_TIME = 15000;
const applicaton = useApplicationStore();
const applicationRef = storeToRefs(applicaton);
let timeOut: NodeJS.Timeout;
const SORT_TYPE = ref({
  sort: Sort.date,
  type: SortType.desc
});

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

function setSort(sort: Sort) {
  if (SORT_TYPE.value.sort == sort) {
    switch (SORT_TYPE.value.type) {
      case SortType.desc: {
        SORT_TYPE.value.type = SortType.asc;
        break;
      }
      case SortType.asc: {
        SORT_TYPE.value.type = SortType.desc;
        break;
      }
    }
  } else {
    SORT_TYPE.value.sort = sort;
    SORT_TYPE.value.type = SortType.desc;
  }
}

provide("getLeases", getLeases);
</script>
