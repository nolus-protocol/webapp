<template>
  <router-link to="/">Home</router-link>
  <div class="ConnectLayout">
    <button class="btn btn-primary btn-large-primary mr-4" v-on:click="createWallet">Create wallet</button>
    <button class="btn btn-primary btn-large-primary mr-4" v-on:click="connectViaLedger">Connect via Ledger</button>
    <button class="btn btn-primary btn-large-primary mr-4" v-on:click="connectToKeplr">Connect to Keplr</button>
    <button class="btn btn-primary btn-large-primary mr-4" v-on:click="connectViaMnemonic">Connect via Mnemonic</button>
    <button class="btn btn-primary btn-large-primary mr-4" v-on:click="generateWallet">Generate Wallet</button>
    <button class="btn btn-primary btn-large-primary mr-4" v-on:click="torusLogin">Login with Torus</button>
    <button class="btn btn-primary btn-large-primary mr-4" v-on:click="torusLogout">Logout from Torus</button>
    <button class="btn btn-primary btn-large-primary mr-4" v-on:click="sendTokens">Send tokens</button>
    <button class="btn btn-primary btn-large-primary mr-4" v-on:click="updateBalances">Update balances</button>
    <button class="bg-light-electric p-8 m-1 rounded-md border-2 border-b-dark">test</button>
  </div>
</template>

<script lang="ts">
import router from '@/router'
import store from '@/store'
import '../index.css'

export default {
  name: 'WalletConnect',
  methods: {
    connectToKeplr: () => {
      store.dispatch('connectToKeplr')
    },
    connectViaLedger: async () => {
      store.dispatch('connectToLedger')
    },
    generateWallet: () => {
      store.dispatch('generateWallet')
    },
    connectViaMnemonic: () => {
      store.dispatch('connectViaMnemonic')
    },
    createWallet: () => {
      router.push({
        path: '/home'
      })
      console.log('create wallet')
    },
    torusLogin: () => {
      store.dispatch('loginViaTorus')
    },
    torusLogout: () => {
      store.dispatch('torusLogout')
    },
    updateBalances: () => {
      store.dispatch('updateBalances', { walletAddress: store.state.wallet.address })
    },
    sendTokens: async () => {
      const wallet = store.state.wallet
      const DEFAULT_FEE = {
        // TODO 0.0025unolus
        amount: [{
          denom: 'unolus',
          amount: '20'
        }],
        gas: '100000'
      }
      console.log(wallet)
      const txResponse = await wallet.sendTokens(wallet.address, 'nolus15dqqhetmfc4a9akf358zj8hz36e59zx686wg76', [{
        denom: 'unolus',
        amount: '20000000'
      }], DEFAULT_FEE)
      console.log(txResponse)
    }
  }
}
</script>

<style scoped lang="scss">
.ConnectLayout {
  display: inline-block;
}
</style>
