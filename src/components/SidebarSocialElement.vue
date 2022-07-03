<template>
  <a
    :id="this.id"
    :href="this.href"
    :class="['sidebar-social-element, color-light-blue']"
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
