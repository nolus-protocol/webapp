
<template>
    <svg :width="width"
         :height="height"
         viewBox="0 0 12 11"
         fill="none"
         xmlns="http://www.w3.org/2000/svg">
        <path d="M5.18555 10.2812C5.34961 10.5625 5.6543 10.75 5.98242 10.75C6.33398 10.75 6.63867 10.5625 6.80273 10.2813L11.8652 1.65625C12.0293 1.35156 12.0293 1 11.8652 0.718751C11.7012 0.414063 11.3965 0.250001 11.0449 0.250001L0.919922 0.25C0.591797 0.25 0.287109 0.414062 0.123047 0.71875C-0.0410156 1 -0.0410156 1.35156 0.123047 1.65625L5.18555 10.2812Z"
              :class="$attrs.class"
              fill="white" />
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