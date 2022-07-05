<template>
  <component :is="this.currentComponent.is" v-model="currentComponent.props"/>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import ReceiveComponent, { ReceiveComponentProps } from '@/components/ReceiveComponents/ReceiveComponent.vue'
import ReceiveQrCodeComponent, {
  ReceiveQrCodeComponentProps
} from '@/components/ReceiveComponents/ReceiveQrCodeComponent.vue'
import { StringUtils } from '@/utils/StringUtils'
import { WalletManager } from '@/config/wallet'

enum ScreenState {
  MAIN = 'ReceiveComponent',
  SCAN = 'ReceiveQrCodeComponent',
}

interface ReceiveMainComponentData {
  is: string;
  props: ReceiveComponentProps | ReceiveQrCodeComponentProps;
}

export interface ReceiveMainComponentProps {
  onClose: () => void;
}

export default defineComponent({
  name: 'ReceiveMainComponent',
  components: {
    ReceiveComponent,
    ReceiveQrCodeComponent
  },
  props: {
    modelValue: {
      type: Object as PropType<ReceiveMainComponentProps>
    }
  },
  mounted () {
    this.currentComponent = {
      is: ScreenState.MAIN,
      props: {
        walletAddress: WalletManager.getWalletAddress(),
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
    // '$store.state.wallet' (wallet: NolusWallet) {
    //   if (wallet) {
    //     this.currentComponent.props.walletAddress = wallet.address as string
    //   }
    // }
  },
  emits: ['defaultState'],
  methods: {
    onScanClick () {
      this.$emit('defaultState', true)
      console.log('scannnn')
      this.currentComponent = {
        is: ScreenState.SCAN,
        props: {
          walletAddress: WalletManager.getWalletAddress(),
          onBackClick: () => this.onBackClick(),
          onCopyClick: () => this.onCopyClick()
        }
      }
    },
    onCopyClick () {
      this.$emit('defaultState', false)
      StringUtils.copyToClipboard(this.currentComponent.props.walletAddress)
    },
    onBackClick () {
      this.currentComponent = {
        is: ScreenState.MAIN,
        props: {
          walletAddress: WalletManager.getWalletAddress() || '',
          onScanClick: () => this.onScanClick(),
          onCopyClick: () => this.onCopyClick()
        }
      }
    }
  }
})
</script>

<style scoped></style>
