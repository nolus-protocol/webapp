<template>
  <div
    class="nls-sm-hidden border-standart flex hidden grid-cols-12 items-center gap-6 border-b pb-3 text-12 md:grid lg:grid"
  >
    <div class="nls-font-500 nls-12 text-dark-grey text-upper col-span-2 block text-left">
      {{ $t("message.tx-hash") }}
    </div>
    <div class="nls-font-500 nls-12 text-dark-grey text-upper col-span-6 flex items-center justify-start lg:text-left">
      <span class="inline-block">{{ $t("message.action") }}</span>
    </div>
    <div class="nls-font-500 nls-12 text-dark-grey text-upper col-span-2 items-center justify-end text-right md:flex">
      <span class="inline-block">{{ $t("message.fee") }}</span>
    </div>
    <div class="nls-font-500 nls-12 text-dark-grey text-upper col-span-2 items-center justify-end text-right md:flex">
      <span class="inline-block">{{ $t("message.time") }}</span>
    </div>
  </div>
</template>
