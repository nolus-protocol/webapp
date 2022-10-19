<template>
  <fieldset>
    <div class="block input-field">
      <label
        :for="id"
        class="block text-14 nls-font-500 mb-[5px] dark-text"
      >
      {{ label }}
      </label>
      <textarea
        :id="id"
        :class="isError === true ? 'error' : ''"
        :name="name"
        :value="value"
        @input="$emit('update:value', handleInputChange($event))"
      >
      </textarea>
      <span :class="['msg error ', errorMsg.length > 0 ? '' : 'hidden']">
        {{ errorMsg.length > 0 ? errorMsg : "" }}
      </span>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
defineProps({
  name: {
    type: String,
  },
  id: {
    type: String,
  },
  value: {
    type: String,
  },
  label: {
    type: String,
  },
  isError: {
    type: Boolean,
    default: false,
  },
  errorMsg: {
    type: String,
    default: "",
  },
});

const handleInputChange = (event: Event) =>
  (event.target as HTMLInputElement).value;
</script>
