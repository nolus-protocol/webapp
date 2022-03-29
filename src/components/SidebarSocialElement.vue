<template>
  <a
    :id="this.id"
    :href="this.href"
    :class="[
      'sidebar-social-element',
    ]"
    target="_blank"
  >
    <img 
      class="icon"
      :src="this.icon"
    />
  </a>
</template>
<script type="ts">
export default {
  name: 'SidebarSocialElement',
  props: ['id', 'href', 'icon']
}
</script>