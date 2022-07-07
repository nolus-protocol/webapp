<template>
  <a
    :id="this.id"
    :class="['sidebar-social-element, color-light-blue']"
    :href="this.href"
    target="_blank"
  >
    <span :class="['icon', `icon-${this.id.toLowerCase()}`]"></span>
  </a>
</template>
<script type="ts">
export default {
  name: 'SidebarSocialElement',
  props: ['id', 'href', 'icon']
}
</script>
