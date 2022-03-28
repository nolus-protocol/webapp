<template>
  <div class="page-container home">
    <SidebarContainer>
    </SidebarContainer>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import SidebarContainer from '@/components/SidebarContainer.vue'

export default defineComponent({
  name: 'DashboardView',
  components: {
    SidebarContainer
  },
  data () {
    return {}
  }
})
</script>
