<template>
  <div class="block currency-field-container">
    <label
      :for="this.id"
      class="block text-normal-copy text-primary text-medium"
    >{{ this.label }}</label>

    <div
      :class="[
              typeof this.isError !== 'undefined' && this.isError === true ? 'error' : '',
              'currency-field p-3.5'
          ]"
    >
      <div class="flex items-center">
        <div class="inline-block w-1/2">
          <input
            type="text"
            :name="this.name"
            :id="this.id"
            :value="value"
            @input='$emit("update:value", $event.target.value)'
            class="text-small-heading text-bold text-primary"
          >
          <span
            class="block text-normal-copy text-light-blue"
          >
                      $1,000
                  </span>
        </div>
        <div class="inline-block w-1/2">
          <CurrencyPicker
            :options="currencyOptions"
            type="small"
            @update-currency="onUpdateCurrency"
          >
          </CurrencyPicker>
        </div>
      </div>
    </div>

    <span :class="[
          'msg error ',
          typeof this.errorMsg !== 'undefined' && this.errorMsg !== null ? '' : 'hidden'
      ]">{{ typeof this.errorMsg !== 'undefined' && this.errorMsg !== null ? this.errorMsg : '' }}</span>
  </div>
</template>

<script lang="ts">
import CurrencyPicker from '@/components/CurrencyPicker.vue'
import { defineComponent, PropType } from 'vue'
import { AssetBalance } from '@/store'

export default defineComponent({
  name: 'CurrencyField',
  components: {
    CurrencyPicker
  },
  props: {
    name: {
      type: String
    },
    value: {
      type: String
    },
    currencyOptions: {
      type: Array as PropType<AssetBalance[]>
    },
    option: {
      type: Object as PropType<AssetBalance>
    },
    id: {
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
    return {}
  },
  methods: {
    onUpdateCurrency (value: AssetBalance) {
      this.$emit('update-currency', value)
    }
  }
})
</script>
