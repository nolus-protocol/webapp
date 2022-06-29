<template>
  <a
    :id="this.id"
    :href="this.href"
    :class="[
      'sidebar-element',
      this.$route.path == this.href ? 'active' : false,
    ]"
  >
    <span :class="['icon', `icon-${this.label.toLowerCase()}`]"></span>
    <!-- <span class="icon" :class="`icon-${this.label}`"></span> -->
    <!-- <img
      class="icon"
      :src="this.icon"
    />
    <img
      class="iconHover"
      :src="this.iconHover"
    /> -->
    <span> {{ this.label }} </span>
  </a>
</template>
<script type="ts">
export default {
  name: 'SidebarElement',
  props: ['id', 'href', 'label', 'icon', 'iconHover', 'isActive']
}
</script>
