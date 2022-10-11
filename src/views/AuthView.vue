<template>
  <div class="page-container home">
    <LogoLink link="/"></LogoLink>
    <div class="container mx-auto">
      <div class="flex items-center justify-center pt-24">
        <div class="">
          <router-view />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LogoLink from '@/components/LogoLink.vue';
</script>
