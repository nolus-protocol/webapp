<template>
  <div class="block input-field pb-[50px] mobile-box">
    <label
      :for="id"
      class="block text-14 nls-font-500 mb-[5px] text-primary relative z-[2]"
    >
      {{ label }}
    </label>
    <div class=" editable-block relative z-[2]">
      <div
        v-for="(word, index) in confirmMnemonicPhrase"
        :key="word"
        @click="onWordClick(word, index, false)"
      >
        {{ word }}
      </div>
    </div>
    <div class="editable-block-options relative z-[2]">
      <button
        v-for="(word, index) in mnemonicPhrase"
        id="{{word}}"
        :key="word"
        class="editable-block-option"
        @click="onWordClick(word, index, true)"
      >
        {{ word }}
      </button>
    </div>

    <div class="mt-6 md:block hidden">
      <button
        class="btn btn-primary btn-large-primary"
        :disabled="confirmMnemonicPhrase.length !== 24"
        @click="onClickConfirm(confirmMnemonicPhrase)"
      >
        {{ $t("message.confirm") }}
      </button>
    </div>

    <div class="background h-[400px] absolute inset-x-0 bottom-0 z-[0] md:hidden"></div>

    <div class="md:hidden flex align-center justify-center md:pt-7 p-4 text-center mx-auto background absolute inset-x-0 bottom-0 md:relative shadow-modal z-[100]">
      <button
        class="btn btn-primary btn-large-primary w-80"
        :disabled="confirmMnemonicPhrase.length !== 24"
        @click="onClickConfirm(confirmMnemonicPhrase)"
      >
        {{ $t("message.confirm") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props = defineProps({
  name: {
    type: String,
  },
  id: {
    type: String,
  },
  label: {
    type: String,
  },
  values: {
    type: Array<string>,
  },
  onClickConfirm: {
    type: Function,
    required: true,
  },
});

const confirmMnemonicPhrase = ref([] as string[]);
const mnemonicPhrase = ref([...props.values!]);

const onWordClick = (value: string, index: number, isRandomWord: boolean) => {
  if (isRandomWord) {
    confirmMnemonicPhrase.value.push(value);
    mnemonicPhrase.value.splice(index, 1);
  } else {
    mnemonicPhrase.value.push(value);
    confirmMnemonicPhrase.value.splice(index, 1);
  }
};

const onRefresh = () => {
  confirmMnemonicPhrase.value = [];
  mnemonicPhrase.value = [...props.values!];
};

defineExpose({
  onRefresh,
});
</script>
<style scoped lang="scss">
.mobile-box{
  @media (max-height: 700px) {
    position: relative;
    padding-bottom: 100px;
  }
}
</style>
