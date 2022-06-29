<template>
  <!-- TOOLTIP -->

  <!-- Component Start -->
  <div class="relative flex flex-col items-center group group-tooltip">
    <span class="icon icon-tooltip"></span>
    <div
      class="absolute bottom-0 flex flex-col items-center hidden mb-7 group-hover:flex"
    >
      <span
        class="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap bg-black shadow-lg"
        >A top aligned tooltip.</span
      >
      <div
        class="absolute w-3 h-3 -mt-2 rotate-45 bg-black"
        style="background: #000; bottom: -4px"
      ></div>
    </div>
  </div>
  <!-- Component End  -->

  <!-- /TOOLTIP -->
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";

export interface TooltipProps {}
export default defineComponent({
  name: "TooltipComponent",

  props: {
    content: {
      type: String,
    },
  },
});
</script>
