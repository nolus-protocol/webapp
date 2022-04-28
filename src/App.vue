<template>
  <router-view/>
</template>

<script lang="ts">

import { ComponentPublicInstance } from 'vue'
import { WalletConnectMechanism, WalletManager } from '@/config/wallet'
import { useStore } from '@/store'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { ApplicationActionTypes } from '@/store/modules/application/action-types'

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
    const walletConnectMechanism = WalletManager.getWalletConnectMechanism()
    useStore().dispatch(ApplicationActionTypes.CHANGE_NETWORK)
    // NolusClient.setInstance('https://net-dev.nolus.io:26612')
    if (walletConnectMechanism) {
      if (walletConnectMechanism === WalletConnectMechanism.EXTENSION) {
        useStore().dispatch(WalletActionTypes.CONNECT_KEPLR)
      }
    } else {
      // router.push({ name: 'dashboard' })
    }

    setInterval(() => {
      useStore().dispatch(WalletActionTypes.UPDATE_BALANCES, { walletAddress: useStore().getters.getNolusWallet?.address || '' })
    }, 5000)
  },
  data () {
    return {}
  }
}
</script>

<style lang="sass">
</style>
