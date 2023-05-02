<template>
  <fieldset>
    <div class="block input-field">
      <label
        :for="id"
        class="block text-14 nls-font-500 text-primary"
      >
        {{ label }}
      </label>
      <input
        autocomplete="off"
        :id="id"
        :class="{ error: isError }"
        :name="name"
        :type="type"
        :value="value"
        @input="$emit('update:value', handleInputChange($event))"
        class="mt-[4px]"
      />
      <span
        class="msg error"
        :class="{ 'hidden': !errorMsg.length }"
      >
        {{ errorMsg }}
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

function handleInputChange(event: Event) { (event.target as HTMLInputElement).value; }
</script>
