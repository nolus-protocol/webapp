<template>
  <div class="fixed flex items-center top-0 bottom-0 left-0 right-0 justify-center bg-white/70 backdrop-blur-xl z-[99]">
    <div class="text-center bg-white w-full max-w-[400px] px-10 py-10 radius-modal mx-auto my-10 shadow-modal">
      <div class="flex flex-col items-center">
        <CheckIcon class="h-14 w-14 bg-light-red/30 radius-circle p-2 text-dark-red"/>
        <h1 class="text-large-heading text-primary text-center mt-3 mb-0">Error</h1>
        <p class="text-small-heading text-primary text-center text-regular mt-2 mb-0">Message</p>
        <div class="flex gap-2 mt-5">
          <button class="bg-light-electric text-white px-4 py-2 rounded-md text-bold text-sm">Try again</button>
          <button class="bg-white border border-dark/20 px-4 py-2 rounded-md text-bold text-sm">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { CheckIcon } from '@heroicons/vue/solid'

export default {
  components: {
    CheckIcon
  },
  name: 'ErrorModal'
}
</script>

<style scoped>

</style>
