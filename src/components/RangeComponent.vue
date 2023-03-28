<template>
  <div
    ref="container"
    class="slider-box"
    @mousedown="onMouseDown"
    @touchstart="onMouseDown"
    @touchmove="onMouseMove"
    @touchend="onMouseLeave"
  >
    <div class="slider flex">
      <div
        ref="background"
        class="background-box"
      >

      </div>
      <div class="box">
        <span class="big"></span>
        <span class="big"></span>
        <span class="small"></span>
        <span class="small"></span>
        <span class="small"></span>
        <span class="small"></span>
        <span class="small"></span>
      </div>
    </div>
    <button
      ref="button"
      draggable="true"
      type="button"
    >

    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

const props = defineProps({
  label: {
    type: String,
    default: "",
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const emits = defineEmits(['onDrag'])
const defaultPosition = 100;

let position = defaultPosition;
let dragStart = false
let percent = 0;

const button = ref<HTMLButtonElement>();
const container = ref<HTMLDivElement>();
const background = ref<HTMLDivElement>();

onMounted(() => {
  setDefault();
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseLeave);
});

onUnmounted(() => {
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseLeave);
})

const setDefault = () => {
  const element = background.value;
  const btnElement = button.value;
  if (element) {
    element.style.width = '100%';
  }
  if (btnElement) {
    btnElement.style.left = `calc( ${defaultPosition}% - 18px )`;
  }
  position = defaultPosition;
}

const onMouseLeave = (event: MouseEvent | TouchEvent) => {
  event.preventDefault();
  dragStart = false;
}

const onMouseDown = (event: MouseEvent | TouchEvent) => {
  event.preventDefault();

  if (props.disabled) {
    return false;
  }

  const draggable = button.value!;
  const parentRect = container.value?.getBoundingClientRect();

  if (!draggable) {
    return false;
  }

  if (!parentRect) {
    return false;
  }

  const draggableRect = button.value!.getBoundingClientRect();
  let xPos = 0;

  switch (event.constructor) {
    case (MouseEvent): {
      xPos = (event as MouseEvent).x;
      break;
    }
    case (TouchEvent): {
      const [touche] = (event as TouchEvent).touches;
      xPos = touche.clientX;
      break;
    }
  }

  if (draggableRect) {
    if (event.target != button.value) {
      position = draggableRect.width / 2;
      setPercent(draggable, xPos, parentRect!, draggableRect);
      dragStart = true;
      return false;
    }

    position = xPos - draggableRect.x;
  }

  dragStart = true;
}

const onMouseMove = (event: MouseEvent | TouchEvent) => {
  event.preventDefault();
  const draggableRect = button.value?.getBoundingClientRect();

  if (dragStart && draggableRect && container.value && button.value) {
    const parentRect = container.value?.getBoundingClientRect();
    const draggable = button.value;
    let xPos = 0;

    switch (event.constructor) {
      case (MouseEvent): {
        xPos = (event as MouseEvent).x;
        break;
      }
      case (TouchEvent): {
        const [touche] = (event as TouchEvent).touches;
        xPos = touche.clientX;
        break;
      }
    }


    setPercent(draggable, xPos, parentRect, draggableRect);

  }
}

const setPercent = (draggable: HTMLButtonElement, xPos: number, parentRect: DOMRect, draggableRect: DOMRect) => {

  const x = xPos - parentRect.left - position;
  const widthDragable = draggableRect.width / 2

  if (x > -widthDragable && x < parentRect.width - widthDragable) {
    const prc = ((x + draggableRect.width / 2) / parentRect.width) * 100;
    draggable.style.left = `${x}px`;
    percent = Math.round(((x + draggableRect.width / 2) / parentRect.width) * 100);
    emits('onDrag', percent)
    if (background.value) {
      background.value.style.width = `${prc}%`;
    }
  }
}

</script>