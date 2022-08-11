<template>
  <component :is="currentComponent.is" v-model="currentComponent.props"/>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import ReceiveComponent, { ReceiveComponentProps } from '@/components/ReceiveComponents/ReceiveComponent.vue'
import ReceiveQrCodeComponent, {
  ReceiveQrCodeComponentProps
} from '@/components/ReceiveComponents/ReceiveQrCodeComponent.vue'
import { StringUtils } from '@/utils/StringUtils'
import { WalletManager } from '@/wallet/WalletManager'

enum ScreenState {
  MAIN = 'ReceiveComponent',
  SCAN = 'ReceiveQrCodeComponent',
}

interface ReceiveMainComponentData {
  is: string;
  props: ReceiveComponentProps | ReceiveQrCodeComponentProps;
}

export default defineComponent({
  name: 'ReceiveMainComponent',
  components: {
    ReceiveComponent,
    ReceiveQrCodeComponent
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
  inject: {
    setShowDialogHeader: {
      default: () => () => {}
    }
  },
  data () {
    return {
      currentComponent: {} as ReceiveMainComponentData,
      hideDialogHeader: () => this.setShowDialogHeader(false),
      showDialogHeader: () => this.setShowDialogHeader(true)
    }
  },
  methods: {
    onScanClick () {
      this.hideDialogHeader()
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
      StringUtils.copyToClipboard(this.currentComponent.props.walletAddress)
    },
    onBackClick () {
      this.showDialogHeader()
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
