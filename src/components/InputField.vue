<template>
  <fieldset>
    <div class="block input-field">
      <label :for="id" class="block text-14 nls-font-500 text-primary">
        {{ label }}
      </label>
      <input
        :id="id"
        :class="isError === true ? 'error' : ''"
        :name="name"
        :type="type"
        :value="value"
        @input="$emit('update:value', handleInputChange($event))"
      />
      <span :class="['msg error ', errorMsg.length > 0 ? '' : 'hidden']">
        {{ errorMsg.length > 0 ? errorMsg : "" }}
      </span>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
defineProps({
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
