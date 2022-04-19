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

    <div class="text-center bg-white w-full max-w-[516px] radius-modal mx-auto shadow-modal modal-send-receive"
         @click.stop>

      <!-- Header -->
      <div class="flex modal-send-receive-header">
        <button :class="isSendActive ? 'active' : ''" v-on:click="switchTab(true)">Send</button>
        <button :class="!isSendActive ? 'active' : ''" v-on:click="switchTab(false)">Receive</button>
      </div>

      <component v-bind:is="isSendActive ? 'SendMainComponent' : 'ReceiveComponent'" v-model:onClose="onCloseModal"/>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import ReceiveComponent from '@/components/ReceiveComponent.vue'
import SendMainComponent from '@/components/SendMainComponent.vue'

export default defineComponent({
  name: 'ReceiveSendModal',
  components: {
    SendMainComponent,
    ReceiveComponent
  },
  props: {},
  data () {
    return {
      isSendActive: true
    }
  },
  methods: {
    switchTab (value: boolean) {
      this.isSendActive = value
    },
    onCloseModal () {
      this.$emit('close-modal')
    }
  }
})
</script>
