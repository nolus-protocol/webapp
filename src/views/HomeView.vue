<template>
  <div class="home">
    <TestComponent/>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import TestComponent from '@/components/TestComponent.vue' // @ is an alias to /src

export default defineComponent({
  name: 'HomeView',
  components: {
    TestComponent
  }
})
</script>
