<template>
  <div class="block input-field pb-[50px] md:pb-0">
    <label
      :for="this.id"
      class="block text-14 nls-font-500 mb-[5px] text-primary relative z-[2]"
    >{{ this.label }}</label
    >
    <div class="block editable-block relative z-[2]">
      <div
        v-for="(word, index) in confirmMnemonicPhrase"
        :key="word"
        v-on:click="onWordClick(word, index, false)"
      >
        {{ word }}
      </div>
    </div>
    <div class="editable-block-options relative z-[2]">
      <button
        v-for="(word, index) in this.mnemonicPhrase"
        id="{{word}}"
        :key="word"
        class="editable-block-option"
        v-on:click="onWordClick(word, index, true)"
      >
        {{ word }}
      </button>
    </div>
    <div class="mt-6 hidden md:block">
      <button
        :disabled="confirmMnemonicPhrase.length !== 24"
        class="btn btn-primary btn-large-primary"
        v-on:click="onClickConfirm(confirmMnemonicPhrase)">
        Confirm
      </button>
    </div>

    <div class="bg-white h-[400px] absolute inset-x-0 bottom-0 z-[0] md:hidden"></div>

    <div class="md:hidden flex align-center justify-center md:pt-7 p-4 text-center mx-auto bg-white absolute inset-x-0 bottom-0 md:relative shadow-modal z-[100]">
      <button
        :disabled="confirmMnemonicPhrase.length !== 24"
        class="btn btn-primary btn-large-primary w-80"
        v-on:click="onClickConfirm(confirmMnemonicPhrase)">
        Confirm
      </button>
    </div>
  </div>
</template>

<script type="ts">

export default {
  name: 'SelectorTextField',
  components: {},
  props: {
    name: {
      type: String
    },
    id: {
      type: String
    },
    label: {
      type: String
    },
    values: {
      type: Array
    },
    onClickConfirm: {
      type: Function
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
      mnemonicPhrase: this.values,
      confirmMnemonicPhrase: []
    }
  },
  methods: {
    onWordClick (value, index, isRandomWord) {
      if (isRandomWord) {
        this.confirmMnemonicPhrase.push(value)
        this.mnemonicPhrase.splice(index, 1)
      } else {
        this.mnemonicPhrase.push(value)
        this.confirmMnemonicPhrase.splice(index, 1)
      }
    }
  }
}
</script>
