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
        <div class="flex modal-send-receive-header">
            <button class="active">Supply</button>
            <button>Withdraw</button>
        </div>

        <!-- Input Area -->
        <div class="modal-send-receive-input-area">

          <div class="block text-left">
            <div class="block mt-4">
              <CurrencyField
                name="amount"
                id="amount"
                label="Amount"
              ></CurrencyField>
            </div>
            
            <div class="block mt-4">
              <p class="text-primary text-normal-copy text-medium m-0">Deposit lock period</p>
              <div class="flex mt-2">
                <button class="w-100 btn btn-secondary btn-medium-secondary grow-1 mr-2">
                  None
                </button>
                <button class="w-100 btn btn-secondary btn-medium-secondary grow-1 mr-2">
                  3mo
                </button>
                <button class="w-100 btn btn-secondary btn-medium-secondary grow-1 mr-2">
                  6mo
                </button>
                <button class="w-100 btn btn-secondary btn-medium-secondary grow-1 mr-2">
                  12mo
                </button>
                <button class="w-100 btn btn-secondary btn-medium-secondary grow-1">
                  18mo
                </button>
              </div>
            </div>

            <div class="block py-3 px-4 mt-4 bg-light-grey radius-light text-left text-normal-copy text-primary text-medium">
              Expected APY:
              <span class="text-bold">24%</span>
            </div>
          </div>
        </div>

         <!-- Actions -->
        <div class="modal-send-receive-actions">
            <button class="btn btn-primary btn-large-primary">
              Supply
            </button>
        </div>
    </div>
  </div>
</template>

<script>
import { DuplicateIcon, QrcodeIcon } from '@heroicons/vue/solid'
import PickerIcon from '@/components/PickerIcon.vue'
import CurrencyField from '@/components/CurrencyField.vue'
import PickerDefault from '@/components/PickerDefault.vue'
import PickerCombo from '@/components/PickerCombo.vue'
import InputField from '@/components/InputField.vue'

export default {
  name: 'SupplyWithdrawModal',
  components: {
    PickerIcon,
    DuplicateIcon,
    QrcodeIcon,
    CurrencyField,
    PickerDefault,
    PickerCombo,
    InputField
  },
  props: {
    tryButton: {
      type: Function
    }
  }
}
</script>
