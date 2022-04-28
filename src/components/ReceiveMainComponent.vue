<template>
  <component :is="this.currentComponent.is" v-model="currentComponent.props"/>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { NolusWallet } from '@/wallet/NolusWallet'
import store from '@/store'
import ReceiveComponent, { ReceiveComponentProps } from '@/components/ReceiveComponent.vue'
import ReceiveQrCodeComponent, { ReceiveQrCodeComponentProps } from '@/components/ReceiveQrCodeComponent.vue'
import { StringUtils } from '@/utils/StringUtils'

enum ScreenState {
  MAIN = 'ReceiveComponent',
  SCAN = 'ReceiveQrCodeComponent'
}

interface ReceiveMainComponentData {
  is: string,
  props: ReceiveComponentProps | ReceiveQrCodeComponentProps
}

export default defineComponent({
  name: 'ReceiveMainComponent',
  components: {
    ReceiveComponent,
    ReceiveQrCodeComponent
  },
  props: {
    modelValue: {
      type: Object
    }
  },
  mounted () {
    this.currentComponent = {
      is: ScreenState.MAIN,
      props: {
        walletAddress: store.state.wallet.address as string,
        onScanClick: () => this.onScanClick(),
        onCopyClick: () => this.onCopyClick()
      }
    }
  },
  data () {
    return {
      currentComponent: {} as ReceiveMainComponentData
    }
  },
  watch: {
    '$store.state.wallet' (wallet: NolusWallet) {
      if (wallet) {
        this.currentComponent.props.walletAddress = wallet.address as string
      }
    }
  },
  methods: {
    onScanClick () {
      this.currentComponent = {
        is: ScreenState.SCAN,
        props: {
          walletAddress: store.state.wallet.address as string,
          onBackClick: () => this.onBackClick(),
          onCopyClick: () => this.onCopyClick()
        }
      }
    },
    onCopyClick () {
      StringUtils.copyToClipboard(this.currentComponent.props.walletAddress)
    },
    onBackClick () {
      this.currentComponent = {
        is: ScreenState.MAIN,
        props: {
          walletAddress: store.state.wallet.address as string,
          onScanClick: () => this.onScanClick(),
          onCopyClick: () => this.onCopyClick()
        }
      }
    }
  }

})
</script>

<style scoped>

</style>
