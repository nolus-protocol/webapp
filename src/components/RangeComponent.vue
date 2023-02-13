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
    @touchend="onMouseLeave">
    <div class="slider flex">
      <div ref="background" class="background-box">

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
    <button ref="button" draggable="true">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="36" height="36" rx="18" fill="#FF562E" />
        <path
          d="M16.0002 22.1862C16.0001 22.3749 15.9467 22.5598 15.8461 22.7194C15.7454 22.879 15.6016 23.0069 15.4314 23.0883C15.2611 23.1697 15.0713 23.2012 14.8839 23.1792C14.6964 23.1573 14.519 23.0827 14.3722 22.9642L9.18619 18.7782C9.07011 18.6845 8.97648 18.566 8.91216 18.4314C8.84784 18.2967 8.81445 18.1494 8.81445 18.0002C8.81445 17.851 8.84784 17.7037 8.91216 17.5691C8.97648 17.4345 9.07011 17.316 9.18619 17.2222L14.3722 13.0362C14.519 12.9177 14.6964 12.8432 14.8839 12.8212C15.0713 12.7993 15.2611 12.8308 15.4314 12.9122C15.6016 12.9936 15.7454 13.1214 15.8461 13.2811C15.9467 13.4407 16.0001 13.6255 16.0002 13.8142V22.1862Z"
          fill="white" />
        <path
          d="M21.628 22.9642C21.4811 23.0827 21.3038 23.1573 21.1163 23.1792C20.9289 23.2012 20.7391 23.1697 20.5688 23.0883C20.3986 23.0069 20.2548 22.879 20.1541 22.7194C20.0535 22.5598 20 22.3749 20 22.1862V13.8142C20 13.6255 20.0535 13.4407 20.1541 13.2811C20.2548 13.1214 20.3986 12.9936 20.5688 12.9122C20.7391 12.8308 20.9289 12.7993 21.1163 12.8212C21.3038 12.8432 21.4811 12.9177 21.628 13.0362L26.814 17.2222C26.9301 17.316 27.0237 17.4345 27.088 17.5691C27.1524 17.7037 27.1857 17.851 27.1857 18.0002C27.1857 18.1494 27.1524 18.2967 27.088 18.4314C27.0237 18.566 26.9301 18.6845 26.814 18.7782L21.628 22.9642Z"
          fill="white" />
      </svg>

    </button>
  </div>
</template>

<script setup lang="ts">import { ref } from 'vue';

const props = defineProps({
  label: {
    type: String,
    default: "",
  },
});
let position = 0;
let dragStart = false
let percent = 0;

const button = ref<HTMLButtonElement>();
const container = ref<HTMLDivElement>();
const background = ref<HTMLDivElement>();

const onMouseLeave = (event: MouseEvent | TouchEvent) => {
  event.preventDefault();
  dragStart = false;
}

const onMouseDown = (event: MouseEvent | TouchEvent) => {
  event.preventDefault();
  console.log(event)
  const draggableRect = button.value?.getBoundingClientRect();

  if (draggableRect) {
    switch(event.constructor){
      case(MouseEvent): {
        position = (event as MouseEvent).x - draggableRect.x;
        break;
      }
      case(TouchEvent): {
        const [touche] = (event as TouchEvent).touches;
        position = touche.clientX - draggableRect.x;
        break;
      }
    }
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

    switch(event.constructor){
      case(MouseEvent): {
        xPos = (event as MouseEvent).x;
        break;
      }
      case(TouchEvent): {
        const [touche] = (event as TouchEvent).touches;
        xPos = touche.clientX;
        break;
      }
    }

    const x = xPos - parentRect.left - position;
    const widthDragable = draggableRect.width/2
    
    if( x > -widthDragable && x < parentRect.width - widthDragable){
      const prc = ((x+draggableRect.width/2)/parentRect.width)*100;
      draggable.style.left = `${x}px`;
      percent = Math.round(((x+draggableRect.width/2)/parentRect.width)*100);
      if(background.value){
        background.value.style.width = `${prc}%`;
      }
    }


  }
}

</script>