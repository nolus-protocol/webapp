<template>
  <fieldset>
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
                <div class="inline-block">
                    <input
                        type="text"
                        :name="this.name"
                        :id="this.id"
                        class="text-small-heading text-bold text-primary"
                        value="10,000"
                    >
                    <span
                        class="block text-normal-copy text-light-blue"
                    >
                        $1,000
                    </span>
                </div>
                <div class="inline-block">
                    <PickerIcon
                        :label="false"
                        :options="[{value: 0, label: 'Option 1', icon: require('@/assets/icons/coins/nls.svg')}, {value: 1, label: 'Option 2', icon: require('@/assets/icons/coins/nls.svg')}, {value: 2, label: 'Option 3', icon: require('@/assets/icons/coins/nls.svg')},]"
                        type="small"
                    ></PickerIcon>
                </div>
            </div>
        </div>

        <span :class="[
            'msg error ',
            typeof this.errorMsg !== 'undefined' && this.errorMsg !== null ? '' : 'hidden'
        ]">{{ typeof this.errorMsg !== 'undefined' && this.errorMsg !== null ? this.errorMsg : '' }}</span>
    </div>
  </fieldset>
</template>

<script type="ts">
import PickerIcon from '@/components/PickerIcon.vue'

export default {
  name: 'CurrencyField',
  components: {
    PickerIcon
  },
  props: ['name', 'id', 'label', 'isError', 'errorMsg'],
  data () {
    return {
      default: {
        value: ''
      }
    }
  }
}
</script>
