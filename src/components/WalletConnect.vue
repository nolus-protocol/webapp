<template>
  <router-link to="/">Home</router-link>
  <div class="ConnectLayout">
    <button v-on:click="createWallet">Create wallet</button>
    <button v-on:click="connectViaLedger">Connect via Ledger</button>
    <button v-on:click="connectToKeplr">Connect to Keplr</button>
    <button v-on:click="connectViaMnemonic">Connect via Mnemonic</button>
    <button v-on:click="generateWallet">Generate Wallet</button>
    <button v-on:click="torusLogin">Login with Torus</button>
    <button v-on:click="torusLogout">Logout from Torus</button>
    <button v-on:click="sendTokens">Send tokens</button>
  </div>
</template>

<script>
import store from '@/store'
import router from '@/router'
import { NolusWallet } from '@/wallet/NolusWallet'

export default {
  name: 'WalletConnect',
  methods: {
    connectToKeplr: () => {
      store.dispatch('connectToKeplr')
      // store.commit('increment')
      // console.log(store.state.counter)
      console.log('connect to keplr')
    },
    connectViaLedger: () => {
      store.dispatch('connectToLedger')
      // // const client = await getClient()
      // // https:// net-dev.nolus.io:26612
      // // https://rpc-osmosis.blockapsis.com
      // // NolusClient.setInstance('https://rpc-osmosis.blockapsis.com')
      // NolusClient.setInstance('https://net-dev.nolus.io:26612')
      // const clientBalance = await NolusClient.getInstance()
      //   .getBalance('nolus15dqqhetmfc4a9akf358zj8hz36e59zx686wg76',
      //     'ibc/0EF15DF2F02480ADE0BB6E85D9EBB5DAEA2836D3860E9F97F9AADE4F57A31AA0')
      //
      // // const clientBalance = await client.getBalance('osmo1edl7rs3mmp37ncldyyahkk9xzu8c0an7ka2pfc', 'ibc/0954E1C28EB7AF5B72D24F3BC2B47BBB2FDF91BDDFD57B74B99E133AED40972A')
      //
      // console.log('uscrt: ', makeIBCMinimalDenom('channel-88', 'uscrt'))
      // console.log('uluna: ', makeIBCMinimalDenom('channel-72', 'uluna'))
      // console.log('ulum: ', makeIBCMinimalDenom('channel-115', 'ulum'))
      // console.log(clientBalance)
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
    sendTokens: async () => {
      const wallet = store.state.wallet

      const DEFAULT_FEE = {
        // TODO 0.0025unolus
        amount: [{ denom: 'unolus', amount: '20' }],
        gas: '100000'
      }
      // const txResponse = await state.wallet.currentWallet?.sendTokens(
      //   state.wallet.currentWallet?.address as string,
      //   payload.receiverAddress,
      //   [{ denom: 'unolus', amount: payload.amount }],
      //   DEFAULT_FEE
      // )

      console.log(wallet)
      const txResponse = await wallet.sendTokens(wallet.address, 'nolus1j78dy05hhgnccegduee0dkwyst2j0vvcmefn4d', [{ denom: 'unolus', amount: '20000000' }], DEFAULT_FEE)
      console.log(txResponse)
      // console.log(wallet.sendTokens(store.state.wallet.address))
      // store.dispatch('connectToKeplr')
      // store.commit('increment')
      // console.log(store.state.counter)
      // console.log('connect to keplr')
    }
  }
}
</script>

<style scoped lang="scss">
.ConnectLayout {
  display: inline-block;
}
</style>
