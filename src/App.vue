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

    const quoteMsg = {
      quote: {
        downpayment: {
          denom: 'unolus',
          amount: '100'
        }
      }
    }
    // const denoms = { supported_denom_pairs: {} }
    // NolusClient.setInstance('https://net-dev.nolus.io:26612')
    // const cosm = await NolusClient.getInstance().getCosmWasmClient()
    // const oracleContract = new Oracle()
    // console.log('price: ', await oracleContract.getPrices(['OSMO', 'NOLUS', 'ATOM']))
    // console.log(await cosm.queryContractSmart('nolus16xz4vg9xh9arxfky5zwl8g6mtk9dxkjt7h608f80dplkfzgr3mesht9ns4', getPriceMsg))
    // console.log(await cosm.queryContractSmart('nolus17u2a36dg0zv9t8zdfmxczzam0kp0r6tvlqm46amxz7qcfjm04tsqk06mrs', quoteMsg))
  },
  data () {
    return {}
  }
}
</script>
