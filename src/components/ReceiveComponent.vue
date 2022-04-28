<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">

    <div class="block text-left">
      <div class="block">
        <PickerIcon
          label="Asset"
          :options="[{value: 0, label: 'Option 1', icon: require('@/assets/icons/coins/nls.svg')}, {value: 1, label: 'Option 2', icon: require('@/assets/icons/coins/nls.svg')}, {value: 2, label: 'Option 3', icon: require('@/assets/icons/coins/nls.svg')},]"
        ></PickerIcon>
      </div>

      <div class="block mt-4">
        <PickerDefault
          label="Network"
          :options="this.networks"
          :disabled="true"
        ></PickerDefault>
      </div>

      <div class="block mt-4">
        <p class="text-normal-copy text-primary text-medium m-0">Wallet address:</p>
        <p class="text-normal-copy text-primary text-bold m-0">{{ modelValue.walletAddress }}</p>
        <div class="flex items-center justify-start mt-2">
          <button class="btn btn-secondary btn-medium-secondary btn-icon mr-2" v-on:click="modelValue.onCopyClick">
            <DuplicateIcon class="icon w-4 h-4"/>
            Copy
          </button>
          <button class="btn btn-secondary btn-medium-secondary btn-icon" v-on:click="modelValue.onScanClick">
            <QrcodeIcon class="icon w-4 h-4"/>
            Scan code
          </button>
        </div>
      </div>

      <div class="flex items-center box box-warning radius-rounded p-4 mt-4 text-left break-words">
        <div class="inline-block mr-2">
          <img
            src="@/assets/icons/info.svg"
            class="block mx-auto my-0 w-5 h-5"
          />
        </div>
        <div class="block grow-1">
          <p class="text-left text-primary text-normal-copy">Send only <span class="text-bold">NOLUS</span> to this
            deposit address.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import PickerIcon from '@/components/PickerIcon.vue'
import { DuplicateIcon, QrcodeIcon } from '@heroicons/vue/solid'
import PickerDefault from '@/components/PickerDefault.vue'
import { defineComponent, PropType } from 'vue'

export interface ReceiveComponentProps {
  walletAddress: string,
  onScanClick: () => void,
  onCopyClick: () => void
}

export default defineComponent({
  name: 'ReceiveComponent',
  components: {
    PickerIcon,
    DuplicateIcon,
    QrcodeIcon,
    PickerDefault
  },
  props: {
    modelValue: {
      type: Object as PropType<ReceiveComponentProps>
    }
  },
  data () {
    return {
      networks: [{
        value: 'NLS',
        label: 'NLS'
      }, {
        value: 'ETH',
        label: 'ETH'
      }, {
        value: 'BTC',
        label: 'BTC'
      }]
    }
  }

})
</script>

<style scoped>

</style>
