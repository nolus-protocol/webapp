<template>
  <!-- TOOLTIP -->

  <!-- Component Start -->
  <div
    ref="target"
    class="relative flex flex-col items-center group group-tooltip"
    @mouseover="mouseover"
    @mouseleave="mouseleave"
  >
    <span
      class="icon icon-tooltip"
      :class="[$attrs.class]"
    ></span>
  </div>
  <Teleport to="body">
    <div
      ref="tooltip"
      class="absolute flex flex-col items-center mb-7 group-hover:flex tooltip tooltip-animations"
    >
      <div class="relative flex">
        <span
          class="relative z-10 p-2 text-normal text-left leading-none text-white whitespace-no-wrap bg-light-electric shadow-lg content"
        >
          {{ content }}
        </span>
        <div
          ref="triangle"
          class="absolute w-3 h-3 -mt-2 bg-light-electric"
          style="
                  bottom: -4px;
                  left: 50%;
                  transform: translateX(-50%) rotate(45deg);
                "
        ></div>
      </div>
    </div>
  </Teleport>
  <!-- Component End  -->

  <!-- /TOOLTIP -->
</template>

<script setup lang="ts">
import { ref } from "vue";

const tooltip = ref(null as HTMLDivElement | null);
const target = ref(null as HTMLDivElement | null);
const triangle = ref(null as HTMLDivElement | null);

let timeout: NodeJS.Timeout;

defineProps({
  content: {
    type: String,
    default: "",
  },
});

function mouseover(event: MouseEvent) {

  if (timeout) {
    clearTimeout(timeout);
  }

  const parent = target.value as HTMLDivElement;
  const element = tooltip.value as HTMLDivElement;
  const triangleElement = triangle.value as HTMLDivElement;

  if (!element) {
    return false;
  }

  if(!triangleElement){
    return false;
  }

  if (target.value) {
    const rect = parent.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    const left = rect.left + window.scrollX - elementRect.width / 2 + rect.width / 2;
    const top = rect.top + window.scrollY - elementRect.height - 15;

    const maxWidth = window.innerWidth;

    element.style.left = `${left}px`;
    element.style.top = `${top}px`;

    if (left + elementRect.width > maxWidth) {
      element.style.left = `${window.innerWidth - elementRect.width - 10}px`;
      triangleElement.style.left = `85%`;
    }

    if (left < 0) {
      element.style.left = `10px`;
      triangleElement.style.left = `15%`;
    }
  }

  element.style.visibility = "visible";
  element.style.opacity = "1";
};

function mouseleave() {
  const element = tooltip.value as HTMLDivElement;
  if (element) {
    element.style.opacity = "0";
    timeout = setTimeout(() => {
      element.style.visibility = "hidden";
    }, 200);
  }
};
</script>
<style scoped lang="scss">
span.content {
  border-radius: 4px;
  box-shadow: 0px 8px 48px rgba(7, 45, 99, 0.15);
  font-size: 10px;
  line-height: 14px;
  font-family: "Garet-Medium", sans-serif;
  text-transform: normal !important;
}
</style>
