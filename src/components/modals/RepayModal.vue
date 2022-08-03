<template>
  <div
    class="fixed flex modal items-center top-0 bottom-0 left-0 right-0 justify-center bg-white/70 z-[99]"
    style="linear-gradient(314.47 deg, #EBEFF5 2.19 %, #F7F9FC 100 %);"
    @click="$emit('close-modal')"
  >
    <div
      class="text-center modal bg-white w-full max-w-[516px] radius-modal mx-auto shadow-modal"
      @click.stop
    >
      <button class="btn-close-modal" @click="$emit('close-modal')">
        <img class="inline-block w-4 h-4" src="@/assets/icons/cross.svg"/>
      </button>
      <div class="flex modal-header">
        <p class="text-28 md:text-32 nls-font-700">{{ $t('message.repay') }}</p>
      </div>

      <component
        :is="this.currentComponent.is"
        v-model="this.currentComponent.props"
      />
    </div>
  </div>
</template>

<script lang="ts">
import CurrencyField from '@/components/CurrencyField.vue'
import { defineComponent, PropType } from 'vue'
import TooltipComponent from '@/components/TooltipComponent.vue'
import { LeaseData } from '@/types/LeaseData'
import RepayMainComponent, { SendMainComponentProps } from '@/components/RepayComponents/RepayMainComponent.vue'

enum ScreenState {
  REPAY = 'RepayMainComponent',
}

interface RepayModalData {
  is: string;
  props: object | SendMainComponentProps;
}

export default defineComponent({
  name: 'RepayModal',
  components: {
    CurrencyField,
    TooltipComponent,
    RepayMainComponent
  },
  props: {
    leaseInfo: {
      type: Object as PropType<LeaseData>
    }
  },
  data () {
    return {
      currentComponent: {} as RepayModalData
    }
  },
  mounted () {
    this.currentComponent = {
      is: ScreenState.REPAY,
      props: {
        onClose: () => this.onCloseModal(),
        leaseData: this.leaseInfo
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
<style scoped>
.modal-send-receive-actions {
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}
</style>
