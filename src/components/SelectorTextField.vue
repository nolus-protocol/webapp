<template>
  <div class="block input-field">
    <label
      :for="this.id"
      class="block nls-14 nls-font-500 mb-nolus-5 text-primary"
      >{{ this.label }}</label
    >
    <div class="block editable-block">
      <div
        v-for="(word, index) in confirmMnemonicPhrase"
        :key="word"
        v-on:click="onWordClick(word, index, false)"
      >
        {{ word }}
      </div>
    </div>
    <div class="editable-block-options">
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
    <div class="block mt-6">
      <button
        :disabled="confirmMnemonicPhrase.length !== 24"
        class="btn btn-primary btn-large-primary"
        v-on:click="onClickConfirm(confirmMnemonicPhrase)"
      >
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
