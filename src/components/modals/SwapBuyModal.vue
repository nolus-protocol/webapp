<template>
  <div
    class="fixed flex items-end md:items-center top-0 bottom-0 left-0 right-0 justify-center bg-white/70 z-[99] modal-send-receive-parent"
    @click="$emit('close-modal')"
    @clicked="onClickChild"
  >
    <button class="btn-close-modal" @click="$emit('close-modal')">
      <img class="inline-block w-4 h-4" src="@/assets/icons/cross.svg"/>
    </button>

    <div
      class="text-center bg-white w-full max-w-[516px] radius-modal mx-auto shadow-modal modal-send-receive"
      @click.stop
    >
      <!-- Header -->
      <div v-if="!isDefaultState" class="flex modal-send-receive-header">
        <button
          :class="isSendActive ? 'active' : ''"
          v-on:click="switchTab(true)"
        >
          Swap
        </button>
        <button
          :class="!isSendActive ? 'active' : ''"
          v-on:click="switchTab(false)"
        >
          Buy
        </button>
      </div>
      <component
        :is="this.currentComponent.is"
        v-model="this.currentComponent.props"
        @defaultState="onClickChild"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import SwapComponent, { SwapComponentProps } from '@/components/modals/SwapComponent.vue'
import BuyComponent from '@/components/modals/BuyComponent.vue'

enum ScreenState {
  SWAP = 'SwapComponent',
  BUY = 'BuyComponent',
}

interface ReceiveSendModalData {
  is: string;
  props: object | SwapComponentProps;
}

export default defineComponent({
  name: 'SwapBuyModal',
  components: {
    SwapComponent,
    BuyComponent
  },
  data () {
    return {
      currentComponent: {} as ReceiveSendModalData,
      isSendActive: true,
      isDefaultState: false
    }
  },
  mounted () {
    this.currentComponent = {
      is: ScreenState.SWAP,
      props: {
        onClose: () => this.onCloseModal()
      }
    }
  },
  emits: ['defaultState', 'close-modal'],
  methods: {
    onClickChild (value: boolean) {
      this.isDefaultState = value // someValue
    },
    switchTab (value: boolean) {
      if (value) {
        this.currentComponent = {
          is: ScreenState.SWAP,
          props: {
            onClose: () => this.onCloseModal()
          }
        }
      } else {
        this.currentComponent = {
          is: ScreenState.BUY,
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
