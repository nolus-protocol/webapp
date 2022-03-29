<template>
  <div class="fixed top-0 bottom-0 left-0 right-0 justify-center bg-white/70 backdrop-blur-sm">
    <div class="text-center bg-white max-w-[400px] px-10 py-6 rounded-3xl mx-auto my-10 drop-shadow-2xl">
      <div class="flex flex-col items-center">
        <CheckIcon class="h-10 w-10 bg-light-red/30 rounded-3xl p-2 text-dark-red"/>
        <h1 class="text-to-big-number text-primary text-center mt-2">Error</h1>
        <p>Message</p>
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
