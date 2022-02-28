<template>
  <router-link to="/">Home</router-link>
  <div class="ConnectLayout">
    <button v-on:click="createWallet">Create wallet</button>
    <button v-on:click="connectViaLedger">Connect via Ledger</button>
    <button v-on:click="connectToKeplr">Connect to Keplr</button>
  </div>
</template>

<script>
import store from '@/store'
import router from '@/router'

export default {
  name: 'WalletConnect',
  methods: {
    connectToKeplr: () => {
      store.commit('increment')
      console.log(store.state.counter)
      console.log('connect to keplr')
    },
    connectViaLedger: () => {
      console.log('connect via ledger')
    },
    createWallet: () => {
      router.push({
        path: '/home'
      })
      console.log('create wallet')
    }
  }
}
</script>

<style scoped lang="scss">
.ConnectLayout {
  display: inline-block;
}
</style>
