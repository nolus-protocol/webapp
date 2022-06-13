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
        <div class="navigation-header">
          <h1 class="block w-full text-large-heading text-left text-primary">Lease</h1>
        </div>
      </div>

      <component :is="this.currentComponent.is"
                 v-model="this.currentComponent.props"/>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { SendMainComponentProps } from '@/components/SendComponents/SendMainComponent.vue'
import LeaseMainComponent from '@/components/LeaseComponents/LeaseMainComponent.vue'

enum ScreenState {
  LEASE = 'LeaseMainComponent',
}

interface LeaseModalData {
  is: string,
  props: object | SendMainComponentProps
}

export default defineComponent({
  name: 'LeaseModal',
  components: {
    LeaseMainComponent
  },
  props: {},
  data () {
    return {
      currentComponent: {} as LeaseModalData
    }
  },
  mounted () {
    this.currentComponent = {
      is: ScreenState.LEASE,
      props: {
        onClose: () => this.onCloseModal()
      }
    }
  },
  methods: {
    onCloseModal () {
      this.$emit('close-modal')
    }
  }
})
</script>
