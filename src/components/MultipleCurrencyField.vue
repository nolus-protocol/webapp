<template>
  <div class="block currency-field-container">
    <label :for="this.id" class="block nls-14 nls-font-500 text-primary">{{
        this.label
      }}</label>

    <div
      :class="[
        typeof this.isError !== 'undefined' && this.isError === true
          ? 'error'
          : '',
        'currency-field py-3.5',
      ]"
    >
      <div class="flex items-center px-3.5">
        <div class="inline-block w-1/2">
          <input
            :id="this.id"
            :name="this.name"
            class="nls-font-700 nls-18 nls-font-700 text-primary"
            type="text"
            value=""
          />
          <span class="block nls-14 nls-font-400 text-light-blue">
            $1,000
          </span>
        </div>
        <div class="inline-block w-1/2">
          <Picker
            :default-option="this.assets[0]"
            :disabled="true"
            :options="this.assets"
            label="Asset"
          />
        </div>
      </div>
      <div class="separator">
        <div class="arrow-box">
          <ArrowDownIcon></ArrowDownIcon>
        </div>
      </div>
      <div class="flex items-center px-3.5">
        <div class="inline-block w-1/2">
          <input
            :id="this.idSecondary"
            :name="this.nameSecondary"
            class="nls-font-700 nls-18 nls-font-700 text-primary"
            type="text"
            value=""
          />
          <span class="block nls-14 nls-font-400 text-light-blue">
            $1,000
          </span>
        </div>
        <div class="inline-block w-1/2">
          <Picker
            :default-option="this.assets[0]"
            :disabled="true"
            :options="this.assets"
            label="Asset"
          />
        </div>
      </div>
    </div>

    <span
      :class="[
        'msg error ',
        typeof this.errorMsg !== 'undefined' && this.errorMsg !== null
          ? ''
          : 'hidden',
      ]"
    >{{
        typeof this.errorMsg !== 'undefined' && this.errorMsg !== null
          ? this.errorMsg
          : ''
      }}</span
    >
  </div>
</template>

<script lang="ts">
import { ArrowDownIcon } from '@heroicons/vue/solid'

import Picker from '@/components/Picker.vue'

export default {
  name: 'MultipleCurrencyField',
  components: {
    Picker,
    ArrowDownIcon
  },
  props: {
    name: {
      type: String
    },
    nameSecondary: {
      type: String
    },
    id: {
      type: String
    },
    idSecondary: {
      type: String
    },
    label: {
      type: String
    },
    isError: {
      type: Boolean
    },
    errorMsg: {
      type: String
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
      default: {
        value: ''
      }
    }
  }
}
</script>
