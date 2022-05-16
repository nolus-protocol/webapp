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

      <component :is="this.currentComponent.is"
                 v-model="this.currentComponent.props"/>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import SendMainComponent, { SendMainComponentProps } from '@/components/SendMainComponent.vue'
import ReceiveMainComponent from '@/components/ReceiveMainComponent.vue'

enum ScreenState {
  SEND = 'SendMainComponent',
  RECEIVE = 'ReceiveMainComponent'
}

interface ReceiveSendModalData {
  is: string,
  props: object | SendMainComponentProps
}

export default defineComponent({
  name: 'ReceiveSendModal',
  components: {
    SendMainComponent,
    ReceiveMainComponent
  },
  data () {
    return {
      currentComponent: {} as ReceiveSendModalData,
      isSendActive: true
    }
  },
  mounted () {
    this.currentComponent = {
      is: ScreenState.SEND,
      props: {
        onClose: () => this.onCloseModal()
      }
    }
  },
  methods: {
    switchTab (value: boolean) {
      if (value) {
        this.currentComponent = {
          is: ScreenState.SEND,
          props: {
            onClose: () => this.onCloseModal()
          }
        }
      } else {
        this.currentComponent = {
          is: ScreenState.RECEIVE,
          props: {
            onClose: () => this.onCloseModal()
          }
        }
      }

      this.isSendActive = value
    },
    onCloseModal () {
      this.$emit('close-modal')
    }
  }
})
</script>
