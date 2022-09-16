<template>
  <div class="page-container home background-dark">
    <LogoLink link="/"></LogoLink>
    <div class="container mx-auto">
      <div class="flex items-center justify-center pt-24">
        <div class="">
          <router-view/>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import LogoLink from '@/components/LogoLink.vue'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'AuthView',
  components: {
    LogoLink
  },
  data () {
    return {}
  },
  methods: {}
})
</script>
