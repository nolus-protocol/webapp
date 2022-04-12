<template>
  <router-view/>
</template>

<script lang="ts">

import { NolusClient } from '@/client/NolusClient'
import { ComponentPublicInstance } from 'vue'
import { WalletConnectMechanism, WalletManager } from '@/config/wallet'
import router from '@/router'
import store from '@/store'

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
        store.dispatch('connectToKeplr')
      }
    } else {
      router.push({ name: 'dashboard' })
    }

    setInterval(() => {
      console.log('sent!')
      store.dispatch('updateBalances', { walletAddress: store.state.wallet.address })
    }, 5000)
  },
  data () {
    return {}
  }
}
</script>

<style lang="sass">
</style>
