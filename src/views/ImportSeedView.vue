<template>
  <h1 class="text-to-big-number text-primary text-center relative">
    <button
      v-on:click="clickBack"
      type="button"
      class="inline-block align-baseline absolute left-0 top-2/4 -mt-2.5"
    >
      <ArrowLeftIcon class="h-5 w-5" aria-hidden="true"/>
    </button>
    <span
      class="inline-block align-baseline"
    >
                            Import seed
                        </span>
  </h1>

  <div
    class="
                        block
                        rounded-2xl
                        bg-white
                        mt-8
                        p-10
                        border border-standart
                        shadow-box
                        "
  >
    <TextField
      name="seed"
      id="seed"
      label="Mnemonic seed"
    ></TextField>
    <div class="flex mt-6">
      <button class="btn btn-primary btn-large-primary mr-4" disabled="disabled">
        Register
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import TextField from '@/components/TextField.vue'
import { ArrowLeftIcon } from '@heroicons/vue/solid'
import router from '@/router'

export default defineComponent({
  name: 'ImportSeedView',
  components: {
    TextField,
    ArrowLeftIcon
  },
  data () {
    return {}
  },
  methods: {
    clickBack: () => {
      router.go(-1)
    }
  }
})
</script>
