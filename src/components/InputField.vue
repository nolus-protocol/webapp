<template>
  <fieldset>
    <div class="block input-field">
        <label
            :for="this.id"
            class="block text-normal-copy text-primary text-medium"
        >{{ this.label }}</label>
        <input
            :type="this.type"
            :name="this.name"
            :id="this.id"
            :class="typeof this.isError !== 'undefined' && this.isError === true ? 'error' : ''"
        >
        <span :class="[
            'msg error ',
            typeof this.errorMsg !== 'undefined' && this.errorMsg !== null ? '' : 'hidden'
        ]">{{ typeof this.errorMsg !== 'undefined' && this.errorMsg !== null ? this.errorMsg : '' }}</span>
    </div>
  </fieldset>
</template>

<script>
export default {
  name: 'InputField',
  props: ['type', 'name', 'id', 'label', 'isError', 'errorMsg'],
  data () {
    return {
      default: {
        value: ''
      }
    }
  }
}
</script>
