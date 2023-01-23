<template>
  <div
    class="nls-sm-hidden md:grid grid-cols-12 flex items-center gap-6 border-b border-standart pb-3 px-6 lg:grid hidden text-12"
  >
    <div
      class="col-span-2 block nls-font-500 nls-12 text-dark-grey text-left text-upper"
    >
      {{ $t("message.tx-hash") }}
    </div>
    <!-- <div
      class="col-span-2 block nls-font-500 nls-12 text-dark-grey text-left text-upper md:ml-4"
    >
      {{ $t("message.type") }}
    </div> -->
    <div
      class="flex items-center col-span-6 justify-start nls-font-500 nls-12 text-dark-grey lg:text-left text-upper"
    >
      <span class="inline-block">{{ $t("message.action") }}</span>
    </div>
    <div
      class="md:flex col-span-2 items-center justify-end nls-font-500 nls-12 text-dark-grey text-right text-upper"
    >
      <span class="inline-block">{{ $t("message.fee") }}</span>
    </div>
    <div
      class="md:flex col-span-2 items-center justify-end nls-font-500 nls-12 text-dark-grey text-right text-upper"
    >
      <span class="inline-block">{{ $t("message.time") }}</span>
    </div>
  </div>
</template>
