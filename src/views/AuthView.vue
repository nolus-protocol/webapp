<template>
  <div class="page-container home background-dark">
    <LogoLink link="/"></LogoLink>
    <div class="container mx-auto">
      <div class="flex items-center justify-center pt-24">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LogoLink from '@/components/LogoLink.vue';
</script>
