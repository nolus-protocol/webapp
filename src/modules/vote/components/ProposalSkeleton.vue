<script lang="ts" setup></script>

<template>
  <div class="flex flex-wrap flex-row lg:gap-x-5 gap-y-8">
    <div
      v-for="index in 5"
      :key="index"
      :class="index > 1 ? ['bg-transparent', 'lg:w-[calc(50%-10px)]'] : ['background']"
      class="proposal w-full flex flex-col shadow-box lg:rounded-xl p-5 gap-3"
    >
      <div class="flex flex-col md:flex-row gap-2 md:gap-0 justify-between text-[8px] text-upper">
        <div class="w-[30px] h-0.5 bg-grey" />
        <div v-if="index === 1" class="w-[300px] h-0.5 bg-grey" />
      </div>
      <div class="text-primary text-small-heading break-all w-[100px] h-[5px] bg-grey" />
      <div class="w-full h-[5px] bg-grey" />
      <div class="text-medium-blue text-12 flex flex-col gap-3">
        <div class="w-full h-[2px] bg-grey" />
        <div class="w-full h-[2px] bg-grey" />
        <div class="w-full h-[2px] bg-grey" />
      </div>
      <div
        class="btn btn-secondary btn-medium-secondary self-start !text-12 !py-1 w-[91px] h-[25px] bg-grey"
      />

      <div v-if="index === 1">
        <div class="flex flex-col gap-3">
          <div class="w-full border-standart border-b bg-transparent" />
          <div
            class="btn btn-primary btn-large-primary self-end !px-3 !py-2 w-[58px] h-[36px] bg-grey"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dark,
.sync {
  .proposal {
    outline: none;
    position: relative;
  }

  .proposal::after {
    content: '';
    position: absolute;
    top: 0px;
    right: 0px;
    bottom: 0px;
    left: 0px;
    border: 1px solid #2d3748;
    border-radius: 12px;
    pointer-events: none;
  }
}
</style>
