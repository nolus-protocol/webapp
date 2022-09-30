<template>
  <router-view v-cloak/>
  <Modal v-if="this.showErrorDialog" @close-modal="this.showErrorDialog = false">
    <ErrorDialog title="Error connecting" :message="this.errorMessage" :try-button="onClickTryAgain"/>
  </Modal>
</template>

<script lang="ts">
import { useStore } from '@/store'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { ApplicationActionTypes } from '@/store/modules/application/action-types'
import { OracleActionTypes } from '@/store/modules/oracle/action-types'
import { WalletManager } from '@/wallet/WalletManager'
import ErrorDialog from '@/components/modals/ErrorDialog.vue'
import Modal from '@/components/modals/templates/Modal.vue'
import { defineComponent } from 'vue'
import { UPDATE_BALANCE_INTERVAL, UPDATE_PRICES_INTERVAL } from '@/config/env'

export default defineComponent({
  name: 'App',
  components: {
    Modal,
    ErrorDialog
  },
  data () {
    return {
      showErrorDialog: false,
      errorMessage: ''
    }
  },
  async mounted () {
    await this.loadNetwork()
  },
  methods: {
    async onClickTryAgain () {
      await this.loadNetwork()
    },
    async loadNetwork () {
      try {
        useStore().dispatch(ApplicationActionTypes.CHANGE_NETWORK)
        await useStore().dispatch(WalletActionTypes.UPDATE_BALANCES)
        setInterval(async () => {
          if (WalletManager.getWalletAddress() !== '') {
            await useStore().dispatch(WalletActionTypes.UPDATE_BALANCES)
          }
        }, UPDATE_BALANCE_INTERVAL)

        setInterval(async () => {
          await useStore().dispatch(OracleActionTypes.GET_PRICES)
        }, UPDATE_PRICES_INTERVAL)

        await useStore().dispatch(OracleActionTypes.GET_PRICES)
      } catch (e: any) {
        this.showErrorDialog = true
        this.errorMessage = e.message
      }
    }
  }
})
</script>
