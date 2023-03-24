<template>
  <div
    ref="container"
    class="slider-box"
    @mousemove="onMouseMove"
    @mousedown="onMouseDown"
    @mouseup="onMouseLeave"
    @mouseleave="onMouseLeave"
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
import { MAX_POSITION, MIN_POSITION } from '@/config/env';
import { onMounted, ref } from 'vue';

const props = defineProps({
  label: {
    type: String,
    default: "",
  },
  disabled: {
    type: Boolean,
    default: false
  },
  position: {
    type: Number,
    default: 100
  }
});

const emits = defineEmits(['onDrag'])


let position = props.position;
let dragStart = false
let percent = 0;

const minValue = MIN_POSITION * 100 / MAX_POSITION;
const button = ref<HTMLButtonElement>();
const container = ref<HTMLDivElement>();
const background = ref<HTMLDivElement>();

onMounted(() => {
  setDefault();
});

const setDefault = () => {
  const element = background.value;
  const btnElement = button.value;
  if (element) {
    element.style.width = '100%';
  }
  if (btnElement) {
    btnElement.style.left = `calc( ${props.position}% - 18px )`;
  }
  position = props.position;
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
    if (prc < minValue) {
      return false;
    }
    draggable.style.left = `${x}px`;
    percent = Math.round(((x + draggableRect.width / 2) / parentRect.width) * 100);
    emits('onDrag', percent)
    if (background.value) {
      background.value.style.width = `${prc}%`;
    }
  }
}

</script>