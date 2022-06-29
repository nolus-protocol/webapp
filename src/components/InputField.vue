<template>
  <fieldset>
    <div class="block input-field">
      <label
        :for="this.id"
        class="block nls-14 nls-font-400 text-primary nls-font-400"
        >{{ this.label }}</label
      >
      <input
        :type="this.type"
        :name="this.name"
        :id="this.id"
        :value="value"
        @input="$emit('update:value', $event.target.value)"
        :class="
          typeof this.isError !== 'undefined' && this.isError === true
            ? 'error'
            : ''
        "
      />
      <span
        :class="[
          'msg error ',
          typeof this.errorMsg !== 'undefined' && this.errorMsg !== null
            ? ''
            : 'hidden',
        ]"
        >{{
          typeof this.errorMsg !== "undefined" && this.errorMsg !== null
            ? this.errorMsg
            : ""
        }}</span
      >
    </div>
  </fieldset>
</template>

<script lang="ts">
export default {
  name: "InputField",
  props: {
    type: {
      type: String,
    },
    name: {
      type: String,
    },
    value: {
      type: String,
    },
    id: {
      type: String,
    },
    label: {
      type: String,
    },
    isError: {
      type: Boolean,
    },
    errorMsg: {
      type: String,
    },
  },
  data() {
    return {
      default: {
        value: "",
      },
    };
  },
};
</script>
