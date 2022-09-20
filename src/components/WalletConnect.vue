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
    <button class="btn btn-primary btn-large-primary mr-4" v-on:click="generateMnemonic">Generate mnemonic</button>
  </div>
</template>

<script lang="ts">
import router from '@/router'
import '../index.css'
import { useStore } from '@/store'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'

export default {
  name: 'WalletConnect',
  methods: {
    connectToKeplr: () => {
      useStore().dispatch(WalletActionTypes.CONNECT_KEPLR)
    },
    connectViaLedger: async () => {
      useStore().dispatch(WalletActionTypes.CONNECT_LEDGER)
    },
    generateWallet: () => {
      // useStore().dispatch(Ac)
    },
    connectViaMnemonic: () => {
      useStore().dispatch(WalletActionTypes.CONNECT_VIA_MNEMONIC, { mnemonic: '' })
    },
    createWallet: () => {
      router.push({
        path: '/home'
      })
    },
    torusLogin: () => {
      useStore().dispatch(WalletActionTypes.LOGIN_VIA_TORUS)
    },
    torusLogout: () => {
      useStore().dispatch(WalletActionTypes.TORUS_LOGOUT)
    },
    updateBalances: () => {
      useStore().dispatch(WalletActionTypes.UPDATE_BALANCES)
    },

    // const entropy = crypto_1.Random.getBytes(words === 12 ? 16 : 32);
    // const mnemonic = crypto_1.Bip39.encode(entropy);
    // // TODO: add support for more languages
    // return mnemonic.toString();
    generateMnemonic () {
      // const entropy = Random.getBytes(32)
      // const mnemonic = Bip39.encode(entropy)
      //
      //
      // const words = mnemonic.toString().split(' ')
      // for (let i = 0; i < words.length; i++) {
      //   words[i] = words[i].trim()
      // }
      // words.sort((word1, word2) => {
      //   // Sort alpahbetically.
      //   return word1 > word2 ? 1 : -1
      // })

      // WalletManager.storeEncryptedPubKey('')
    },
    sendTokens: async () => {
      const wallet = useStore().getters.getNolusWallet
      const DEFAULT_FEE = {
        // TODO 0.0025unolus
        amount: [{
          denom: 'unolus',
          amount: '20'
        }],
        gas: '100000'
      }

      const txResponse = await wallet?.sendTokens(wallet.address as string, 'nolus15dqqhetmfc4a9akf358zj8hz36e59zx686wg76', [{
        denom: 'unolus',
        amount: '20000000'
      }], DEFAULT_FEE)
    }
  }
}
</script>

<style lang="scss" scoped>
.ConnectLayout {
  display: inline-block;
}
</style>
