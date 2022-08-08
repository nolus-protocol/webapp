<template>
  <fieldset>
    <div class="block input-field">
      <label :for="this.id" class="block text-14 nls-font-500 text-primary">{{
          this.label
        }}</label>
      <input
        :id="this.id"
        :class="
          typeof this.isError !== 'undefined' && this.isError === true
            ? 'error'
            : ''
        "
        :name="this.name"
        :type="this.type"
        :value="value"
        @input="$emit('update:value', $event.target.value)"
      />
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

<script lang="ts">
export default {
  name: 'InputField',
  props: {
    type: {
      type: String
    },
    name: {
      type: String
    },
    value: {
      type: String
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
    return {
      default: {
        value: ''
      }
    }
  }
}
</script>
