<template>
  <fieldset>
    <div class="space-y-5">
      <div
        v-for="option in this.options"
        :key="option.value"
        class="relative flex items-start"
      >
        <div class="flex items-center h-5">
          <input
            :id="option.value"
            :aria-describedby="`${option.value}-description`"
            :name="option.name"
            type="radio"
            class="
              focus:ring-indigo-500
              h-4
              w-4
              text-indigo-600
              border-gray-300
            "
          />
        </div>
        <div class="ml-3 text-sm">
          <label :for="option.value" class="font-medium text-gray-700">{{
            option.label
          }}</label>
        </div>
      </div>
    </div>
  </fieldset>
</template>

<script>
export default {
  name: 'RadioInput',
  props: {
    options: {
      type: String
    }
  },
  data () {
    return {
      selected: {
        value: -1,
        label: ''
      }
    }
  }
}
</script>
