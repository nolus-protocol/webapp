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
          :options="[{value: 0, label: 'English'},]"
        ></PickerDefault>
      </div>

      <div class="block mt-3">
        <PickerDefault
          label="Currency"
          :options="[{value: 0, label: 'USD'}, {value: 1, label: 'EUR'},]"
        ></PickerDefault>
      </div>

      <div class="block mt-3">
        <PickerDefault
          label="Network"
          :options="[{value: 0, label: 'Mainnet'},]"
        ></PickerDefault>
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
<script type="ts">
import PickerDefault from '@/components/PickerDefault.vue'

export default {
  name: 'WalletOpen',
  components: {
    PickerDefault,
  },
  props: []
}
</script>
