<template>
  <div class="page-container home background-dark">
    <LogoLink link="/"></LogoLink>
    <div class="container mx-auto h-full">
      <div class="flex items-center justify-center pt-[64px] h-full md:h-auto">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LogoLink from '@/components/LogoLink.vue';
</script>
