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
            <button class="active">Send</button>
            <button>Receive</button>
        </div>

        <!-- Input Area -->
        <div class="modal-send-receive-input-area">
          <div class="block py-3 px-4 bg-light-grey radius-light text-left text-normal-copy text-primary text-medium">
            Current balance:

            <a
              href="#"
              class="text-secondary text-bold underline ml-2"
            >
              3,600,000 NLS
            </a>
          </div>

          <div class="block text-left">
            <div class="block mt-4">
              <CurrencyField
                name="amount"
                id="amount"
                label="Amount"
              ></CurrencyField>
            </div>

            <div class="block mt-4">
              <PickerDefault
                label="Network"
                :options="[{value: 0, label: 'ETH'}, {value: 1, label: 'BTC'}, {value: 2, label: 'NLS'},]"
              ></PickerDefault>
            </div>

            <div class="block mt-4">
              <PickerCombo
                label="Send to"
                :options="[{value: 0, label: 'Option 1'},]"
              ></PickerCombo>
            </div>

            <div class="block mt-4">
              <InputField
                type="text"
                name="memo"
                id="memo"
                label="Memo (optional)"
              ></InputField>

              <div class="block mt-2">
                <button class="btn btn-secondary btn-medium-secondary btn-icon ml-auto mr-0 flex items-center">
                  <StarIcon class="inline-block icon w-4 h-4 mr-1" />
                  Save as contact
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="modal-send-receive-actions">
            <button class="btn btn-primary btn-large-primary">
                Next
            </button>
        </div>
    </div>
  </div>
</template>

<script>
import { CheckIcon, StarIcon } from '@heroicons/vue/solid'
import CurrencyField from '@/components/CurrencyField.vue'
import PickerDefault from '@/components/PickerDefault.vue'
import PickerCombo from '@/components/PickerCombo.vue'
import InputField from '@/components/InputField.vue'

export default {
  name: 'SendReceiveModal',
  components: {
    CheckIcon,
    StarIcon,
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
