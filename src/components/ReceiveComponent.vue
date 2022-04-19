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
          :options="[{value: 0, label: 'ETH'}, {value: 1, label: 'BTC'}, {value: 2, label: 'NLS'},]"
        ></PickerDefault>
      </div>

      <div class="block mt-4">
        <p class="text-normal-copy text-primary text-medium m-0">Tx Id:</p>
        <p class="text-normal-copy text-primary text-bold m-0">C1FAC987E9515B…63BE5162B4A00310244A</p>
        <div class="flex items-center justify-start mt-2">
          <button class="btn btn-secondary btn-medium-secondary btn-icon mr-2">
            <DuplicateIcon class="icon w-4 h-4"/>
            Copy
          </button>
          <button class="btn btn-secondary btn-medium-secondary btn-icon">
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
          <p class="text-left text-primary text-normal-copy">Send only <span class="text-bold">WBTC</span> to this
            deposit address.</p>
          <p class="text-left text-primary text-normal-copy">Ensure the network is <span class="text-bold">Ethereum (ERC20)</span>.
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
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ReceiveComponent',
  components: {
    PickerIcon,
    DuplicateIcon,
    QrcodeIcon,
    // CurrencyField,
    PickerDefault
    // PickerCombo,
    // InputField
  }
})
</script>

<style scoped>

</style>
