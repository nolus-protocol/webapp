<template>
  <fieldset>
    <div class="block input-field">
      <label
        :for="this.id"
        class="block text-14 nls-font-500 mb-[5px] text-primary"
      >{{ this.label }}</label
      >
      <textarea
        :id="this.id"
        :class="
          typeof this.isError !== 'undefined' && this.isError === true
            ? 'error'
            : ''
        "
        :name="this.name"
        :value="value"
        @input="$emit('update:value', $event.target.value)"
      ></textarea>
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
export default {
  name: 'TextField',
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
    isError: {
      type: Boolean
    },
    errorMsg: {
      type: String
    }
  }
}
</script>
