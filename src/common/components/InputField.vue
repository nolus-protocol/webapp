<template>
  <fieldset>
    <div class="input-field block">
      <label
        :for="id"
        class="data-text block text-14 font-medium text-neutral-typography-200"
      >
        {{ label }}
      </label>
      <input
        :id="id"
        :class="{ error: isError }"
        :name="name"
        :type="type"
        :value="value"
        autocomplete="off"
        class="mt-[4px]"
        @input="$emit('update:value', handleInputChange($event))"
      />
      <span
        :class="{ hidden: !errorMsg.length }"
        class="msg error"
      >
        {{ errorMsg }}
      </span>
    </div>
  </fieldset>
</template>

<script lang="ts" setup>
defineProps({
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
    type: Boolean,
    default: false
  },
  errorMsg: {
    type: String,
    default: ""
  }
});

function handleInputChange(event: Event) {
  return (event.target as HTMLInputElement).value;
}
</script>
