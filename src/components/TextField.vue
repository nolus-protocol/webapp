<template>
  <fieldset>
    <div class="block input-field">
        <label
            :for="this.id"
            class="block text-normal-copy text-primary text-medium"
        >{{ this.label }}</label>
        <textarea
            :name="this.name"
            :id="this.id"
            :class="typeof this.isError !== 'undefined' && this.isError === true ? 'error' : ''"
        ></textarea>
        <span :class="[
            'msg error ',
            typeof this.errorMsg !== 'undefined' && this.errorMsg !== null ? '' : 'hidden'
        ]">{{ typeof this.errorMsg !== 'undefined' && this.errorMsg !== null ? this.errorMsg : '' }}</span>
    </div>
  </fieldset>
</template>

<script>
export default {
  name: 'TextField',
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
    isError: {
      type: Boolean
    },
    errorMsg: {
      type: String
    }
  },
  data () {
    return {
      default: {
        value: ''
      }
    }
  }
}
</script>
