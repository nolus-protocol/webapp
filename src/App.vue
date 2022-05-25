<template>
  <router-view/>
</template>

<script lang="ts">

import { ComponentPublicInstance } from 'vue'
import { WalletManager } from '@/config/wallet'
import { useStore } from '@/store'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { ApplicationActionTypes } from '@/store/modules/application/action-types'
import { OracleActionTypes } from '@/store/modules/oracle/action-types'

export default {
  name: 'App',
  components: {},
  errorCaptured (
    err: unknown,
    instance: ComponentPublicInstance | null,
    info: string
  ) {
    console.log('errorCaptured: ', err)
  },
  async mounted () {
    useStore().dispatch(ApplicationActionTypes.CHANGE_NETWORK)
    useStore().dispatch(WalletActionTypes.UPDATE_BALANCES)
    setInterval(() => {
      if (WalletManager.getWalletAddress() !== '') {
        useStore().dispatch(WalletActionTypes.UPDATE_BALANCES)
      }
    }, 5000)

    useStore().dispatch(OracleActionTypes.GET_PRICES)
  },
  data () {
    return {}
  }
}
</script>
