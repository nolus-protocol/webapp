<template>
  <div class="col-span-12 mb-sm-nolus-70">
    <!-- Header -->
    <div class="flex flex-wrap mt-[25px] items-center justify-between px-4 lg:px-0">
      <div class="left w-full md:w-1/2">
        <h1 class="text-20 nls-font-700 text-primary m-0 nls-sm-title">
          {{ $t('message.leases') }}
        </h1>
      </div>
      <div class="right w-full md:w-1/2 mt-[25px] md:mt-0 inline-flex justify-start md:justify-end">
        <button class="btn btn-primary btn-large-primary w-full md:w-1/2" v-on:click="showLeaseModal = true">
          {{ $t('message.lease-new') }}
        </button>
      </div>
    </div>

    <!-- Leases -->
    <LeaseInfo
      v-bind:key="lease.leaseAddress"
      v-for="lease in leases"
      :lease-info="lease"
    />
  </div>

  <Modal v-if="showLeaseModal" @close-modal="showLeaseModal = false">
    <LeaseDialog/>
  </Modal>
</template>

<script lang="ts" setup>
import { ref, provide } from 'vue'

import LeaseDialog from '@/components/modals/LeaseDialog.vue'
import Modal from '@/components/modals/templates/Modal.vue'
import LeaseInfo from '@/components/LeaseInfo.vue'
import { useLeases } from '@/composables/useLeases'

const showLeaseModal = ref(false)

const { leases, getLeases } = useLeases()

const errorDialog = ref({
  showDialog: false,
  errorMessage: '',
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  tryAgain: (): void => {}
})

provide('getLeases', getLeases)
</script>
