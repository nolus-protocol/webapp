<template>
  <router-view/>
</template>

<script lang="ts">

import { NolusClient } from '@/client/NolusClient'
import { ComponentPublicInstance } from 'vue'
import { WalletConnectMechanism, WalletManager } from '@/config/wallet'
import { useStore } from '@/store'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'

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
  mounted () {
    const walletConnectMechanism = WalletManager.getWalletConnectMechanism()
    NolusClient.setInstance('https://net-dev.nolus.io:26612')
    if (walletConnectMechanism) {
      if (walletConnectMechanism === WalletConnectMechanism.EXTENSION) {
        console.log('extension')
        useStore().dispatch(WalletActionTypes.CONNECT_KEPLR)
      }
    } else {
      // router.push({ name: 'dashboard' })
    }

    setInterval(() => {
      console.log('sent!')
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
