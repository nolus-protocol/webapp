<template>
  <!-- TOOLTIP -->

  <!-- Component Start -->
  <div class="relative flex flex-col items-center group group-tooltip">
    <span class="icon icon-tooltip"></span>
    <div
      class="absolute bottom-0 flex flex-col items-center hidden mb-7 group-hover:flex"
    >
      <span
        class="relative z-10 p-2 text-normal text-left leading-none text-white whitespace-no-wrap bg-light-electric shadow-lg"
        style="
          border-radius: 4px;
          box-shadow: 0px 8px 48px rgba(7, 45, 99, 0.15);
          font-size: 10px;
          line-height: 14px;
          font-family: 'Garet-Medium';
          text-transform: normal !important;
        "
        >This is a simple tooplip that gives additional clarification on the
        information below</span
      >
      <div
        class="absolute w-3 h-3 -mt-2 rotate-45 bg-light-electric"
        style="bottom: -4px"
      ></div>
    </div>
  </div>
  <!-- Component End  -->

  <!-- /TOOLTIP -->
</template>

<script lang="ts">
import { defineComponent } from "vue";

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
