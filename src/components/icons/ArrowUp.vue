
<template>
    <svg :width="width"
         :height="height"
         viewBox="0 0 26 22"
         fill="none"
         xmlns="http://www.w3.org/2000/svg">
        <path d="M14.6938 0.982143C14.35 0.392857 13.7116 0 13.0241 0C12.2875 0 11.6491 0.392857 11.3054 0.982143L0.698242 19.0536C0.354492 19.692 0.354492 20.4286 0.698242 21.0179C1.04199 21.6563 1.68038 22 2.41699 22H23.6313C24.3188 22 24.9572 21.6563 25.3009 21.0179C25.6447 20.4286 25.6447 19.692 25.3009 19.0536L14.6938 0.982143Z"
              :class="$attrs.class"
              fill="white"  />
    </svg>
</template>

<script setup lang="ts">
defineProps({
    width: {
        type: Number,
        default: 12
    },
    height: {
        type: Number,
        default: 11
    }
})
</script>