<template>
  <div class="fixed flex items-end md:items-center top-0 bottom-0 left-0 right-0 justify-center bg-white/70 backdrop-blur-xl z-[99] modal-send-receive-parent"
       @click="$emit('close-modal')">

    <button 
      class="btn-close-modal"
      @click="$emit('close-modal')"
    >
      <img
        src="@/assets/icons/cross.svg"
        class="inline-block w-4 h-4"
      />
    </button>

    <div class="text-center bg-white w-full max-w-[516px] radius-modal mx-auto shadow-modal modal-send-receive"
         @click.stop>

        <!-- Header -->
        <div class="flex modal-send-receive-header no-border">
          <div class="navigation-header">
            <button
              type="button"
              class="back-arrow"
            >
              <ArrowLeftIcon class="h-5 w-5" aria-hidden="true"/>
            </button>
            <h1 class="text-large-heading text-center text-primary">Confirm sending</h1>
          </div>
        </div>

        <!-- Input Area -->
        <div class="modal-send-receive-input-area pt-0">
          <div class="block bg-light-grey radius-rounded p-4 text-left break-words">
            <div class="block">
              <p class="text-normal-copy text-primary m-0">Send to:</p>
              <p class="text-normal-copy text-primary text-bold m-0">0x3371e0F5bF7c5DD1d9A7eF8366E633283759951a</p>
            </div>

            <div class="block mt-3">
              <p class="text-normal-copy text-primary m-0">Memo:</p>
              <p class="text-normal-copy text-primary text-bold m-0">emey95ya</p>
            </div>

            <div class="block mt-3">
              <p class="text-normal-copy text-primary m-0">Amount:</p>
              <p class="text-normal-copy text-primary text-bold m-0">1.023994 NOMO</p>
            </div>

            <div class="block mt-3">
              <p class="text-normal-copy text-primary m-0">Tx Id:</p>
              <p class="text-normal-copy text-primary text-bold m-0">C1FAC987E9515B…63BE5162B4A00310244A</p>
              <button class="btn btn-secondary btn-medium-secondary btn-icon mt-2">
                <DuplicateIcon class="icon w-4 h-4" />
                Copy
              </button>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="modal-send-receive-actions">
            <button class="btn btn-primary btn-large-primary js-loading">
                Next
            </button>
        </div>
    </div>
  </div>
</template>

<script>
import { ArrowLeftIcon, DuplicateIcon } from '@heroicons/vue/solid'

export default {
  name: 'ConfirmSendingModal',
  components: {
    ArrowLeftIcon,
    DuplicateIcon
  },
  props: {
    tryButton: {
      type: Function
    }
  }
}
</script>
