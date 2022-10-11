<template>
  <div>
    <h1 class="text-to-big-number text-primary text-center relative">
      <button
        class="inline-block align-baseline absolute left-0 top-2/4 -mt-3"
        type="button"
      >
        <ArrowLeftIcon aria-hidden="true" class="h-6 w-6" />
      </button>
      <span class="inline-block align-baseline"> Confirm mnemonic </span>
    </h1>

    <div
      class="block first-letter:rounded-2xl bg-white mt-8 p-10 border border-standart shadow-box"
    >
      <SelectorTextField
        id="confirm-mnemonic"
        label="Confirm mnemonic seed"
        :onClickConfirm="onClick"
      ></SelectorTextField>
    </div>
  </div>
</template>

<script setup lang="ts">
import SelectorTextField from '@/components/SelectorTextField.vue';
import { ArrowLeftIcon } from '@heroicons/vue/24/solid';
const onClick = () => {};
</script>
