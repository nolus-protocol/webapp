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
            <button>Supply</button>
            <button class="active">Withdraw</button>
        </div>

        <!-- Input Area -->
        <div class="modal-send-receive-input-area">

          <div class="block text-left">
            <div class="block py-3 px-4 mt-4 bg-light-grey radius-light text-left text-normal-copy text-primary text-medium">
              Available to withdraw:
              <a
                href="#"
                class="text-secondary text-bold underline ml-2"
              >
                112 NLS
              </a>
            </div>

            <div class="block mt-4">
              <CurrencyField
                name="amount"
                id="amount"
                label="Amount"
              ></CurrencyField>
            </div>
            
            <div class="flex items-center box box-warning radius-rounded p-4 mt-4 text-left break-words">
              <div class="inline-block mr-2">
                <img
                  src="@/assets/icons/calendar.svg"
                  class="block mx-auto my-0 w-5 h-5"
                />
              </div>
              <div class="block grow-1">
                <p class="text-left text-primary text-normal-copy text-medium">Deposit lock ends at</p>
                <p class="text-left text-primary text-normal-copy">Dec 29, 2021 @ 18:00 UTC</p>
              </div>
            </div>
          </div>
        </div>

         <!-- Actions -->
        <div class="modal-send-receive-actions">
            <button class="btn btn-primary btn-large-primary">
              Withdraw
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
  name: 'WithdrawSupplyModal',
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
