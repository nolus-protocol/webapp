<template>
  <div class="slider-box">
    <div class="slider flex">
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
    <button>
      <img src="@/assets/icons/slider.svg" width="36" height="36" />
    </button>
  </div>
</template>

<script setup lang="ts">

const props = defineProps({
  label: {
    type: String,
    default: "",
  },
});

</script>