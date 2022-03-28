<template>
  <div class="page-container home">
    <LogoLink link="/"></LogoLink>
    <div class="container mx-auto">
      <div class="grid grid-cols-12 gap-6 pt-24">
        <div class="col-start-4 col-span-5">
          <router-view></router-view>
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
