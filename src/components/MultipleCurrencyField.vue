<template>
  <div class="block currency-field-container">
    <label
      :for="this.id"
      class="block nls-14 nls-font-400 text-primary nls-font-400"
    >{{ this.label }}</label
    >

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
            type="text"
            :name="this.name"
            :id="this.id"
            class="nls-font-700 nls-18 nls-font-700 text-primary"
            value=""
          />
          <span class="block nls-14 nls-font-400 text-light-blue">
            $1,000
          </span>
        </div>
        <div class="inline-block w-1/2">
          <PickerIcon
            label="Asset"
            :default-option="{
              value: 'NLS',
              label: 'NLS',
              icon: require('@/assets/icons/coins/nls.svg'),
            }"
            :options="[
              {
                value: 'NLS',
                label: 'NLS',
                icon: require('@/assets/icons/coins/nls.svg'),
              },
            ]"
            :disabled="true"
          ></PickerIcon>
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
            type="text"
            :name="this.nameSecondary"
            :id="this.idSecondary"
            class="nls-font-700 nls-18 nls-font-700 text-primary"
            value=""
          />
          <span class="block nls-14 nls-font-400 text-light-blue">
            $1,000
          </span>
        </div>
        <div class="inline-block w-1/2">
          <PickerIcon
            label="Asset"
            :default-option="{
              value: 'NLS',
              label: 'NLS',
              icon: require('@/assets/icons/coins/nls.svg'),
            }"
            :options="[
              {
                value: 'NLS',
                label: 'NLS',
                icon: require('@/assets/icons/coins/nls.svg'),
              },
            ]"
            :disabled="true"
          ></PickerIcon>
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
import PickerIcon from '@/components/PickerIcon.vue'
import { ArrowDownIcon } from '@heroicons/vue/solid'

export default {
  name: 'MultipleCurrencyField',
  components: {
    PickerIcon,
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
      default: {
        value: ''
      }
    }
  }
}
</script>
