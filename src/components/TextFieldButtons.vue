<template>
  <fieldset>
    <div class="block input-field">
      <label
        :for="id"
        class="block text-14 nls-font-500 mb-[5px] text-primary dark-text"
      >
      {{ label }}
      </label>
      <div class="field-container text-field-buttons">
        <textarea
          :id="id"
          :class="isError === true ? 'error' : ''"
          :disabled="true"
          :name="name"
          :value="value"
          @input="$emit('update:value', handleInputChange($event))"
        ></textarea>
        <div
          class="flex align-center justify-end p-3 bg-light-grey buttons-container"
        >
          <button
            class="btn btn-secondary btn-medium-secondary btn-icon mr-4"
            @click="onClickCopy()"
          >
            <DocumentDuplicateIcon class="icon w-4 h-4" />
            {{ $t("message.copy") }}
          </button>

          <button
            class="btn btn-secondary btn-medium-secondary btn-icon"
            @click="onClickPrint()"
          >
            <PrinterIcon class="icon w-4 h-4" />
            {{ $t("message.print") }}
          </button>
        </div>
      </div>
      <span :class="['msg error ', errorMsg.length > 0 ? '' : 'hidden']">
        {{ errorMsg }}
      </span>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { DocumentDuplicateIcon, PrinterIcon } from '@heroicons/vue/24/solid';

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
    defualt: false,
  },
  errorMsg: {
    type: String,
    default: '',
  },
  onClickCopy: {
    type: Function,
    required: true,
  },
  onClickPrint: {
    type: Function,
    required: true,
  },
});

const handleInputChange = (event: Event) =>
  (event.target as HTMLInputElement).value;
</script>
