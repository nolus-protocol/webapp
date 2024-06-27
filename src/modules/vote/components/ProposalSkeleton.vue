<script lang="ts" setup></script>

<template>
  <div class="flex flex-row flex-wrap gap-y-8 lg:gap-x-5">
    <div
      v-for="index in 5"
      :key="index"
      :class="index > 1 ? ['bg-transparent', 'lg:w-[calc(50%-10px)]'] : ['background']"
      class="proposal flex w-full flex-col gap-3 p-5 shadow-field-normal lg:rounded-xl"
    >
      <div class="text-upper flex flex-col justify-between gap-2 text-[8px] md:flex-row md:gap-0">
        <div class="h-0.5 w-[30px] bg-grey" />
        <div
          v-if="index === 1"
          class="h-0.5 w-[300px] bg-grey"
        />
      </div>
      <div class="text-small-heading h-[5px] w-[100px] break-all bg-grey text-primary" />
      <div class="h-[5px] w-full bg-grey" />
      <div class="flex flex-col gap-3 text-12 text-medium-blue">
        <div class="h-[2px] w-full bg-grey" />
        <div class="h-[2px] w-full bg-grey" />
        <div class="h-[2px] w-full bg-grey" />
      </div>
      <div class="btn btn-secondary btn-medium-secondary h-[25px] w-[91px] self-start bg-grey !py-1 !text-12" />

      <div v-if="index === 1">
        <div class="flex flex-col gap-3">
          <div class="w-full border-b border-border-color bg-transparent" />
          <div class="btn btn-primary btn-large-primary h-[36px] w-[58px] self-end bg-grey !px-3 !py-2" />
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
    content: "";
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
