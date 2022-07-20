<template>
  <div
    class="fixed flex items-end md:items-center top-0 bottom-0 left-0 right-0 justify-center bg-white/70 z-[999999999] modal-send-receive-parent"
    style="linear-gradient(314.47 deg, #EBEFF5 2.19 %, #F7F9FC 100 %);"
    @clicked="onClickChild"
  >
    <button class="btn-close-modal" @click="$emit('close-modal')">
      <img class="inline-block w-4 h-4" src="@/assets/icons/cross.svg"/>
    </button>

    <div
      :style="!isDefaultState ? 'padding-top:15px' : 'padding-top:0px'"
      class="text-center bg-white w-full max-w-[516px] radius-modal mx-auto shadow-modal modal-send-receive"
      @click.stop
    >

      <!-- Header -->
      <div v-if="isDefaultState" class="flex modal-send-receive-header">
        <button
          v-for="(title, index) of titles"
          :key="title"
          :class="index === this.currentComponentIndex ? 'active' : ''"
          v-on:click="switchTab(index, title)">
          {{ title }}
        </button>
      </div>
      <component
        :is="currentComponent.is"
        v-model="this.currentComponent.props"
        @defaultState="onClickChild"
      />
    </div>
  </div>
</template>

<script lang="ts">
import SendMainComponent, { SendMainComponentProps } from '@/components/SendComponents/SendMainComponent.vue'
import { defineComponent } from 'vue'
import ReceiveMainComponent from '@/components/ReceiveComponents/ReceiveMainComponent.vue'
import SwapMainComponent from '@/components/modals/SwapMainComponent.vue'
import BuyMainComponent from '@/components/modals/BuyMainComponent.vue'
import SupplyMainComponent from '@/components/modals/SupplyMainComponent.vue'
import WithdrawMainComponent from '@/components/modals/WithdrawMainComponent.vue'

interface ReceiveSendModalData {
  is: string;
  props: object | SendMainComponentProps;
}

export default defineComponent({
  name: 'Dialog',
  components: {
    SendMainComponent,
    ReceiveMainComponent,
    SwapMainComponent,
    BuyMainComponent,
    SupplyMainComponent,
    WithdrawMainComponent
  },
  props: ['titles'],
  data () {
    return {
      currentComponent: {} as ReceiveSendModalData,
      currentComponentIndex: 0,
      isDefaultState: true
    }
  },
  mounted () {
    this.currentComponent = {
      is: `${this.titles[this.currentComponentIndex]}MainComponent`,
      props: {
        onClose: () => this.onCloseModal()
      }
    }
    this.switchTab(0, this.titles[0])
  },
  methods: {
    onClickChild (value: boolean) {
      this.isDefaultState = value
    },
    switchTab (value: number, title: string) {
      this.currentComponentIndex = value
      this.currentComponent = {
        is: `${this.titles[this.currentComponentIndex]}MainComponent`,
        props: {
          onClose: () => this.onCloseModal()
        }
      }
    },
    onCloseModal () {
      this.$emit('close-modal')
    }
  }

})

</script>
