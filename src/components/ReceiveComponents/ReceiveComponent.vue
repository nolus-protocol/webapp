<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div class="block text-left">
      <div class="block">
        <PickerIcon
          :default-option="{
            value: 'NLS',
            label: 'Nolus',
            icon: require('@/assets/icons/coins/nls.svg'),
          }"
          :disabled="true"
          :options="[
            {
              value: 'NLS',
              label: 'Nolus',
              icon: require('@/assets/icons/coins/nls.svg'),
            },
          ]"
          label="Asset"
        ></PickerIcon>
      </div>

      <div class="block mt-nolus-255">
        <PickerDefault
          :default-option="{ value: 'NLS', label: 'NLS' }"
          :disabled="true"
          :options="this.networks"
          label="Network"
        ></PickerDefault>
      </div>

      <div class="block mt-nolus-36">
        <p class="nls-14 nls-font-500 text-primary m-0">Wallet address:</p>
        <p class="nls-14 text-primary nls-font-700 m-0">
          {{ modelValue.walletAddress }}
        </p>
        <div class="flex items-center justify-start mt-2">
          <button
            class="btn btn-secondary btn-medium-secondary btn-icon mr-2"
            v-on:click="modelValue.onCopyClick"
          >
            <DuplicateIcon class="icon w-4 h-4"/>
            Copy
          </button>
          <button
            class="btn btn-secondary btn-medium-secondary btn-icon"
            v-on:click="modelValue.onScanClick"
          >
            <QrcodeIcon class="icon w-4 h-4"/>
            Scan code
          </button>
        </div>
      </div>

      <div
        class="flex items-center box box-warning radius-rounded p-4 mt-nolus-255 text-left break-words"
      >
        <div class="inline-block mr-2">
          <img
            class="block mx-auto my-0 w-5 h-5"
            src="@/assets/icons/info.svg"
          />
        </div>
        <div class="block grow-1">
          <p class="text-left text-primary nls-14 nls-font-400">
            Send only <span class="nls-font-700">NOLUS</span> to this deposit
            address.
          </p>
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
  walletAddress: string;
  onScanClick: () => void;
  onCopyClick: () => void;
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
      networks: [
        {
          value: 'NLS',
          label: 'NLS'
        },
        {
          value: 'ETH',
          label: 'ETH'
        },
        {
          value: 'BTC',
          label: 'BTC'
        }
      ]
    }
  }
})
</script>

<style scoped></style>
