<template>
  <div class="home">
    <WalletConnect/>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import WalletConnect from '@/components/WalletConnect.vue' // @ is an alias to /src

export default defineComponent({
  name: 'WelcomeView',
  components: {
    WalletConnect
  }
})
</script>
