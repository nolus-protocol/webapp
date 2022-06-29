<template>
  <div
    class="fixed flex items-center top-0 bottom-0 left-0 right-0 justify-center bg-white/70 backdrop-blur-xl z-[99]"
    @click="$emit('close-modal')"
  >
    <div
      class="text-center bg-white w-full max-w-[400px] px-10 py-10 radius-modal mx-auto my-10 shadow-modal"
      @click.stop
    >
      <div class="flex flex-col items-center">
        <CheckIcon
          class="h-14 w-14 bg-light-red/30 radius-circle p-2 text-dark-red"
        />
        <h1 class="nls-font-700 nls-32 text-primary text-center mt-3 mb-0">
          Error
        </h1>
        <p
          class="nls-font-700 nls-18 text-primary text-center nls-14 nls-font-400 mt-2 mb-0"
        >
          Messages are used to interact with SDK modules or other CW smart
          contracts. Since messages are executed in a set-and-forget manner, you
          will not get a response on
        </p>
        <div class="flex gap-2 mt-5">
          <button
            class="bg-light-electric text-white px-4 py-2 rounded-md nls-font-700 text-sm"
            v-on:click="this.tryButton"
          >
            Try again
          </button>
          <button
            class="bg-white border border-dark/20 px-4 py-2 rounded-md nls-font-700 text-sm"
            @click="$emit('close-modal')"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { CheckIcon } from '@heroicons/vue/solid'

export default {
  name: 'ErrorModal',
  components: {
    CheckIcon
  },
  props: {
    tryButton: {
      type: Function
    }
  }
}
</script>
