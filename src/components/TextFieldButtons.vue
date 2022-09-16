<template>
  <fieldset>
    <div class="block input-field">
      <label
        :for="this.id"
        class="block text-14 nls-font-500 mb-[5px] text-primary dark-text"
      >{{ this.label }}</label
      >
      <div class="field-container text-field-buttons">
        <textarea
          :id="this.id"
          :class="
            typeof this.isError !== 'undefined' && this.isError === true
              ? 'error'
              : ''
          "
          :disabled="true"
          :name="this.name"
          :value="value"
          @input="$emit('update:value', $event.target.value)"
        ></textarea>
        <div class="flex align-center justify-end p-3 bg-light-grey buttons-container">
          <button class="btn btn-secondary btn-medium-secondary btn-icon mr-4" v-on:click="onClickCopy">
            <DuplicateIcon class="icon w-4 h-4"/>
              Copy
          </button>

          <button class="btn btn-secondary btn-medium-secondary btn-icon" v-on:click="onClickPrint">
            <PrinterIcon class="icon w-4 h-4"/>
            Print
          </button>
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
  </fieldset>
</template>

<script>
import { DuplicateIcon, PrinterIcon } from '@heroicons/vue/solid'

export default {
  name: 'TextFieldButtons',
  components: {
    DuplicateIcon,
    PrinterIcon
  },
  props: {
    name: {
      type: String
    },
    id: {
      type: String
    },
    value: {
      type: String
    },
    label: {
      type: String
    },
    buttons: {
      type: String
    },
    isError: {
      type: Boolean
    },
    errorMsg: {
      type: String
    },
    onClickCopy: {
      type: Function
    },
    onClickPrint: {
      type: Function
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
