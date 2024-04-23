<template>
  <div
    v-for="index in 10"
    :key="index"
    class="asset-partial nolus-box border-standart relative flex h-[82px] flex-col items-stretch justify-between border-b px-4 py-3 md:h-[53px] md:flex-row md:items-center"
  >
    <div class="flex flex-1 md:flex-[9]">
      <div class="flex max-w-[60%] flex-col justify-between md:flex-row">
        <div class="h-1.5 w-[9rem] rounded-full bg-grey"></div>
        <div class="h-1.5 w-[15rem] rounded-full bg-grey md:ml-10"></div>
      </div>
    </div>
    <div class="flex flex-1 items-center justify-between md:flex-[3]">
      <div class="h-1.5 w-24 rounded-full bg-grey md:flex"></div>
      <div class="h-1.5 w-24 rounded-full bg-grey md:flex"></div>
    </div>
  </div>
</template>

<script lang="ts" setup></script>

<style lang="" scoped></style>
