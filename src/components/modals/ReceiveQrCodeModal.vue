<template>
  <div
    class="fixed flex items-end md:items-center top-0 bottom-0 left-0 right-0 justify-center bg-white/70 backdrop-blur-xl z-[99] modal-send-receive-parent"
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

    <div class="text-center bg-light-grey w-full max-w-[516px] radius-modal mx-auto shadow-modal modal-send-receive"
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
          <h1 class="text-large-heading text-center text-primary">Receive QR code</h1>
        </div>
      </div>

      <!-- Input Area -->
      <div class="modal-send-receive-input-area pt-0">
        <div class="block text-left break-words">
          <div class="flex items-center">
            <span class="text-normal-copy text-primary text-medium m-0 mr-2">Nolus token</span>
            <div
              class="inline-flex items-center bg-light-grey radius-rounded text-normal-copy text-primary text-medium m-0 p-1 ">
              <img
                src="@/assets/icons/coins/nls.svg"
                class="inline-block w-4 h-4 mr-1 my-0"
              />
              <span>NLS</span>
            </div>
          </div>
          <div class="block mt-1">
            <p class="text-normal-copy text-primary text-bold m-0">C1FAC987E9515B…63BE5162B4A00310244A</p>
            <button class="btn btn-secondary btn-medium-secondary btn-icon mt-2">
              <DuplicateIcon class="icon w-4 h-4"/>
              Copy
            </button>
          </div>
        </div>

        <div class="flex justify-center mt-7">
          <div class="inline-block w-[210px] h-[210px] p-4 bg-white border border-standart radius-rounded">
            <img
              src="@/assets/icons/qr-code.svg"
              class="block w-full h-full m-0"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { ArrowLeftIcon, DuplicateIcon } from '@heroicons/vue/solid'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ReceiveQrCodeModal',
  components: {
    ArrowLeftIcon,
    DuplicateIcon
  },
  props: {
    tryButton: {
      type: Function
    }
  }
})
</script>
