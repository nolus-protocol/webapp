<template>
  <div
    v-for="index in 10"
    :key="index"
    class="asset-partial nolus-box border-standart relative flex h-[82px] flex-col items-stretch justify-between border-b px-4 py-3 md:h-[53px] md:flex-row md:items-center"
  >
    <div class="flex flex-1 md:flex-[9]">
      <div class="flex w-full flex-col justify-between md:flex-row">
        <div class="h-1.5 w-[4rem] rounded-full bg-grey"></div>
        <div class="h-1.5 w-[20rem] rounded-full bg-grey md:ml-10"></div>
        <div class="h-1.5 w-[4rem] rounded-full bg-grey md:ml-10"></div>
        <div class="h-1.5 w-[20rem] rounded-full bg-grey md:ml-10"></div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup></script>

<style lang="" scoped></style>
