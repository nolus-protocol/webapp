<template>
  <div class="home">
    <WalletConnect/>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import WalletConnect from '@/components/WalletConnect.vue'

export default defineComponent({
  name: 'WelcomeView',
  components: {
    WalletConnect
  }
})
</script>
