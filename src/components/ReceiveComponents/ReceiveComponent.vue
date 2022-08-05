<template>
  <div class="modal-send-receive-input-area">
    <div class="block text-left">
      <div class="block">
        <Picker
          :default-option="this.assets[0]"
          :disabled="true"
          :options="this.assets"
          :label="$t('message.asset')"
        />
      </div>

      <div class="block mt-[25px]">
        <Picker
          :default-option="this.networks[0]"
          :disabled="true"
          :options="this.networks"
          :label="$t('message.network')"
        />
      </div>

      <div class="block mt-[36px]">
        <p class="text-14 nls-font-500 text-primary m-0">{{ $t('message.wallet-address') }}</p>
        <p class="text-14 text-primary nls-font-700 m-0">
          {{ modelValue.walletAddress }}
        </p>
        <div class="flex items-center justify-start mt-2">
          <button
            class="btn btn-secondary btn-medium-secondary btn-icon mr-2"
            v-on:click="modelValue.onCopyClick"
          >
            <DuplicateIcon class="icon w-4 h-4"/>
            {{ $t('message.copy') }}
          </button>
          <button
            class="btn btn-secondary btn-medium-secondary btn-icon"
            v-on:click="modelValue.onScanClick"
          >
            <QrcodeIcon class="icon w-4 h-4"/>
            {{ $t('message.scan-code') }}
          </button>
        </div>
      </div>

      <WarningBox :isWarning="true" class="mt-[25px]">
        <template v-slot:icon>
          <img class="block mx-auto my-0 w-5 h-5" src="@/assets/icons/info.svg"/>
        </template>
        <template v-slot:content>
          Send only <span class="nls-font-700">NOLUS</span> to this deposit
          address.
        </template>
      </WarningBox>

    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { DuplicateIcon, QrcodeIcon } from '@heroicons/vue/solid'
import Picker from '@/components/Picker.vue'
import WarningBox from '@/components/modals/templates/WarningBox.vue'

export interface ReceiveComponentProps {
  walletAddress: string;
  onScanClick: () => void;
  onCopyClick: () => void;
}

export default defineComponent({
  name: 'ReceiveComponent',
  components: {
    DuplicateIcon,
    QrcodeIcon,
    Picker,
    WarningBox
  },
  props: {
    modelValue: {
      type: Object as PropType<ReceiveComponentProps>
    }
  },
  data () {
    return {
      assets: [
        {
          value: 'NLS',
          label: 'NLS',
          icon: require('@/assets/icons/coins/nls.svg')
        }
      ],
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
