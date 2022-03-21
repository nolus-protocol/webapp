<template>
    <div class="block input-field">
        <label
            :for="this.id"
            class="block text-normal-copy text-primary text-medium"
        >{{ this.label }}</label>
        <div
            class="block editable-block"
        >
            <div>
                myself
            </div>
        </div>
        <div class="editable-block-options">
            <button
                id="swallow"
                class="editable-block-option"
            >
                swallow
            </button>
            <button
                id="rich"
                class="editable-block-option"
            >
                rich
            </button>
            <button
                id="unveil"
                class="editable-block-option"
            >
                unveil
            </button>
        </div>
        <div class="block mt-6">
            <button class="btn btn-primary btn-large-primary">Confirm</button>
        </div>
    </div>
</template>

<script type="ts">

export default {
  name: 'SelectorTextField',
  components: {},
  props: ['name', 'id', 'label', 'isError', 'errorMsg'],
  data () {
    return {
      default: {
        value: ''
      }
    }
  }
}
</script>
