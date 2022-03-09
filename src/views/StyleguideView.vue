<template>
  <div class="styleguide page-container">
    <div class="container mx-auto pb-8">

      <!-- Typography & Colors -->
      <div class="grid grid-cols-12 gap-6 pt-8">
        <div class="col-span-6">
          <h1 class="text text-large-heading">Typography & color</h1>
          <p class="text text-big-number mt-8">48/1.1 - Big number</p>
          <p class="text text-large-heading mt-8">32/1.1 - Large heading</p>
          <p class="text text-default-heading mt-8">20/1.2 - Default Heading</p>
          <p class="text text-small-heading mt-8">18/1.2 - Small Heading</p>
          <p class="text text-large-copy mt-8">16/1.4 - Large copy <span class="text text-medium">Medium</span> <span class="text text-bold">Bold</span></p>
          <p class="text text-normal-copy mt-8">14/1.4 - Normal copy <span class="text text-medium">Medium</span> <span class="text text-bold">Bold</span></p>
          <p class="text text-small-copy mt-8">13/1.3 - Small copy <span class="text text-medium">Medium</span> <span class="text text-bold">Bold</span></p>
          <p class="text text-detail mt-8">12/1.2 - Detail</p>
        </div>
        <div class="col-span-6">
          <h1 class="text text-large-heading">Colors</h1>
          <p class="text text-default-heading mt-8">
            <span class="flex items-baseline justify-between">
              <span>
                Neutrals background scale
              </span>
              <span class="text text-normal-copy">
                Dark mode
              </span>
            </span>
          </p>
          <div class="flex flex-row justify-between mt-4">
            <div class="flex">
              <div class="d-inline-block w-[81px] h-[81px] bg-light-grey"></div>
              <div class="d-inline-block w-[81px] h-[81px] bg-grey"></div>
            </div>
            <div class="d-inline-block w-[81px] h-[81px] bg-dark"></div>
          </div>

          <p class="text text-default-heading mt-8">Neutral typography scale</p>
          <div class="flex flex-row mt-4">
            <div class="d-inline-block w-[81px] h-[81px] bg-light-blue"></div>
            <div class="d-inline-block w-[81px] h-[81px] bg-medium-blue"></div>
            <div class="d-inline-block w-[81px] h-[81px] bg-dark-blue"></div>
          </div>

          <p class="text text-default-heading mt-8">CTA color scale</p>
          <div class="flex flex-row mt-4">
            <div class="d-inline-block w-[81px] h-[81px] bg-light-electric"></div>
            <div class="d-inline-block w-[81px] h-[81px] bg-medium-electric"></div>
            <div class="d-inline-block w-[81px] h-[81px] bg-dark-electric"></div>
          </div>

          <p class="text text-default-heading mt-8">CTA color scale</p>
          <div class="flex flex-row mt-4">
            <div class="d-inline-block w-[81px] h-[81px] bg-light-red"></div>
            <div class="d-inline-block w-[81px] h-[81px] bg-medium-red"></div>
            <div class="d-inline-block w-[81px] h-[81px] bg-dark-red"></div>
          </div>

          <p class="text text-default-heading mt-8">CTA color scale</p>
          <div class="flex flex-row mt-4">
            <div class="d-inline-block w-[81px] h-[81px] bg-light-green"></div>
            <div class="d-inline-block w-[81px] h-[81px] bg-medium-green"></div>
            <div class="d-inline-block w-[81px] h-[81px] bg-dark-green"></div>
          </div>

          <p class="text text-default-heading mt-8">Warning scale</p>
          <div class="flex flex-row mt-4">
            <div class="d-inline-block w-[81px] h-[81px] bg-light-yellow"></div>
            <div class="d-inline-block w-[81px] h-[81px] bg-medium-yellow"></div>
            <div class="d-inline-block w-[81px] h-[81px] bg-dark-yellow"></div>
          </div>

          <p class="text text-default-heading mt-8">Brand accent</p>
          <div class="flex flex-row mt-4">
            <div class="d-inline-block w-[81px] h-[81px] bg-orange"></div>
          </div>
        </div>
      </div>

      <!-- Buttons -->
      <div class="grid grid-cols-12 gap-6 mt-8">
        <div class="col-span-12">
          <h1 class="text text-large-heading">Buttons</h1>

          <!-- Large - Primary -->
          <h2 class="text text-default-heading mt-6">Large - Primary</h2>
          <div class="flex mt-4">
            <button class="btn btn-primary btn-large-primary mr-4">
              Buy Tokens
            </button>
            <button class="btn btn-primary btn-large-primary js-loading">
              Buy Tokens
            </button>
          </div>

          <!-- Large - Secondary -->
          <h2 class="text text-default-heading mt-6">Large - Secondary</h2>
          <div class="flex mt-4">
            <button class="btn btn-secondary btn-large-secondary mr-4">
              Buy Tokens
            </button>
            <button class="btn btn-secondary btn-large-secondary js-loading">
              Buy Tokens
            </button>
          </div>

          <!-- Large - Boxes -->
          <h2 class="text text-default-heading mt-6">Large - Boxes</h2>
          <div class="flex mt-4">
            <button class="btn btn-box btn-large-box mr-4">
              <img
                src="@/assets/icons/google.svg"
              />
              Buy Tokens
            </button>
            <button class="btn btn-box btn-large-box js-loading">
              Buy Tokens
            </button>
          </div>

          <!-- Medium - Secondary -->
          <h2 class="text text-default-heading mt-6">Medium - Secondary</h2>
          <div class="flex mt-4">
            <button class="btn btn-secondary btn-medium-secondary mr-4">
              None
            </button>
            <button class="btn btn-secondary btn-medium-secondary js-loading mr-4">
              None
            </button>
            <button class="btn btn-secondary btn-medium-secondary btn-emphatized mr-4">
              None
            </button>
            <button class="btn btn-secondary btn-medium-secondary btn-emphatized success mr-4">
              None
            </button>
          </div>

          <!-- Medium - Secondary + Icon -->
          <h2 class="text text-default-heading mt-6">Medium - Secondary + Icon</h2>
          <div class="flex mt-4">
            <button class="btn btn-secondary btn-medium-secondary btn-icon mr-4">
              <DuplicateIcon class="icon w-4 h-4" />
              Copy
            </button>
            <button class="btn btn-secondary btn-medium-secondary btn-icon js-loading mr-4">
              <DuplicateIcon class="icon w-4 h-4" />
              Copy
            </button>
            <button class="btn btn-secondary btn-medium-secondary btn-icon btn-emphatized mr-4">
              <DuplicateIcon class="icon w-4 h-4" />
              Copy
            </button>
            <button class="btn btn-secondary btn-medium-secondary btn-emphatized success btn-icon mr-4">
              <DuplicateIcon class="icon w-4 h-4" />
              Copy
            </button>
          </div>

          <!-- Circle on background -->
          <h2 class="text text-default-heading mt-6">Circle on background</h2>
          <div class="inline-flex mt-4 bg-light-grey p-4 rounded-lg">
            <button class="btn btn-close">
              <XIcon class="icon w-5 h-5" />
            </button>
          </div>

          <!-- Header buttons -->
          <h2 class="text text-default-heading mt-6">Header buttons</h2>
          <div class="inline-flex mt-4 bg-light-grey p-4 rounded-lg">
            <button class="btn btn-header mr-4">
              <BellIcon class="icon w-4 h-4" />
            </button>
            <button class="btn btn-header">
              <BellIcon class="icon w-4 h-4" />
              <span class="counter">8</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Pickers -->
      <div class="grid grid-cols-12 gap-6 mt-8">
        <div class="col-span-12">
          <h1 class="text text-large-heading">Pickers</h1>

          <!-- Picker -->
          <h2 class="text text-default-heading mt-6">Picker</h2>
          <div class="flex mt-5">
            <div class="inline-block mr-5">
              <PickerDefault
                label="Picker Example"
                :options="[{value: 0, label: 'Option 1'}, {value: 1, label: 'Option 2'}, {value: 2, label: 'Option 3'},]"
              ></PickerDefault>
            </div>

            <div class="inline-block">
              <PickerDefault
                label="Picker Error Example"
                :options="[{value: 0, label: 'Option 1'}, {value: 1, label: 'Option 2'}, {value: 2, label: 'Option 3'},]"
                :isError="true"
                errorMsg="This is error!"
              ></PickerDefault>
            </div>
          </div>
          <div class="flex mt-5">
            <div class="inline-block mr-5">
              <PickerIcon
                label="Picker Icon Example"
                :options="[{value: 0, label: 'Option 1', icon: require('@/assets/icons/coins/nls.svg')}, {value: 1, label: 'Option 2', icon: require('@/assets/icons/coins/nls.svg')}, {value: 2, label: 'Option 3', icon: require('@/assets/icons/coins/nls.svg')},]"
              ></PickerIcon>
            </div>

            <div class="inline-block">
              <PickerIcon
                label="Picker Icon Example"
                :options="[{value: 0, label: 'Option 1', icon: require('@/assets/icons/coins/nls.svg')}, {value: 1, label: 'Option 2', icon: require('@/assets/icons/coins/nls.svg')}, {value: 2, label: 'Option 3', icon: require('@/assets/icons/coins/nls.svg')},]"
                :isError="true"
                errorMsg="This is error!"
              ></PickerIcon>
            </div>
          </div>

          <!-- Picker Small -->
          <h2 class="text text-default-heading mt-6">Picker Small</h2>
          <div class="flex mt-5">
            <div class="inline-block mr-5">
              <PickerDefault
                label="Picker Example"
                type="small"
                :options="[{value: 0, label: 'Option 1'}, {value: 1, label: 'Option 2'}, {value: 2, label: 'Option 3'},]"
              ></PickerDefault>
            </div>

            <div class="inline-block">
              <PickerDefault
                label="Picker Error Example"
                type="small"
                :options="[{value: 0, label: 'Option 1'}, {value: 1, label: 'Option 2'}, {value: 2, label: 'Option 3'},]"
                :isError="true"
                errorMsg="This is error!"
              ></PickerDefault>
            </div>
          </div>

          <div class="flex mt-5">
            <div class="inline-block mr-5">
              <PickerIcon
                label="Picker Icon Example"
                type="small"
                :options="[{value: 0, label: 'Option 1', icon: require('@/assets/icons/coins/nls.svg')}, {value: 1, label: 'Option 2', icon: require('@/assets/icons/coins/nls.svg')}, {value: 2, label: 'Option 3', icon: require('@/assets/icons/coins/nls.svg')},]"
              ></PickerIcon>
            </div>

            <div class="inline-block">
              <PickerIcon
                label="Picker Icon Example"
                type="small"
                :options="[{value: 0, label: 'Option 1', icon: require('@/assets/icons/coins/nls.svg')}, {value: 1, label: 'Option 2', icon: require('@/assets/icons/coins/nls.svg')}, {value: 2, label: 'Option 3', icon: require('@/assets/icons/coins/nls.svg')},]"
                :isError="true"
                errorMsg="This is error!"
              ></PickerIcon>
            </div>
          </div>

          <!-- Combo -->
          <h2 class="text text-default-heading mt-6">Combo</h2>
          <div class="flex mt-5">
            <div class="inline-block mr-5">
              <PickerCombo
                label="PickerCombo Example"
                :options="[{value: 0, label: 'Option 1'}, {value: 1, label: 'Option 2'}, {value: 2, label: 'Option 3'},]"
              ></PickerCombo>
            </div>

            <div class="inline-block">
              <PickerCombo
                label="PickerCombo Error Example"
                :options="[{value: 0, label: 'Option 1'}, {value: 1, label: 'Option 2'}, {value: 2, label: 'Option 3'},]"
                :isError="true"
                errorMsg="This is error!"
              ></PickerCombo>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { DuplicateIcon, XIcon, BellIcon } from '@heroicons/vue/solid'
import PickerDefault from '@/components/PickerDefault.vue'
import PickerIcon from '@/components/PickerIcon.vue'
import PickerCombo from '@/components/PickerCombo.vue'

export default defineComponent({
  name: 'StyleguideView',
  components: {
    DuplicateIcon,
    XIcon,
    BellIcon,
    PickerDefault,
    PickerIcon,
    PickerCombo
  },
  data () {
    return {}
  }
})
</script>
