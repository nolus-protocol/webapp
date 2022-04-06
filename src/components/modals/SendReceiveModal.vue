<template>
  <div class="fixed flex items-end top-0 bottom-0 left-0 right-0 justify-center bg-white/70 backdrop-blur-xl z-[99]"
       @click="$emit('close-modal')">
    <div class="text-center bg-white w-full max-w-[400px] radius-modal mx-auto shadow-modal modal-send-receive"
         @click.stop>

        <!-- Header -->
        <div class="flex modal-send-receive-header">
            <button class="active">Send</button>
            <button>Receive</button>
        </div>

        <!-- Input Area -->
        <div class="modal-send-receive-input-area">
            1
        </div>

        <!-- Actions -->
        <div class="modal-send-receive-actions">
            <button class="btn btn-primary btn-large-primary">
                Next
            </button>
        </div>
    </div>
  </div>
</template>

<script>
import { CheckIcon } from '@heroicons/vue/solid'

export default {
  name: 'SendReceiveModal',
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
