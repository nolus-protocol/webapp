<template>
  <a
    :id="this.id"
    :class="[
      'sidebar-link-element',
    ]"
    :href="this.href"
  >
    <span>
        {{ this.label }}
    </span>
  </a>
</template>
<script type="ts">
export default {
  name: 'SidebarLinkElement',
  props: ['id', 'href', 'label']
}
</script>
