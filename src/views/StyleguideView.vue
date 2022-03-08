<template>
  <div class="styleguide page-container">
    <div class="container mx-auto">
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
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'StyleguideView',
  components: {
  },
  data () {
    return {}
  }
})
</script>
