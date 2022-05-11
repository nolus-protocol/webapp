<template>
  <div class="wallet-open open bg-white shadow-modal">

    <!-- Wallet Header -->
    <div class="wallet-open-header p-4 lg:p-6 border-b border-standart">
      <h2 class="text-large-copy text-primary text-bold m-0">Your Wallet</h2>
      <div class="flex items-center bg-light-grey radius-rounded p-3 mt-3">
        <img
          src="@/assets/icons/money-wallet.svg"
          class="inline-block mr-2"
        />
        <span class="text-normal-copy">My precious</span>
      </div>
    </div>

    <!-- Wallet Body -->
    <div class="wallet-open-body p-4 lg:p-6 border-b border-standart">

      <div class="block">
        <PickerDefault
          label="Language"
          :default-option="{label: 'English', value: 'en'}"
          :options="[{value: 'en', label: 'English'}]"
          :disabled="true"
        />
      </div>

      <div class="block mt-3">
        <PickerDefault
          label="Currency"
          :default-option="{label: 'USD', value: 'USD'}"
          :options="[{value: 'USD', label: 'USD'}, {value: 'EUR', label: 'EUR'}]"
          :disabled="true"
        />
      </div>

      <div class="block mt-3">
        <PickerDefault
          label="Network"
          :default-option="this.currentNetwork"
          :options="this.networks"
          @update-selected="onUpdateNetwork"
        />
      </div>
    </div>

    <!-- Wallet Actions -->
    <div class="wallet-open-actions p-4 lg:p-6">
      <div class="flex justify-end">
        <button class="btn btn-secondary btn-large-secondary">
          Disconnect
        </button>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import PickerDefault, { PickerDefaultOption } from '@/components/PickerDefault.vue'
import { defineComponent } from 'vue'
import { EnvNetworks } from '@/config/envNetworks'
import { StringUtils } from '@/utils/StringUtils'
import { useStore } from '@/store'
import { ApplicationActionTypes } from '@/store/modules/application/action-types'

export default defineComponent({
  name: 'WalletOpen',
  components: {
    PickerDefault
  },
  props: [],
  data () {
    return {
      networks: [] as PickerDefaultOption[],
      currentNetwork: {} as PickerDefaultOption
    }
  },
  mounted () {
    const envNetwork = new EnvNetworks()
    envNetwork.getEnvNetworks().forEach(network => {
      this.networks.push({
        label: StringUtils.capitalize(network),
        value: network
      })
    })
    console.log('curr: ', envNetwork.getStoredNetworkName())
    this.currentNetwork = {
      label: StringUtils.capitalize(envNetwork.getStoredNetworkName() || ''),
      value: envNetwork.getStoredNetworkName() || ''
    }
    console.log(this.currentNetwork)
  },
  methods: {
    onUpdateNetwork (value: PickerDefaultOption) {
      EnvNetworks.saveCurrentNetwork(value.value)
      useStore().dispatch(ApplicationActionTypes.CHANGE_NETWORK)
    }
  }
})
</script>
