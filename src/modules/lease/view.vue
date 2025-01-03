<template>
  <div class="col-span-12">
    <div class="mt-0 flex flex-col-reverse flex-wrap justify-between md:flex-row md:items-center lg:mt-10">
      <LeaseFilter
        :leases-data="leasesData"
        :set-sort="setSort"
        :sort-failure="SORT_FEATURE_ENABLE"
        :sort-type="SORT_TYPE"
      />
      <div class="right inline-flex w-full justify-start px-4 md:mt-0 md:w-1/2 md:justify-end lg:px-0">
        <Button
          :label="$t('message.lease-new')"
          class="w-full md:w-auto"
          severity="primary"
          size="large"
          @click="showLeaseModal = true"
        />
      </div>
    </div>
    <TransitionGroup
      appear
      name="fade-long"
      tag="div"
    >
      <div
        v-for="lease in leasesData"
        :key="lease.leaseAddress"
      >
        <LeaseInfo :lease-info="lease" />
      </div>
      <div
        v-if="leaseLoaded && leases.length == 0"
        class="mt-5 h-[176px] border-[1px] border-border-color bg-neutral-bg-50 px-1 shadow-lease md:px-0 lg:rounded-xl"
      >
        <div class="flex h-full flex-col items-center justify-center text-neutral-typography-50">
          <img
            class="mb-4 inline-block"
            z
            height="34"
            src="/src/assets/icons/union.svg"
            width="36"
          />
          <p class="text-center">
            {{ $t("message.empty-lease") }}
          </p>
          <a
            class="mt-2 cursor-pointer text-[#2868E1]"
            @click="showLeaseModal = true"
          >
            {{ $t("message.lease-now") }}
          </a>
        </div>
      </div>
    </TransitionGroup>
  </div>

  <Modal
    v-if="showLeaseModal"
    route="long"
    @close-modal="onCloseLease"
  >
    <LongShortDialog />
  </Modal>
  <Modal
    v-if="errorDialog.showDialog"
    @close-modal="errorDialog.showDialog = false"
  >
    <ErrorDialog
      :message="errorDialog.errorMessage"
      :title="$t('message.error-connecting')"
      :try-button="onTryAgain"
    />
  </Modal>
</template>

<script lang="ts" setup>
import LongShortDialog from "@/common/components/modals/LongShortDialog.vue";
import Modal from "@/common/components/modals/templates/Modal.vue";
import ErrorDialog from "@/common/components/modals/ErrorDialog.vue";
import { Button } from "web-components";

import { LeaseFilter, LeaseInfo } from "./components";
import { computed, onMounted, onUnmounted, provide, ref, watch } from "vue";
import { useLeases } from "@/common/composables";
import { useApplicationStore } from "@/common/stores/application";
import { storeToRefs } from "pinia";
import { Sort, SortType } from "./types";
import { Dec } from "@keplr-wallet/unit";

const showLeaseModal = ref(false);
const { leases, leaseLoaded, getLeases } = useLeases(onLeaseError);
const CHECK_TIME = 8000;
const applicaton = useApplicationStore();
const applicationRef = storeToRefs(applicaton);
let timeOut: NodeJS.Timeout;

const SORT_TYPE = ref({
  sort: Sort.date,
  type: SortType.desc
});
const SORT_FEATURE_ENABLE = 3;

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

const leasesData = computed(() => {
  const ls = leases.value;

  switch (SORT_TYPE.value.sort) {
    case Sort.date: {
      if (SORT_TYPE.value.type == SortType.desc) {
        return ls.sort((a, b) => (b.leaseData?.timestamp?.getTime() ?? 0) - (a.leaseData?.timestamp?.getTime() ?? 0));
      } else if (SORT_TYPE.value.type == SortType.asc) {
        return ls.sort((a, b) => (a.leaseData?.timestamp?.getTime() ?? 0) - (b.leaseData?.timestamp?.getTime() ?? 0));
      }
    }
    case Sort.size: {
      if (SORT_TYPE.value.type == SortType.desc) {
        return ls.sort((a, b) =>
          Number(
            ((b.leaseData?.leasePositionStable as Dec) ?? new Dec(0))
              .sub((a.leaseData?.leasePositionStable as Dec) ?? new Dec(0))
              .toString()
          )
        );
      } else if (SORT_TYPE.value.type == SortType.asc) {
        return ls.sort((a, b) =>
          Number(
            ((a.leaseData?.leasePositionStable as Dec) ?? new Dec(0))
              .sub((b.leaseData?.leasePositionStable as Dec) ?? new Dec(0))
              .toString()
          )
        );
      }
    }
    case Sort.pnl: {
      if (SORT_TYPE.value.type == SortType.desc) {
        return ls.sort((a, b) =>
          Number(((b.pnlAmount as Dec) ?? new Dec(0)).sub((a.pnlAmount as Dec) ?? new Dec(0)).toString())
        );
      } else if (SORT_TYPE.value.type == SortType.asc) {
        return ls.sort((a, b) =>
          Number(((a.pnlAmount as Dec) ?? new Dec(0)).sub((b.pnlAmount as Dec) ?? new Dec(0)).toString())
        );
      }
    }
    default:
      return ls;
  }
});

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
