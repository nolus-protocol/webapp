<template>
  <div
    v-for="index in 2"
    :key="index"
    class="asset-partial nolus-box border-standart relative flex h-[67px] items-center items-center justify-between justify-between border-b px-4 py-3"
  >
    <div class="w-[50%] grow-[1] md:w-auto">
      <div class="mb-2.5 h-1.5 w-32 rounded-full bg-grey"></div>
      <div class="h-1.5 w-24 rounded-full bg-grey"></div>
    </div>
    <div class="flex w-[50%] grow-[4] flex-col items-end md:w-auto md:items-start">
      <div class="mb-2.5 h-1.5 w-32 rounded-full bg-grey"></div>
      <div class="ml-8 h-1.5 w-24 rounded-full bg-grey"></div>
    </div>
    <div class="hidden h-1.5 w-12 rounded-full bg-grey md:flex"></div>
  </div>
</template>

<script lang="ts" setup></script>

<style lang="" scoped></style>
